/* ============================================================
   render.js — le rendu canvas
   Tuiles procédurales mises en cache, caméra fluide, ombres
   portées, éclairage radial, additif, vignette, grain.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const clamp = NEX.clamp;
  const hash2 = NEX.hash2;
  const TAU = Math.PI * 2;

  const BASE_FOV = NEX.BASE_FOV;

  /*
   * Position des PIEDS d'un acteur, en fraction de tuile et mesurée depuis
   * le CENTRE de la case (la case va de -0.5 à +0.5 autour du centre).
   *
   * 0.46 = les pieds sont dans le bas de la case, ce qui est la convention
   * habituelle en vue de dessus. Tout est ancré là-dessus : sprite, ombre,
   * barre de vie. C'est ce qui empêche un héros de « marcher sur les murs ».
   */
  const FOOT_Y = 0.46;

  /*
   * Plafonds d'affichage, en fraction de tuile.
   *
   * Un acteur normal doit laisser voir le sol autour de lui : sans marge, il
   * semble stehen-flottant et on perd le compte des cases. Un sprite de
   * hauteur 0.92 tuile posé à 0.46 a sa tête à -0.46 : il reste dedans.
   */
  const FIT_ACTOR = 0.92;   // héros et créatures
  const FIT_BOSS = 1.34;    // le Gardien : il DOUT empiéter pour imposer sa taille
  const FIT_ITEM = 0.80;    // objets au sol

  /**
   * Calcule l'échelle d'affichage d'un sprite pour qu'il tienne dans sa case.
   *
   * C'est LA fonction qui règle « le perso passe sur les murs ». Les sprites
   * font de 8 à 18 px de haut pour une tuile de 16 : sans bridage, un
   * nécromancien de 16 px dans une case de 16 recouvre le mur du dessus — et
   * on ne sait plus où sont les cases, ni ce qu'il y a dedans.
   *
   * @param {number} w,h   taille du sprite (liseré compris)
   * @param {number} s     taille de la tuile en pixels
   * @param {number} want  multiplicateur demandé (1 = taille normale)
   * @param {number} maxH  hauteur max, en fraction de tuile
   * @returns {{scale:number, w:number, h:number}}
   */
  function fitSprite(w, h, s, want, maxH) {
    const cap = maxH === undefined ? FIT_ACTOR : maxH;
    let scale = (s / 16) * (want || 1);
    if (h * scale > s * cap) scale = (s * cap) / h;
    if (w * scale > s * cap) scale = Math.min(scale, (s * cap) / w);
    return {
      scale,
      w: Math.ceil(w * scale),
      h: Math.ceil(h * scale),
    };
  }

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.dpr = 1;
      this.W = 0; this.H = 0;
      this.tile = 24;
      this.viewTilesX = 40;
      this.viewTilesY = 22;

      this.camX = 0; this.camY = 0;
      this.camTX = 0; this.camTY = 0;
      this.time = 0;

      this.tileCache = new Map();
      this.lightCv = document.createElement("canvas");
      this.lightCtx = this.lightCv.getContext("2d");
      this.overlayCv = document.createElement("canvas");
      this.overlayCtx = this.overlayCv.getContext("2d");

      this.reduceMotion = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    /* -------------------------------------------------- dimensionnement */

    resize() {
      const rect = this.cv.getBoundingClientRect();
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      this.dpr = dpr;
      this.W = Math.max(320, Math.floor(rect.width));
      this.H = Math.max(240, Math.floor(rect.height));
      this.cv.width = Math.floor(this.W * dpr);
      this.cv.height = Math.floor(this.H * dpr);

      this.lightCv.width = this.cv.width;
      this.lightCv.height = this.cv.height;
      this.overlayCv.width = this.cv.width;
      this.overlayCv.height = this.cv.height;

      // On vise ~26 tuiles de large : le décor reste lisible.
      this.tile = Math.max(20, Math.floor(this.W / 26 / dpr) * dpr);
      if (this.tile < 20 * dpr) this.tile = 20 * dpr;
      this.viewTilesX = Math.ceil(this.W / this.tile);
      this.viewTilesY = Math.ceil(this.H / this.tile);

      this.tileCache.clear();
      this.ctx.imageSmoothingEnabled = false;
    }

    /* -------------------------------------------------- tuiles */

    /**
     * Tuile procédurale : dallage + fissures + éclats, déterministes
     * via hash2 pour que le décor ne « scintille » jamais.
     */
    buildTile(pal, type, variant) {
      const s = this.tile;
      const cv = document.createElement("canvas");
      cv.width = s;
      cv.height = s;
      const g = cv.getContext("2d");

      const n1 = hash2(variant, type, 11);
      const n2 = hash2(variant, type, 29);
      const n3 = hash2(variant, type, 47);

      /*
       * Les palettes de data.js sont volontairement très sombres : ce sont
       * des cryptes. Mais tel quel, deux dalles voisines étaient indiscernables
       * et le labyrinthe devenait illisible. On éclaircit donc au rendu —
       * une seule ligne ici plutôt que dix palettes à réécrire.
       */
      const F1 = shade(pal.floor, 1.38);
      const F2 = shade(pal.floor2, 1.38);
      const GR = shade(pal.grout, 1.30);
      const W1 = shade(pal.wall, 1.62);
      const W2 = shade(pal.wallTop, 1.46);
      const WE = shade(pal.wallEdge, 1.55);

      if (type === NEX.TILE.WALL) {
        // Dessus de mur : pierre encadrée, plus sombre au bord.
        g.fillStyle = W2;
        g.fillRect(0, 0, s, s);

        // Corps de la pierre
        const rows = 3;
        const rh = s / rows;
        for (let r = 0; r < rows; r++) {
          const off = (r % 2) * (s / 6);
          for (let i = -1; i < rows + 1; i++) {
            const bx = i * (s / 2) + off;
            const v = hash2(variant * 31 + i, r, 71);
            g.fillStyle = mix(W1, W2, 0.35 + v * 0.5);
            g.fillRect(Math.round(bx) + 1, Math.round(r * rh) + 1,
              Math.round(s / 2) - 2, Math.round(rh) - 2);
          }
        }

        // Éclats et grain
        speckle(g, s, variant, WE, 26, 0.30);
        speckle(g, s, variant + 5, W2, 12, 0.22);

        // Liseré supérieur : c'est lui qui donne le relief.
        g.fillStyle = shade(W2, 1.22);
        g.fillRect(0, 0, s, Math.max(1, Math.round(s * 0.055)));
        g.fillStyle = WE;
        g.fillRect(0, Math.round(s * 0.055), s, Math.max(1, Math.round(s * 0.035)));

        // Fissure éventuelle
        if (n3 > 0.72) crack(g, s, variant, WE);
      } else if (type === NEX.TILE.FLOOR) {
        g.fillStyle = n1 > 0.5 ? F1 : F2;
        g.fillRect(0, 0, s, s);

        // Deux formats de dalles
        const h = s / 2;
        g.fillStyle = mix(F1, F2, 0.85);
        g.fillRect(0, 0, s, Math.max(1, Math.round(s * 0.045)));
        g.fillRect(0, 0, Math.max(1, Math.round(s * 0.045)), s);
        if (n2 > 0.5) {
          g.fillRect(0, Math.round(h), s, Math.max(1, Math.round(s * 0.035)));
          g.fillRect(Math.round(h), 0, Math.max(1, Math.round(s * 0.035)), s);
        }

        speckle(g, s, variant, GR, 30, 0.28);
        speckle(g, s, variant + 3, shade(F1, 1.3), 16, 0.16);
        if (n3 > 0.82) crack(g, s, variant, GR);
      } else if (type === NEX.TILE.STAIRS) {
        g.fillStyle = F2;
        g.fillRect(0, 0, s, s);
        const steps = 4;
        const sh = s / steps;
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          g.fillStyle = mix(F1, "#000000", 0.10 + t * 0.42);
          g.fillRect(Math.round(s * 0.10), Math.round(i * sh + sh * 0.12),
            Math.round(s * 0.80), Math.round(sh * 0.72));
          g.fillStyle = shade(mix(F1, "#000000", 0.10 + t * 0.42), 1.35);
          g.fillRect(Math.round(s * 0.10), Math.round(i * sh + sh * 0.12),
            Math.round(s * 0.80), Math.max(1, Math.round(s * 0.05)));
        }
      } else if (type === NEX.TILE.WATER) {
        g.fillStyle = pal.water;
        g.fillRect(0, 0, s, s);
        // ondulations fixes : le rendu ajoute le mouvement
        for (let i = 0; i < 5; i++) {
          const y = ((i * 0.21 + n1 * 0.3) % 1) * s;
          g.fillStyle = mix(pal.water, pal.waterHi, 0.55);
          g.fillRect(0, Math.round(y), s, Math.max(1, Math.round(s * 0.05)));
        }
      } else if (type === NEX.TILE.ALTAR) {
        g.fillStyle = F1;
        g.fillRect(0, 0, s, s);
        // Dais circulaire gravé
        g.strokeStyle = pal.accent;
        g.globalAlpha = 0.55;
        g.lineWidth = Math.max(1, s * 0.05);
        g.beginPath();
        g.arc(s / 2, s / 2, s * 0.36, 0, TAU);
        g.stroke();
        g.globalAlpha = 0.28;
        g.beginPath();
        g.arc(s / 2, s / 2, s * 0.24, 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
        // Runes
        g.fillStyle = pal.accent;
        for (let i = 0; i < 4; i++) {
          const a = i * (TAU / 4) + 0.4;
          const rx = s / 2 + Math.cos(a) * s * 0.30;
          const ry = s / 2 + Math.sin(a) * s * 0.30;
          g.fillRect(Math.round(rx - s * 0.03), Math.round(ry - s * 0.03),
            Math.max(2, Math.round(s * 0.06)), Math.max(2, Math.round(s * 0.06)));
        }
      }

      return cv;
    }

    getTileCanvas(pal, type, variant) {
      const key = pal.name + "|" + type + "|" + variant;
      let c = this.tileCache.get(key);
      if (!c) {
        c = this.buildTile(pal, type, variant);
        this.tileCache.set(key, c);
      }
      return c;
    }

    /* -------------------------------------------------- caméra */

    snapTo(x, y) {
      this.camTX = x;
      this.camTY = y;
      this.camX = x;
      this.camY = y;
    }

    follow(x, y, dt) {
      this.camTX = x;
      this.camTY = y;
      if (this.reduceMotion) { this.camX = x; this.camY = y; return; }
      const k = 1 - Math.pow(0.0016, dt);
      this.camX += (this.camTX - this.camX) * k;
      this.camY += (this.camTY - this.camY) * k;
    }

    /* -------------------------------------------------- rendu */

    render(game, fx, dt) {
      this.time += dt;
      const t = this.time;
      const ctx = this.ctx;
      const dpr = this.dpr;
      const s = this.tile;
      const map = game.map;
      const pal = map.pal;

      // Fond hors carte
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.fog;
      ctx.fillRect(0, 0, this.W, this.H);

      const camX = this.camX + fx.shakeX;
      const camY = this.camY + fx.shakeY;

      // Origine : la tuile (0,0) à l'écran
      const originX = (this.viewTilesX / 2) - camX;
      const originY = (this.viewTilesY / 2) - camY;

      const x0 = Math.max(0, Math.floor(-originX) - 1);
      const y0 = Math.max(0, Math.floor(-originY) - 1);
      const x1 = Math.min(map.w - 1, Math.ceil(-originX + this.viewTilesX) + 1);
      const y1 = Math.min(map.h - 1, Math.ceil(-originY + this.viewTilesY) + 1);

      const px = (tx) => (tx + originX) * s;
      const py = (ty) => (ty + originY) * s;

      /* ---------- 1. sol et murs */
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = map.idx(x, y);
          const seen = map.explored[i];
          const vis = map.visible[i];
          if (!seen && !vis) continue;

          const type = map.tiles[i];
          const variant = (hash2(x, y, 3) * 4) | 0;

          if (type === NEX.TILE.WALL) {
            this.drawWall(ctx, pal, x, y, px(x), py(y), s, vis, seen, t);
            continue;
          }

          const tc = this.getTileCanvas(pal, type === NEX.TILE.WATER ? NEX.TILE.WATER : type, variant);
          ctx.drawImage(tc, Math.round(px(x)), Math.round(py(y)), s, s);

          if (type === NEX.TILE.TORCH) {
            // Le socle de la torche + sa flamme (les 4 images)
            const flick = 0.72 + Math.sin(t * 9 + x * 2.1 + y * 1.7) * 0.12
              + Math.sin(t * 21.3 + y * 3.3) * 0.06;
            this.drawTorch(ctx, px(x) + s / 2, py(y) + s * 0.42, s, pal.accent, flick, vis);
          }

          if (seen && !vis) this.applyMemory(ctx, px(x), py(y), s, 0.42);
        }
      }

      /* ---------- 2. autel (halo pulsé) */
      if (map.altar && map.explored[map.idx(map.altar.x, map.altar.y)]) {
        const ax = px(map.altar.x), ay = py(map.altar.y);
        const pulse = 0.5 + Math.sin(t * 2.2) * 0.2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gr = ctx.createRadialGradient(ax + s / 2, ay + s / 2, 0, ax + s / 2, ay + s / 2, s * 2.1);
        gr.addColorStop(0, hexA(pal.accent, 0.32 * pulse));
        gr.addColorStop(0.5, hexA(pal.accent, 0.10 * pulse));
        gr.addColorStop(1, hexA(pal.accent, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(ax - s * 2, ay - s * 2, s * 5, s * 5);
        ctx.restore();
      }

      /* ---------- 3. objets au sol */
      for (const f of game.floor) {
        const i = map.idx(f.x, f.y);
        if (!map.visible[i]) continue;
        this.drawItem(ctx, f.item, px(f.x), py(f.y), s, t, game.p.x === f.x && game.p.y === f.y);
      }

      /* ---------- 4. monstres */
      const actors = [];
      for (const m of game.monsters) {
        if (!map.vis(m.x, m.y)) continue;
        actors.push(m);
      }
      actors.sort((a, b) => a.y - b.y);

      for (const m of actors) {
        const lunge = m.lunge || 0;
        const ox = px(m.x) + s / 2 + (m.lungeX || 0) * lunge * s * 0.36;
        const oy = py(m.y) + s / 2 + (m.lungeY || 0) * lunge * s * 0.36;
        this.drawMonster(ctx, m, ox, oy, s, t);
      }

      /* ---------- 5. héros */
      this.drawPlayer(ctx, game, px(game.p.x), py(game.p.y), s, t);

      /* ---------- 6. éclairage */
      this.drawLighting(ctx, game, fx, px, py, s, t);

      /* ---------- 7. particules */
      this.drawParticles(ctx, fx, px, py, s);

      /* ---------- 8. anneaux + textes */
      this.drawRings(ctx, fx, px, py, s);
      this.drawTexts(ctx, fx, px, py, s);

      /* ---------- 9. vignette + grain + flash */
      this.drawPost(ctx, fx, game, t);
    }

    /* -------------------------------------------------- primitives de tuile */

    drawWall(ctx, pal, x, y, dx, dy, s, vis, seen, t) {
      // Un mur est une pierre surélevée : on la décale vers le haut et on
      // dessine son flanc vertical en dessous. C'est ce relief qui donne
      // la sensation de volume à un décor 2D.
      const tc = this.getTileCanvas(pal, NEX.TILE.WALL, (hash2(x, y, 3) * 4) | 0);
      const lift = Math.round(s * 0.13);
      ctx.drawImage(tc, Math.round(dx), Math.round(dy - lift), s, s + lift);

      const grad = ctx.createLinearGradient(0, dy + s - lift, 0, dy + s);
      grad.addColorStop(0, shade(pal.wallTop, 0.55));
      grad.addColorStop(1, pal.wallEdge);
      ctx.fillStyle = grad;
      ctx.fillRect(Math.round(dx), Math.round(dy + s - lift),
        s, Math.max(1, Math.round(lift)));

      if (seen && !vis) this.applyMemory(ctx, dx, dy - lift, s + lift, 0.42);
    }

    drawTorch(ctx, cx, cy, s, color, flick, visible) {
      // Socle
      ctx.fillStyle = "#1a1208";
      ctx.fillRect(Math.round(cx - s * 0.06), Math.round(cy - s * 0.18),
        Math.round(s * 0.12), Math.round(s * 0.24));

      if (!visible) return;

      const h = s * 0.34 * flick;
      const w = s * 0.16 * flick;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Flamme : trois couches
      ctx.fillStyle = hexA("#ff6a1a", 0.55);
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 0.30, w, h * 0.85, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = hexA("#ffb648", 0.72);
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 0.28, w * 0.62, h * 0.60, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = hexA("#fff0c0", 0.85);
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 0.26, w * 0.30, h * 0.34, 0, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    drawItem(ctx, item, dx, dy, s, t, underPlayer) {
      const cx = dx + s / 2;
      const cy = dy + s / 2;
      const bob = Math.sin(t * 2.1 + dx * 0.1) * s * 0.06;

      NEX.spriteShadow(ctx, cx, cy + FOOT_Y * s, s * 0.52, 0.3);

      // Halo coloré
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gr = ctx.createRadialGradient(cx, cy + bob, 0, cx, cy + bob, s * 0.85);
      gr.addColorStop(0, hexA(item.color, 0.34));
      gr.addColorStop(1, hexA(item.color, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(cx - s, cy + bob - s, s * 2, s * 2);
      ctx.restore();

      // Contour sombre : une pièce posée dans le noir doit se voir aussi.
      const cv = NEX.spriteOutlined(item.sprite, tierTint(item));

      // Bornage : une pièce tient dans sa case (les sprites font 8 à 12 px).
      const fit = fitSprite(cv.width, cv.height, s, 1, FIT_ITEM);
      const dw = fit.w;
      const dh = fit.h;

      /*
       * Ancrage par les pieds — comme les acteurs.
       *
       * ATTENTION au `cy +` : sans lui, la hauteur était calculée seule et
       * tous les objets se retrouvaient empilés en haut de l'écran, hors de
       * leur case. C'est exactement le symptôme « le butin n'a pas de
       * sprite » : les halos étaient à la bonne place, les dessins non.
       */
      const top = cy + (FOOT_Y - 0.04) * s - dh + bob;
      ctx.drawImage(cv, Math.round(cx - dw / 2), Math.round(top), dw, dh);
    }

    drawMonster(ctx, m, cx, cy, s, t) {
      const scale = s / 16;
      const idle = Math.sin(t * 2.3 + m.bob) * s * 0.030;

      /*
       * Flottement des créatures qui lévitent (spectre, seigneur des ombres,
       * nécromancien). Il ne va QUE vers le bas : les faire monter au-dessus
       * de leur case les faisait chevaucher le mur du dessus. En descendant
       * depuis leur position de repos, elles « décollent » du sol — c'est
       * l'effet voulu — sans jamais sortir de la case.
       */
      const floats = m.key === "wraith" || m.key === "shade" || m.key === "lich";
      const hover = floats
        ? s * (0.05 + Math.abs(Math.sin(t * 1.5 + m.bob)) * 0.05)
        : 0;

      NEX.spriteShadow(ctx, cx, cy + FOOT_Y * s, s * 0.56, hover ? 0.18 : 0.30);

      // Aura : chaque monstre a sa propre couleur, ça «categorise » l'écran
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.5 + Math.sin(t * 2.6 + m.bob) * 0.2;
      const rad = s * (m.isBoss ? 2.4 : m.isElite ? 1.5 : 0.95);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, hexA(m.glow, (m.isBoss ? 0.34 : 0.20) * pulse));
      gr.addColorStop(0.55, hexA(m.glow, (m.isBoss ? 0.14 : 0.07) * pulse));
      gr.addColorStop(1, hexA(m.glow, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();

      // Sprite_AVEC contour : sans lui, un rat gris sur une dalle grise
      // disparaît totalement. C'est ce liseré qui le rend lisible.
      const cv = NEX.spriteOutlined(m.sprite);

      /*
       * Anti-débordement : on borne la taille pour que l'acteur reste
       * lisible case par case. Un sprite de 18 px dans une tuile de 16 px
       * déborderait sur les murs voisins — et une créature à demi cachée
       * derrière un mur est une créature qu'on ne voit pas.
       * Seule exception : le boss, qui DOUT déborder pour imposer sa taille.
       */
      const fit = fitSprite(cv.width, cv.height, s, m.scale, m.isBoss ? FIT_BOSS : FIT_ACTOR);
      const dw = fit.w;
      const dh = fit.h;

      // Attaque : léger zoom + décalage
      const lunge = m.lunge || 0;
      const zoom = 1 + lunge * 0.12;

      // Ancrage par les PIEDS : le bas du sprite est planté dans la case.
      // Centrer verticalement le faisait déborder d'un tiers de tuile vers
      // le bas, donc par-dessus la case d'après — murs compris.
      ctx.save();
      ctx.translate(cx, cy + idle + hover);
      ctx.scale(zoom, zoom);
      const top = FOOT_Y * s - dh;
      ctx.drawImage(cv, Math.round(-dw / 2), Math.round(top), dw, dh);

      // Flash de douleur
      if (m.hurtFlash > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = m.hurtFlash * 0.85;
        ctx.drawImage(cv, Math.round(-dw / 2), Math.round(top), dw, dh);
      }
      ctx.restore();

      // Barre de vie des élites et du boss, au-dessus de la tête
      if (m.isElite || m.isBoss) {
        const w = s * (m.isBoss ? 1.7 : 1.0);
        const frac = clamp(m.hp / m.maxHp, 0, 1);
        const bx = cx - w / 2;
        const by = cy + (FOOT_Y - 1.0) * s - dh - s * (m.isBoss ? 0.16 : 0.08);
        ctx.fillStyle = "rgba(0,0,0,.72)";
        ctx.fillRect(bx - 1, by - 1, Math.ceil(w) + 2, Math.max(4, Math.round(s * 0.10)) + 2);
        const grad = ctx.createLinearGradient(bx, 0, bx + w, 0);
        grad.addColorStop(0, m.isBoss ? "#ff2f6b" : "#ffb648");
        grad.addColorStop(1, m.isBoss ? "#ff9ad0" : "#ffe6a0");
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, Math.round(w * frac), Math.max(3, Math.round(s * 0.10)));
      }
    }

    drawPlayer(ctx, game, dx, dy, s, t) {
      const p = game.p;
      const cx = dx + s / 2;
      const cy = dy + s / 2;

      // Vacillement du dégât
      const hurt = p.hurtFlash || 0;
      const bob = Math.sin(t * 3.1) * s * 0.035;
      const breathe = 1 + Math.sin(t * 1.7) * 0.012;

      NEX.spriteShadow(ctx, cx, cy + FOOT_Y * s, s * 0.54, 0.34);

      // Lampe que porte le héros : sa vraie source de vie
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.85 + Math.sin(t * 3.4) * 0.15;
      const rad = s * 4.6;
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, hexA("#ffd9a0", 0.30 * pulse));
      gr.addColorStop(0.35, hexA("#ffb648", 0.14 * pulse));
      gr.addColorStop(1, hexA("#ffb648", 0));
      ctx.fillStyle = gr;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();

      // Contour sombre, comme les créatures : sans lui le héros se fond
      // dans les dalles claires. Bornage strict à la case.
      const cv = NEX.spriteOutlined("player");
      const fit = fitSprite(cv.width, cv.height, s, breathe, FIT_ACTOR);
      const dw = fit.w;
      const dh = fit.h;

      ctx.save();
      ctx.translate(cx, cy + bob);
      const top = FOOT_Y * s - dh;
      ctx.drawImage(cv, Math.round(-dw / 2), Math.round(top), dw, dh);
      if (hurt > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = hurt * 0.8;
        ctx.drawImage(cv, Math.round(-dw / 2), Math.round(top), dw, dh);
      }
      ctx.restore();

      // Lueur de la lanterne, à la main
      const lx = cx + s * 0.26;
      const ly = cy + s * 0.06;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hexA("#fff0c0", 0.9);
      ctx.beginPath();
      ctx.arc(lx, ly, s * 0.055 * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hexA("#ffb648", 0.35);
      ctx.beginPath();
      ctx.arc(lx, ly, s * 0.14 * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Aura d'or rare : rappelle que c'est TOI
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hexA("#ffd45e", 0.22 + Math.sin(t * 2) * 0.06);
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.ellipse(cx, cy + FOOT_Y * s, s * 0.40, s * 0.16, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    /* -------------------------------------------------- éclairage */

    drawLighting(ctx, game, fx, px, py, s, t) {
      const lc = this.lightCtx;
      const map = game.map;
      const pal = map.pal;
      const dpr = this.dpr;

      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      lc.globalCompositeOperation = "source-over";
      lc.clearRect(0, 0, this.W, this.H);

      /*
       * Obscurité de fond.
       *
       * Dosage ajusté après lecture d'images : à 0.60 de base, les dalles
       * étaient si sombres qu'on ne distinguait plus une case d'une autre —
       * c'est un labyrinthe illisible, pas un donjon mystérieux. On part
       * d'une pénalité douce (0.40) et on n'assombrit que franchement tout
       * à fait, vers le fond.
       */
      const dark = clamp(0.40 + game.depth * 0.0042, 0.40, 0.62);
      lc.fillStyle = hexA(pal.fog, dark);
      lc.fillRect(0, 0, this.W, this.H);

      // On efface (destination-out) là où la lumière arrive.
      lc.globalCompositeOperation = "destination-out";

      /*
       * 1. La lampe du héros. Le rayon suit la VUE réelle : c'est cohérent
       *    (on voit autant qu'on éclaire) et ça évite les monstres qui
       *    surgissent d'un coin qu'on ne distinguishait pas.
       */
      const hx = px(game.p.x) + s / 2;
      const hy = py(game.p.y) + s / 2;
      const lampR = s * (2.6 + game.p.bonus.sight * 0.62);
      const lampGrad = lc.createRadialGradient(hx, hy, 0, hx, hy, lampR);
      lampGrad.addColorStop(0, "rgba(0,0,0,1)");
      lampGrad.addColorStop(0.62, "rgba(0,0,0,0.62)");
      lampGrad.addColorStop(1, "rgba(0,0,0,0)");
      lc.fillStyle = lampGrad;
      lc.fillRect(hx - lampR, hy - lampR, lampR * 2, lampR * 2);

      // 2. les torches visibles
      for (const L of map.lights) {
        const i = map.idx(L.x, L.y);
        if (!map.visible[i]) continue;
        const flick = L.flicker * (0.85 + Math.sin(t * 8 + L.phase) * 0.15);
        const r = s * L.radius * flick;
        const tx = px(L.x) + s / 2;
        const ty = py(L.y) + s * 0.42;
        const g = lc.createRadialGradient(tx, ty, 0, tx, ty, r);
        g.addColorStop(0, "rgba(0,0,0,0.95)");
        g.addColorStop(0.5, "rgba(0,0,0,0.45)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        lc.fillStyle = g;
        lc.fillRect(tx - r, ty - r, r * 2, r * 2);
      }

      // 3. les autels
      if (map.altar && map.visible[map.idx(map.altar.x, map.altar.y)]) {
        const ax = px(map.altar.x) + s / 2;
        const ay = py(map.altar.y) + s / 2;
        const r = s * 2.6;
        const g = lc.createRadialGradient(ax, ay, 0, ax, ay, r);
        g.addColorStop(0, "rgba(0,0,0,0.8)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        lc.fillStyle = g;
        lc.fillRect(ax - r, ay - r, r * 2, r * 2);
      }

      // 4. les escaliers : un repère froid, toujours visible
      if (map.hasStairs && map.visible[map.idx(map.stairs.x, map.stairs.y)]) {
        const sx = px(map.stairs.x) + s / 2;
        const sy = py(map.stairs.y) + s / 2;
        const r = s * 2.0;
        const g = lc.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, "rgba(0,0,0,0.65)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        lc.fillStyle = g;
        lc.fillRect(sx - r, sy - r, r * 2, r * 2);
      }

      /*
       * 5. Auto-illumination des créatures visibles.
       *
       * Sans ça, un monstre posté dans un recoin non éclairé reçoit la
       * pénalité d'ombre ET celle du côté non éclairé de sa case : il
       * devient une masse noire sur un mur noir — littéralement invisible.
       * En effaçant un peu d'ombre autour de lui, il ressort.
       *
       * Toutes les sources sont effacées ICI, puis le calque n'est appliqué
       * qu'une seule fois : le redessiner par-dessus assombrirait tout.
       */
      for (const m of game.monsters) {
        if (!map.vis(m.x, m.y)) continue;
        const r = s * (m.isBoss ? 1.5 : 0.95);
        const mx = px(m.x) + s / 2;
        const my = py(m.y) + s * 0.18;
        const g = lc.createRadialGradient(mx, my, 0, mx, my, r);
        g.addColorStop(0, "rgba(0,0,0,0.85)");
        g.addColorStop(0.5, "rgba(0,0,0,0.50)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        lc.fillStyle = g;
        lc.fillRect(mx - r, my - r, r * 2, r * 2);
      }

      lc.globalCompositeOperation = "source-over";

      // On applique — une seule fois.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.lightCv, 0, 0);
      ctx.restore();

      /* ---- passe additive : la chaleur des flammes par-dessus tout ---- */
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const L of map.lights) {
        if (!map.visible[map.idx(L.x, L.y)]) continue;
        const flick = L.flicker * (0.85 + Math.sin(t * 8 + L.phase) * 0.15);
        const r = s * L.radius * flick * 0.85;
        const tx = px(L.x) + s / 2;
        const ty = py(L.y) + s * 0.42;
        const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
        g.addColorStop(0, hexA(L.color, 0.20));
        g.addColorStop(0.45, hexA(L.color, 0.07));
        g.addColorStop(1, hexA(L.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(tx - r, ty - r, r * 2, r * 2);
      }

      // lueur froide de l'autel
      if (map.altar && map.visible[map.idx(map.altar.x, map.altar.y)]) {
        const ax = px(map.altar.x) + s / 2;
        const ay = py(map.altar.y) + s / 2;
        const r = s * 2.4;
        const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, r);
        g.addColorStop(0, hexA(pal.accent, 0.16 + Math.sin(t * 2.2) * 0.05));
        g.addColorStop(1, hexA(pal.accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(ax - r, ay - r, r * 2, r * 2);
      }

      /*
       * Liseré de danger sous chaque créature visible.
       *
       * Passe additive, donc INAFFECTÉE par l'ombre : c'est la garantie
       * absolue qu'un ennemi ne peut pas disparaître dans le noir. Un
       * anneau fin, à la couleur de la créature — il ne gêne pas la lecture
       * mais l'œil le capte immédiatement, même dans un couloir noir.
       */
      for (const m of game.monsters) {
        if (!map.vis(m.x, m.y)) continue;
        const mx = px(m.x) + s / 2;
        const my = py(m.y) + FOOT_Y * s;
        const pulse = 0.55 + Math.sin(t * 2.6 + m.bob) * 0.18;
        ctx.strokeStyle = hexA(m.glow, (m.isBoss ? 0.85 : m.isElite ? 0.7 : 0.42) * pulse);
        ctx.lineWidth = Math.max(1, s * (m.isBoss ? 0.07 : 0.045));
        ctx.beginPath();
        ctx.ellipse(mx, my, s * 0.40, s * 0.155, 0, 0, TAU);
        ctx.stroke();
      }

      ctx.restore();
    }

    applyMemory(ctx, x, y, s, alpha) {
      ctx.fillStyle = hexA("#000000", alpha === undefined ? 0.42 : alpha);
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(s), Math.ceil(s));
    }

    /* -------------------------------------------------- particules */

    drawParticles(ctx, fx, px, py, s) {
      // Non additives d'abord (poussière sombre)
      ctx.save();
      for (let i = 0; i < fx.count; i++) {
        if (fx.add[i]) continue;
        const k = fx.life[i] / fx.maxLife[i];
        ctx.globalAlpha = k * 0.5;
        ctx.fillStyle = fx.col[i];
        const r = fx.size[i] * s * k;
        ctx.fillRect((px(fx.px[i]) - r) | 0, (py(fx.py[i]) - r) | 0, (r * 2) | 0 || 1, (r * 2) | 0 || 1);
      }
      ctx.restore();

      // Additives (étincelles, magie)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < fx.count; i++) {
        if (!fx.add[i]) continue;
        const k = fx.life[i] / fx.maxLife[i];
        const r = Math.max(0.6, fx.size[i] * s * (0.4 + k * 0.6));
        const gx = px(fx.px[i]), gy = py(fx.py[i]);
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 2.2);
        gr.addColorStop(0, hexA(fx.col[i], k));
        gr.addColorStop(0.4, hexA(fx.col[i], k * 0.4));
        gr.addColorStop(1, hexA(fx.col[i], 0));
        ctx.fillStyle = gr;
        ctx.fillRect(gx - r * 2.2, gy - r * 2.2, r * 4.4, r * 4.4);
      }
      ctx.restore();
    }

    drawRings(ctx, fx, px, py, s) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const r of fx.rings) {
        const k = r.life / r.max;
        const rad = r.r * s * r.s;
        ctx.strokeStyle = hexA(r.color, k * 0.7);
        ctx.lineWidth = Math.max(1, s * 0.06 * k);
        ctx.beginPath();
        ctx.ellipse(px(r.x) + s / 2, py(r.y) + s / 2, rad, rad * 0.42, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawTexts(ctx, fx, px, py, s) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const t of fx.texts) {
        const k = t.life / t.max;
        const size = Math.round(s * 0.34 * t.scale * (0.75 + k * 0.35));
        const x = px(t.x) + s / 2;
        const y = py(t.y) + s * 0.30;
        ctx.font = `700 ${size}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
        ctx.lineWidth = Math.max(2, size * 0.20);
        ctx.strokeStyle = "rgba(0,0,0,.92)";
        ctx.lineJoin = "round";
        ctx.strokeText(t.text, x, y);
        ctx.fillStyle = t.color;
        ctx.globalAlpha = Math.min(1, k * 1.8);
        ctx.fillText(t.text, x, y);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    drawPost(ctx, fx, game, t) {
      // vignette
      const vg = ctx.createRadialGradient(
        this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.30,
        this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.W, this.H);

      // dégâts : bords rouges
      const frac = game.p.hp / game.p.maxHp;
      if (frac < 0.34) {
        const pulse = 0.10 + (0.34 - frac) * 0.55 + Math.sin(t * 3.6) * 0.035;
        const rg = ctx.createRadialGradient(
          this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.22,
          this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.70);
        rg.addColorStop(0, "rgba(255,20,50,0)");
        rg.addColorStop(1, hexA("#ff1030", clamp(pulse, 0, 0.5)));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, this.W, this.H);
      }

      // flash
      if (fx.flash) {
        const k = fx.flash.life / fx.flash.max;
        ctx.fillStyle = hexA(fx.flash.color, k * fx.flash.peak);
        ctx.fillRect(0, 0, this.W, this.H);
      }
    }

    /* -------------------------------------------------- mini-carte */

    renderMinimap(ctx, game) {
      const map = game.map;
      const w = ctx.canvas.width, h = ctx.canvas.height;
      const s = Math.min(w / map.w, h / map.h);
      const ox = (w - s * map.w) / 2;
      const oy = (h - s * map.h) / 2;
      const pal = map.pal;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#03040a";
      ctx.fillRect(0, 0, w, h);

      for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
          const i = map.idx(x, y);
          if (!map.explored[i]) continue;
          const type = map.tiles[i];
          if (type === NEX.TILE.WALL) continue;
          let col;
          if (type === NEX.TILE.WATER) col = pal.water;
          else if (type === NEX.TILE.ALTAR) col = pal.accent;
          else if (type === NEX.TILE.STAIRS) col = "#4ade80";
          else if (type === NEX.TILE.TRAP) col = "#b88030";
          else if (type === NEX.TILE.TORCH) col = pal.accent;
          else col = map.visible[i] ? mix(pal.floor, "#ffffff", 0.30) : "#2a3050";

          ctx.fillStyle = col;
          ctx.globalAlpha = map.visible[i] ? 1 : 0.55;
          ctx.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
        }
      }
      ctx.globalAlpha = 1;

      // Monstres vus
      for (const m of game.monsters) {
        if (!map.vis(m.x, m.y)) continue;
        ctx.fillStyle = m.isBoss ? "#ff2f6b" : m.isElite ? "#ffd45e" : "#ff6a78";
        const r = m.isBoss ? 3.4 : m.isElite ? 2.6 : 1.8;
        ctx.beginPath();
        ctx.arc(ox + (m.x + 0.5) * s, oy + (m.y + 0.5) * s, r, 0, TAU);
        ctx.fill();
      }

      // Héros : un losange, il doit sauter aux yeux
      const pxp = ox + (game.p.x + 0.5) * s;
      const pyp = oy + (game.p.y + 0.5) * s;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#5de3ff";
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(pxp, pyp - 4);
      ctx.lineTo(pxp + 3.2, pyp);
      ctx.lineTo(pxp, pyp + 4);
      ctx.lineTo(pxp - 3.2, pyp);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /* -------------------------------------------------- couleurs */

  /**
   * Teinte d'une pièce d'équipement selon son palier.
   * Le corps prend la couleur du palier, l'éclat reste clair : c'est le
   * contraste qui fait qu'on distingue un « rare » d'un « de nex » sur une
   * case sombre, pas la teinte seule.
   */
  function tierTint(item) {
    if (!item || item.kind !== "gear") return null;
    const c = NEX.tierColor(item.tier);
    return {
      k: shade("#0b0d18", 1),
      m: mix("#8e96bc", c, 0.72),
      l: mix("#e8ecff", c, 0.28),
      a: mix("#c8792c", c, 0.85),
      e: "#ffffff",
    };
  }

  function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hexA(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return "rgba(" + r + "," + g + "," + b + "," + clamp(a, 0, 1) + ")";
  }

  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    t = clamp(t, 0, 1);
    const r = Math.round(A[0] + (B[0] - A[0]) * t);
    const g = Math.round(A[1] + (B[1] - A[1]) * t);
    const bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  function shade(hex, factor) {
    const [r, g, b] = hexToRgb(hex);
    const c = (v) => clamp(Math.round(v * factor), 0, 255);
    return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
  }

  /** Grain déterministe : même tuile = mêmes éclats, pour toujours. */
  function speckle(g, s, variant, color, n, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = (hash2(variant, i, 101) * s) | 0;
      const y = (hash2(variant, i, 211) * s) | 0;
      const sz = hash2(variant, i, 307) > 0.82 ? 2 : 1;
      g.fillRect(x, y, sz, sz);
    }
    g.restore();
  }

  /** Fissure fractale courte — un détail qui fait « pierre taillée ». */
  function crack(g, s, variant, color) {
    g.save();
    g.strokeStyle = color;
    g.globalAlpha = 0.45;
    g.lineWidth = 1;
    g.beginPath();
    let x = s * (0.15 + hash2(variant, 1, 401) * 0.7);
    let y = s * (0.15 + hash2(variant, 2, 409) * 0.7);
    g.moveTo(x, y);
    for (let i = 0; i < 4; i++) {
      x += (hash2(variant, i, 419) - 0.5) * s * 0.4;
      y += (hash2(variant, i, 421) - 0.5) * s * 0.4;
      g.lineTo(x, y);
    }
    g.stroke();
    g.restore();
  }

  NEX.Renderer = Renderer;
  NEX.hexA = hexA;
  NEX.mix = mix;
  NEX.shade = shade;
  NEX.tierTint = tierTint;
  NEX.fitSprite = fitSprite;
  NEX.FOOT_Y = FOOT_Y;
  NEX.FIT = { actor: FIT_ACTOR, boss: FIT_BOSS, item: FIT_ITEM };
})();
