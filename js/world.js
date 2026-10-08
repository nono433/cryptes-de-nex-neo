/* ============================================================
   world.js — génération du donjon et champ de vision
   Salles reliées par des couloirs en L, eau, pièges, autels,
   escalier, et une torche par salle (elle éclaire pour de vrai).
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const hash2 = NEX.hash2;
  const clamp = NEX.clamp;

  const TILE = {
    WALL: 0,
    FLOOR: 1,
    STAIRS: 2,
    WATER: 3,
    TRAP: 4,
    ALTAR: 5,
    TORCH: 6,   // source de lumière : on ne passe pas à travers
  };

  const BASE_FOV = 8;

  class Dungeon {
    constructor() {
      this.w = 60;
      this.h = 20;
      this.tiles = new Uint8Array(this.w * this.h);
      this.explored = new Uint8Array(this.w * this.h);
      this.visible = new Uint8Array(this.w * this.h);
      this.corridor = new Uint8Array(this.w * this.h);
      this.rooms = [];
      this.stairs = { x: 0, y: 0 };
      this.hasStairs = false;
      this.lights = [];   // {x, y, color, radius}
      this.altar = null;  // {x, y}
      this.pal = null;
    }

    idx(x, y) { return y * this.w + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

    /**
     * Description STATIQUE d'une case (type, nom, franchissable).
     *
     * Attention : cette fiche est partagée par toutes les cases du même
     * type — elle ne porte aucun état. Pour savoir si une case estVisible,
     * il faut passer par vis() / seen(). Se tromper ici a fait des mois
     * pendant lesquels aucun monstre n'était dessiné, parce que
     * `at(x, y).visible` valait toujours undefined.
     */
    at(x, y) { return this.inBounds(x, y) ? TILES[this.tiles[this.idx(x, y)]] : TILES[TILE.WALL]; }

    /** La case est-elle dans le champ de vision du héros ? */
    vis(x, y) {
      return this.inBounds(x, y) ? this.visible[this.idx(x, y)] === 1 : false;
    }

    /** La case a-t-elle déjà été explorée ? */
    seen(x, y) {
      return this.inBounds(x, y) ? this.explored[this.idx(x, y)] === 1 : false;
    }

    /**
     * La torche est un mur de pierre comme un autre : on passe *sous*
     * elle. Le Treat comme bloquant couperait le donjon en deux.
     */
    isPassable(x, y) {
      if (!this.inBounds(x, y)) return false;
      const t = this.tiles[this.idx(x, y)];
      return t === TILE.FLOOR || t === TILE.STAIRS || t === TILE.TRAP
        || t === TILE.ALTAR || t === TILE.TORCH;
    }
    isOpaque(x, y) {
      if (!this.inBounds(x, y)) return true;
      return this.tiles[this.idx(x, y)] === TILE.WALL;
    }

    set(x, y, t) { if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t; }

    revealAll() { this.explored.fill(1); }
    disarmTrap(x, y) {
      if (this.inBounds(x, y) && this.tiles[this.idx(x, y)] === TILE.TRAP) {
        this.tiles[this.idx(x, y)] = TILE.FLOOR;
      }
    }

    /* -------------------------------------------------- génération */

    static generate(rng, decor, depth, hasStairs) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const d = new Dungeon();
        d.pal = NEX.paletteFor(depth);
        d.depth = depth;
        d.hasStairs = hasStairs;

        const target = 8 + rng.int(0, 3);
        for (let tries = 0; tries < 420 && d.rooms.length < target; tries++) {
          const w = rng.int(5, 13);
          const h = rng.int(4, 9);
          const x = rng.int(1, d.w - w - 1);
          const y = rng.int(1, d.h - h - 1);
          if (d.rooms.some((r) => intersects(r, x, y, w, h))) continue;
          d.rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
          d.carve(x, y, w, h);
        }
        if (d.rooms.length < 3) continue;

        for (let i = 1; i < d.rooms.length; i++) d.connect(d.rooms[i - 1], d.rooms[i], rng);

        // Une boucle en plus : moins d'impasses.
        if (d.rooms.length > 3) {
          const a = rng.pick(d.rooms);
          const b = rng.pick(d.rooms);
          if (a !== b) d.connect(a, b, rng);
        }

        // Escalier au centre de la dernière salle.
        if (hasStairs) {
          const last = d.rooms[d.rooms.length - 1];
          d.stairs = { x: last.cx, y: last.cy };
          d.set(last.cx, last.cy, TILE.STAIRS);
        }

        if (decor.altar) d.placeAltar(rng, hasStairs);
        d.floodWater(rng, decor.waterPools);
        d.placeTraps(rng, decor.traps);
        d.placeTorches(rng, depth);
        return d;
      }
      throw new Error("Impossible de générer le donjon.");
    }

    carve(x, y, w, h) {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) this.set(xx, yy, TILE.FLOOR);
    }

    connect(a, b, rng) {
      if (rng.chance(50)) {
        this.hCorridor(a.cx, b.cx, a.cy);
        this.vCorridor(a.cy, b.cy, b.cx);
      } else {
        this.vCorridor(a.cy, b.cy, a.cx);
        this.hCorridor(a.cx, b.cx, b.cy);
      }
    }

    hCorridor(x1, x2, y) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        this.corridor[this.idx(x, y)] = 1;
        if (this.tiles[this.idx(x, y)] === TILE.WALL) this.set(x, y, TILE.FLOOR);
      }
    }

    vCorridor(y1, y2, x) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        this.corridor[this.idx(x, y)] = 1;
        if (this.tiles[this.idx(x, y)] === TILE.WALL) this.set(x, y, TILE.FLOOR);
      }
    }

    /** Un autel dans une salle qui n'est ni le départ ni l'escalier. */
    placeAltar(rng, hasStairs) {
      const candidates = [];
      for (let i = 1; i < this.rooms.length; i++) {
        if (hasStairs && i === this.rooms.length - 1) continue;
        candidates.push(this.rooms[i]);
      }
      if (!candidates.length) return;
      const room = rng.pick(candidates);
      this.set(room.cx, room.cy, TILE.ALTAR);
      this.altar = { x: room.cx, y: room.cy };
    }

    /**
     * Noie des coins de salle. Chaque bassin est vérifié : s'il coupe
     * l'étage, on l'annule. Le donjon reste toujours connexe.
     */
    floodWater(rng, pools) {
      for (let i = 0; i < pools; i++) {
        const room = rng.pick(this.rooms);
        const w = rng.int(2, 4);
        const h = rng.int(2, 3);
        if (room.w <= w || room.h <= h) continue;

        let x = rng.int(room.x, room.x + room.w - w);
        let y = rng.int(room.y, room.y + room.h - h);

        // On recule le bloc pour qu'il ne prenne ni le centre ni l'escalier.
        if (x + w > room.cx) x = room.cx - w;
        if (y + h > room.cy) y = room.cy - h;
        if (x < room.x || y < room.y) continue;

        const flooded = [];
        for (let yy = y; yy < y + h; yy++) {
          for (let xx = x; xx < x + w; xx++) {
            if (xx === room.cx && yy === room.cy) continue;
            if (this.hasStairs && xx === this.stairs.x && yy === this.stairs.y) continue;
            if (this.corridor[this.idx(xx, yy)]) continue;      // jamais : ça couperait
            if (this.altar && xx === this.altar.x && yy === this.altar.y) continue;
            if (this.tiles[this.idx(xx, yy)] === TILE.FLOOR) {
              this.set(xx, yy, TILE.WATER);
              flooded.push([xx, yy]);
            }
          }
        }

        if (flooded.length && !this.isConnected()) {
          for (const [fx, fy] of flooded) this.set(fx, fy, TILE.FLOOR);
        }
      }
    }

    /** Toutes les cases passables sont-elles atteignables du point d'arrivée ? */
    isConnected() {
      const start = this.idx(this.rooms[0].cx, this.rooms[0].cy);
      if (!this.isPassable(this.rooms[0].cx, this.rooms[0].cy)) return false;

      const seen = new Uint8Array(this.w * this.h);
      const queue = [start];
      seen[start] = 1;

      for (let q = 0; q < queue.length; q++) {
        const cur = queue[q];
        const cx = cur % this.w, cy = (cur / this.w) | 0;
        const steps = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of steps) {
          const nx = cx + dx, ny = cy + dy;
          if (!this.isPassable(nx, ny)) continue;
          const ni = this.idx(nx, ny);
          if (seen[ni]) continue;
          seen[ni] = 1;
          queue.push(ni);
        }
      }

      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++)
          if (this.isPassable(x, y) && !seen[this.idx(x, y)]) return false;

      return true;
    }

    placeTraps(rng, count) {
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 240; tries++) {
          const x = rng.int(0, this.w - 1);
          const y = rng.int(0, this.h - 1);
          if (this.tiles[this.idx(x, y)] !== TILE.FLOOR) continue;
          if (this.hasStairs && x === this.stairs.x && y === this.stairs.y) continue;
          // Jamais sur le centre d'une salle : on doit pouvoir marcher dessus.
          if (this.rooms.some((r) => x === r.cx && y === r.cy)) continue;
          this.set(x, y, TILE.TRAP);
          break;
        }
      }
    }

    /**
     * Une torche par salle : c'est elle qui éclaire les couloirs.
     * Le décor en gagne un point de lumière et une ambiance.
     */
    placeTorches(rng, depth) {
      const hue = this.pal.accent;
      this.rooms.forEach((room, i) => {
        // Torche dans un coin, jamais sur l'autel ni l'escalier.
        const corners = [
          [room.x, room.y], [room.x + room.w - 1, room.y],
          [room.x, room.y + room.h - 1], [room.x + room.w - 1, room.y + room.h - 1],
        ];
        rng.shuffle(corners);
        for (const [x, y] of corners) {
          if (!this.isPassable(x, y)) continue;
          if (this.tiles[this.idx(x, y)] !== TILE.FLOOR) continue;
          if (this.altar && x === this.altar.x && y === this.altar.y) continue;
          if (this.hasStairs && x === this.stairs.x && y === this.stairs.y) continue;
          this.tiles[this.idx(x, y)] = TILE.TORCH;
          this.lights.push({
            x, y,
            color: depth >= 21 && depth <= 24 ? "#ff7a3b" : hue,
            radius: 6.4 + hash2(x, y, depth) * 1.6,
            flicker: 0.72 + hash2(x, y, depth + 7) * 0.5,
            phase: hash2(x, y, depth + 13) * 6.28,
          });
          return;
        }
      });

      // Quelques torches de couloir, pour que les couloirs ne soient pas noirs.
      const extra = 3 + Math.floor(depth / 8);
      for (let i = 0; i < extra; i++) {
        for (let t = 0; t < 40; t++) {
          const x = rng.int(1, this.w - 2);
          const y = rng.int(1, this.h - 2);
          if (!this.corridor[this.idx(x, y)]) continue;
          if (this.tiles[this.idx(x, y)] !== TILE.FLOOR) continue;
          this.tiles[this.idx(x, y)] = TILE.TORCH;
          this.lights.push({
            x, y, color: this.pal.accent,
            radius: 5.0 + rng.next() * 1.4,
            flicker: 0.7 + rng.next() * 0.5,
            phase: rng.next() * 6.28,
          });
          break;
        }
      }
    }

    /* -------------------------------------------------- champ de vision */

    /** Recalcule la vision du joueur : disque + ligne de vue (Bresenham). */
    computeFov(px, py, radius) {
      this.visible.fill(0);
      const r = Math.max(1, radius);
      const o = this.idx(px, py);
      this.visible[o] = 1;
      this.explored[o] = 1;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const tx = px + dx, ty = py + dy;
          if (!this.inBounds(tx, ty)) continue;
          if (!this.lineClear(px, py, tx, ty)) continue;
          const i = this.idx(tx, ty);
          this.visible[i] = 1;
          this.explored[i] = 1;
        }
      }
    }

    lineClear(x0, y0, x1, y1) {
      let dx = Math.abs(x1 - x0);
      const sx = x0 < x1 ? 1 : -1;
      let dy = -Math.abs(y1 - y0);
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;

      for (let guard = 0; guard < 512; guard++) {
        if (x0 === x1 && y0 === y1) return true;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
        if (x0 === x1 && y0 === y1) return true;
        if (this.isOpaque(x0, y0)) return false;
      }
      return false;
    }
  }

  /* Tableau de confort : index -> objet décrivant le comportement. */
  const TILES = [];
  TILES[TILE.WALL]   = { type: TILE.WALL,   name: "mur",     passable: false, opaque: true };
  TILES[TILE.FLOOR]  = { type: TILE.FLOOR,  name: "sol",     passable: true,  opaque: false };
  TILES[TILE.STAIRS] = { type: TILE.STAIRS, name: "escalier",passable: true,  opaque: false };
  TILES[TILE.WATER]  = { type: TILE.WATER,  name: "eau",     passable: false, opaque: false };
  TILES[TILE.TRAP]   = { type: TILE.TRAP,   name: "piège",   passable: true,  opaque: false };
  TILES[TILE.ALTAR]  = { type: TILE.ALTAR,  name: "autel",   passable: true,  opaque: false };
  TILES[TILE.TORCH]  = { type: TILE.TORCH,  name: "torche",  passable: true,  opaque: false };

  function intersects(r, x, y, w, h) {
    return !(r.x + r.w + 1 < x || x + w + 1 < r.x || r.y + r.h + 1 < y || y + h + 1 < r.y);
  }

  NEX.TILE = TILE;
  NEX.TILES = TILES;
  NEX.BASE_FOV = BASE_FOV;
  NEX.Dungeon = Dungeon;
  NEX.hash2 = hash2;
})();
