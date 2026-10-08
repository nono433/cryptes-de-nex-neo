/* ============================================================
   game.js — état, tours, IA, combat, équipement, autels
   Toute la logique. Aucun rendu ici.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const clamp = NEX.clamp;
  const cap = NEX.cap;

  const STATE = {
    TITLE: "title",
    PLAYING: "playing",
    BAG: "bag",
    HERO: "hero",
    FORGE: "forge",
    HELP: "help",
    DEAD: "dead",
    WON: "won",
  };

  const MAX_ITEMS = 9;

  /* ============================================================
     Héros
     ============================================================ */

  class Player {
    constructor() {
      this.name = "l'Éclaireur";
      this.x = 0; this.y = 0;
      this.hp = 30;
      this.level = 1;
      this.xp = 0;
      this.xpNext = 20;
      this.gold = 0;
      this.baseMaxHp = 30;
      this.baseAtk = 5;
      this.baseDef = 1;
      this.gear = new Array(NEX.SLOT_COUNT).fill(null);
      this.bonus = { atk: 0, def: 0, hp: 0, crit: 0, dodge: 0, sight: 0, regen: 0 };
      this.setsActive = [];
      this.bag = [];
      this.world = null;
      this.hurtFlash = 0;
      this.rebuild();
    }

    reset() {
      this.level = 1; this.xp = 0; this.xpNext = 20; this.gold = 0;
      this.baseMaxHp = 30; this.baseAtk = 5; this.baseDef = 1;
      this.gear.fill(null);
      this.bag.length = 0;
      this.hp = this.maxHp;
      this.rebuild();
    }

    get maxHp() { return this.baseMaxHp + this.bonus.hp; }
    get atk() { return this.baseAtk + this.bonus.atk; }
    get def() { return this.baseDef + this.bonus.def; }
    get crit() { return 10 + this.bonus.crit; }      // %
    get dodge() { return 5 + this.bonus.dodge; }     // %
    get sight() { return NEX.BASE_FOV + this.bonus.sight; }
    get regen() { return this.bonus.regen; }
    get alive() { return this.hp > 0; }

    heal(amount) {
      const before = this.hp;
      this.hp = clamp(this.hp + amount, 0, this.maxHp);
      return this.hp - before;
    }

    /**
     * Enfile une pièce et renvoie celle qu'elle remplace.
     *
     * L'ordre compte : on recalcule les bonus AVANT de borner les PV.
     * En faisant l'inverse, on bornait les PV sur l'ancien maximum — et
     * remplacer une armure lourde par une légère laissait le héros avec
     * plus de PV que son maximum réel. Impossible à voir à l'écran, mais
     * les invulnérables existent.
     */
    equip(gear) {
      const old = this.gear[gear.slotIndex];
      this.gear[gear.slotIndex] = gear;
      this.rebuild();
      if (this.hp > this.maxHp) this.hp = this.maxHp;
      return old;
    }

    /** Recalcule les totaux : bonus individuels puis bonus d'ensemble. */
    rebuild() {
      const b = this.bonus;
      b.atk = b.def = b.hp = b.crit = b.dodge = b.sight = b.regen = 0;
      this.setsActive.length = 0;

      for (const g of this.gear) {
        if (!g) continue;
        b.atk += g.atk; b.def += g.def; b.hp += g.hp;
        b.crit += g.crit; b.dodge += g.dodge;
        b.sight += g.sight; b.regen += g.regen;
      }

      for (const key of Object.keys(NEX.SETS)) {
        const set = NEX.SETS[key];
        const have = this.gear.filter((g) => g && g.setName === key).length;
        if (!have) continue;
        for (const step of set.steps) {
          if (have < step.pieces) continue;
          b.atk += step.atk; b.def += step.def; b.hp += step.hp;
          b.crit += step.crit; b.dodge += step.dodge;
          b.sight += step.sight; b.regen += step.regen;
          this.setsActive.push({ set: key, pieces: step.pieces, text: step.text });
        }
      }
    }

    countSet(key) {
      return this.gear.filter((g) => g && g.setName === key).length;
    }
  }

  /* ============================================================
     Monstre
     ============================================================ */

  class Monster {
    constructor(key, x, y, power) {
      const s = NEX.SPECIES[key];
      this.key = key;
      this.name = s.name;
      this.sprite = s.sprite;
      this.scale = s.scale || 1;
      this.glow = s.glow;
      this.isBoss = !!s.boss;
      this.isElite = !!s.elite;
      this.x = x; this.y = y;
      this.bob = Math.random() * 6.28;

      this.maxHp = Math.max(1, Math.round(s.hp * power));
      this.atk = Math.max(1, Math.round(s.atk * power));
      this.def = Math.max(0, Math.round(s.def * power));
      this.xp = Math.max(1, Math.round(s.xp * power));
      this.hp = this.maxHp;

      this.lunge = 0;      // 0..1, animation d'attaque
      this.lungeX = 0;
      this.lungeY = 0;
      this.hurtFlash = 0;
      this.alive = true;
    }
  }

  /* ============================================================
     Partie
     ============================================================ */

  class Game {
    constructor(fx, audio) {
      this.fx = fx;
      this.audio = audio;
      this.onLog = null;     // (texte, couleur, type)
      this.onState = null;   // changement d'état d'interface
      this.logEntries = [];
    }

    /* -------------------------------------------------- nouvelle partie */

    newRun(seed) {
      const s = seed === undefined || seed === null || seed === ""
        ? (Math.random() * 0xffffffff) >>> 0
        : (typeof seed === "number" ? seed >>> 0 : NEX.hashString(String(seed)));
      this.seed = s;
      this.seedLabel = typeof seed === "string" && seed !== "" ? String(seed) : ("#" + s.toString(36));
      this.rng = new NEX.Rng(s);

      this.logEntries.length = 0;
      this.depth = 0;
      this.turn = 0;
      this.kills = 0;
      this.state = STATE.PLAYING;
      this.monsters = [];
      this.floor = [];
      this.offers = [];
      this.endReason = "";

      this.p = new Player();
      this.p.world = this;

      this.buildLevel();

      this.log("Tu pénètres dans les Cryptes de Nex…", "epic");
      this.log(`Descends jusqu'à la profondeur ${NEX.DEPTH_COUNT}, abats le Gardien et prends l'Amulette !`, "sys");
      return this;
    }

    log(text, type) {
      this.logEntries.push({ text, type: type || "plain" });
      if (this.logEntries.length > 300) this.logEntries.shift();
      if (this.onLog) this.onLog(text, type);
    }

    setState(s) {
      if (this.state === s) return;
      this.state = s;
      if (this.onState) this.onState(s);
    }

    get isOverlay() {
      return this.state === STATE.BAG || this.state === STATE.HERO
        || this.state === STATE.FORGE || this.state === STATE.HELP;
    }
    get lastFloor() { return this.depth >= NEX.DEPTH_COUNT; }
    get onStairs() {
      return this.map.hasStairs && this.p.x === this.map.stairs.x && this.p.y === this.map.stairs.y;
    }
    get onAltar() {
      return this.map.altar && this.p.x === this.map.altar.x && this.p.y === this.map.altar.y;
    }

    /* -------------------------------------------------- étages */

    buildLevel() {
      this.depth++;
      const decor = NEX.decorFor(this.depth);
      this.decor = decor;
      this.lootTable = NEX.lootTableFor(this.depth);

      this.map = NEX.Dungeon.generate(this.rng, decor, this.depth, !this.lastFloor);
      this.monsters.length = 0;
      this.floor.length = 0;
      this.offers.length = 0;

      const start = this.map.rooms[0];
      this.p.x = start.cx;
      this.p.y = start.cy;
      this.p.hurtFlash = 0;

      this.spawnMonsters();
      this.spawnItems();
      this.map.computeFov(this.p.x, this.p.y, this.p.sight);

      this.log(`PROFONDEUR ${this.depth}/${NEX.DEPTH_COUNT} — ${decor.name}`, "sys");
      this.log(decor.tagline, "plain");

      if (decor.altar) this.log("Un autel de pierre t'attend au fond de l'étage.", "sys");
      if (this.lastFloor) this.log("Plus aucune issue : seule l'Amulette ouvre la voie.", "epic");

      if (this.onLevel) this.onLevel(this.depth, decor);
    }

    descend() {
      this.buildLevel();
      const healed = this.p.heal(Math.max(1, Math.floor(this.p.maxHp / 4)) + this.p.regen);
      this.log(`Tu descends plus profond (+${healed} PV).`, "good");
      this.audio.play("descend");
      this.fx.descendFlash(this.p.x, this.p.y);
    }

    /* -------------------------------------------------- apparitions */

    isFree(x, y, minDist) {
      if (!this.map.isPassable(x, y)) return false;
      const t = this.map.at(x, y);
      if (t.type === NEX.TILE.ALTAR || t.type === NEX.TILE.TORCH) return false;
      if (this.map.hasStairs && x === this.map.stairs.x && y === this.map.stairs.y) return false;
      if (x === this.p.x && y === this.p.y) return false;
      if (Math.abs(x - this.p.x) + Math.abs(y - this.p.y) < minDist) return false;
      if (this.monsterAt(x, y)) return false;
      if (this.floor.some((f) => f.x === x && f.y === y)) return false;
      return true;
    }

    freeCellIn(room, minDist) {
      for (let tries = 0; tries < 70; tries++) {
        const x = this.rng.int(room.x, room.x + room.w - 1);
        const y = this.rng.int(room.y, room.y + room.h - 1);
        if (this.isFree(x, y, minDist)) return { x, y };
      }
      return null;
    }

    randomSpawnSpot() {
      for (let tries = 0; tries < 40; tries++) {
        const room = this.map.rooms[this.rng.int(1, this.map.rooms.length - 1)];
        const cell = this.freeCellIn(room, 5);
        if (cell) return cell;
      }
      return null;
    }

    spawnMonsters() {
      const table = this.decor.monsters;
      const power = NEX.powerScale(this.depth);

      let count = Math.min(11, 4 + Math.floor(this.depth / 4)) + this.rng.int(0, 2);
      if (this.lastFloor) count = 8 + this.rng.int(0, 2);

      for (let i = 0; i < count; i++) {
        const spot = this.randomSpawnSpot();
        if (!spot) break;
        this.monsters.push(new Monster(
          this.rng.pick(table), spot.x, spot.y, power));
      }

      // Une élite tous les dix étages : elle garde l'escalier.
      if (NEX.hasEliteAt(this.depth) && this.map.rooms.length) {
        const stairRoom = this.map.hasStairs
          ? this.map.rooms.find((r) => r.cx === this.map.stairs.x && r.cy === this.map.stairs.y)
          : this.map.rooms[this.map.rooms.length - 1];
        if (stairRoom) {
          const spot = this.freeCellIn(stairRoom, 2) || { x: stairRoom.cx, y: stairRoom.cy };
          this.monsters.push(new Monster("shaman", spot.x, spot.y, NEX.elitePower(this.depth)));
          this.log("Quelque chose d'os et d'or se redresse sur l'escalier…", "epic");
          this.audio.play("elite");
        }
      }

      if (this.lastFloor) {
        const last = this.map.rooms[this.map.rooms.length - 1];
        const spot = this.freeCellIn(last, 0) || { x: last.cx, y: last.cy };
        this.monsters.push(new Monster("boss", spot.x, spot.y, NEX.elitePower(this.depth)));
        this.log("Une ombre colossale rôde plus bas…", "epic");
        this.audio.play("boss");
      }
    }

    spawnItems() {
      // Une potion offerte tout de suite, pour ne pas mourir d'incompréhension.
      if (this.depth === 1) {
        const cell = this.freeCellIn(this.map.rooms[0], 3);
        if (cell) this.floor.push({ x: cell.x, y: cell.y, item: new NEX.Potion(false) });
      }
      for (let i = 0; i < this.decor.items; i++) {
        const room = this.rng.pick(this.map.rooms);
        const cell = this.freeCellIn(room, 4);
        if (!cell) continue;
        this.floor.push({ x: cell.x, y: cell.y, item: NEX.rollLoot(this.rng, this.depth, this.lootTable) });
      }
    }

    monsterAt(x, y) {
      for (const m of this.monsters) if (m.alive && m.x === x && m.y === y) return m;
      return null;
    }

    floorItemAt(x, y) {
      for (let i = this.floor.length - 1; i >= 0; i--)
        if (this.floor[i].x === x && this.floor[i].y === y) return i;
      return -1;
    }

    /* -------------------------------------------------- déplacement */

    tryMove(dx, dy) {
      const nx = this.p.x + dx, ny = this.p.y + dy;
      if (!this.map.isPassable(nx, ny)) {
        this.audio.play("bump");
        this.fx.bump(this.p.x, this.p.y);
        return false;
      }

      const monster = this.monsterAt(nx, ny);
      if (monster) {
        this.playerAttack(monster, dx, dy);
        this.endTurn();
        return true;
      }

      this.p.x = nx;
      this.p.y = ny;
      this.fx.stepPuff(nx, ny);

      const t = this.map.at(nx, ny);
      if (t.type === NEX.TILE.STAIRS) this.log("Un escalier descend ici : appuie sur > pour continuer.", "sys");
      else if (t.type === NEX.TILE.ALTAR) this.log("Un autel : appuie sur X pour y commercer.", "sys");
      else if (t.type === NEX.TILE.TRAP) this.triggerTrap(nx, ny);

      this.pickupAt(nx, ny);
      this.endTurn();
      return true;
    }

    triggerTrap(x, y) {
      this.map.disarmTrap(x, y);
      const dmg = this.damage(7 + this.depth * 3, Math.max(0, this.p.def - 2));
      this.p.hp -= dmg;
      this.fx.trapBurst(x, y);
      this.fx.shake(7, 340);
      this.audio.play("trap");
      this.log(`Un piège de crêtes jaillit du sol (-${dmg} PV).`, "hurt");
    }

    /* -------------------------------------------------- ramassage */

    /**
     * Ramasse TOUS les objets posés sur la case : après la mort du Gardien,
     * l'amulette ET sa récompense sont au même endroit ; n'en prendre qu'un
     * obligerait le joueur à repartir et revenir — c'est un piège.
     */
    pickupAt(x, y) {
      let guard = 0;
      while (guard++ < 32) {
        const i = this.floorItemAt(x, y);
        if (i < 0) return;
        if (!this.pickupOne(this.floor[i].item, x, y)) {
          // sac plein ou pièce dépassée : on arrête, l'objet reste par terre
          return;
        }
        this.floor.splice(i, 1);
        if (this.state !== NEX.STATE.PLAYING) return;
      }
    }

    /** Applique le ramassage d'un objet. Renvoie false s'il reste au sol. */
    pickupOne(item, x, y) {
      if (item.kind === "amulet") {
        this.log("Tu saisis l'Amulette de Nex : les cryptes s'effondrent !", "epic");
        this.fx.victoryBurst(x, y);
        this.audio.play("win");
        this.win();
        return true;
      }

      if (item.kind === "gold") {
        this.p.gold += item.amount;
        this.fx.pickup(x, y, "#ffd24a");
        this.audio.play("gold");
        this.log(`Tu ramasses ${item.amount} pièces d'or.`, "loot");
        return true;
      }

      // Une pièce déjà dépassée ne mérite pas de place dans le sac.
      if (item.kind === "gear" && item.outclassedBy(this.p.gear[item.slotIndex])) {
        this.log(`La ${item.name.toLowerCase()} ne vaut rien face à ${this.p.gear[item.slotIndex].name} : tu la laisses.`, "sys");
        return true;
      }

      if (this.p.bag.length >= MAX_ITEMS) {
        this.log("Ton sac est plein !", "bad");
        this.audio.play("deny");
        return false;
      }

      this.p.bag.push(item);
      this.fx.pickup(x, y, item.color);
      this.audio.play("pickup");
      this.log(`Tu prends : ${item.name}.`, "loot");
      return true;
    }

    /** Retire du sac les pièces qui ne valent rien face à celles portées. */
    purgeOutclassed() {
      const junk = [];
      for (let i = this.p.bag.length - 1; i >= 0; i--) {
        const it = this.p.bag[i];
        if (it.kind === "gear" && it.outclassedBy(this.p.gear[it.slotIndex])) junk.push(it);
      }
      for (const it of junk) {
        this.p.bag.splice(this.p.bag.indexOf(it), 1);
        this.log(`La ${it.name.toLowerCase()} est dépassée par ${this.p.gear[it.slotIndex].name} : supprimée du sac.`, "sys");
      }
      return junk;
    }

    useBagItem(index) {
      if (index < 0 || index >= this.p.bag.length) return false;
      const item = this.p.bag[index];

      // Enfiler une pièce plus faible n'aurait aucun intérêt : on la jette.
      if (item.kind === "gear" && item.outclassedBy(this.p.gear[item.slotIndex])) {
        this.p.bag.splice(index, 1);
        this.log(`La ${item.name.toLowerCase()} est moins bonne que ${this.p.gear[item.slotIndex].name} : tu la jettes.`, "sys");
        return true;
      }

      const replaced = item.use(this.p, this.rng, (t, c) => this.log(t, c));
      this.p.bag.splice(index, 1);

      if (replaced) {
        if (this.p.bag.length < MAX_ITEMS) this.p.bag.push(replaced);
        else this.floor.push({ x: this.p.x, y: this.p.y, item: replaced });
      }

      this.purgeOutclassed();
      this.p.hp = Math.min(this.p.hp, this.p.maxHp);
      this.map.computeFov(this.p.x, this.p.y, this.p.sight);
      return true;
    }

    /* -------------------------------------------------- autel */

    openForge() {
      if (!this.onAltar) {
        this.log("Il faut monter sur un autel pour commercer.", "sys");
        this.audio.play("deny");
        return;
      }
      this.offers = NEX.forgeOffers(this.rng, this.depth);
      this.setState(STATE.FORGE);
      this.log("L'autel gronde et te propose six pièces.", "epic");
      this.audio.play("forge");
    }

    buyOffer(index) {
      if (index < 0 || index >= this.offers.length) return false;
      const offer = this.offers[index];
      if (this.p.gold < offer.price) {
        this.log(`Il te faut ${offer.price} pièces d'or (tu en as ${this.p.gold}).`, "bad");
        this.audio.play("deny");
        return false;
      }

      this.p.gold -= offer.price;
      const replaced = this.p.equip(offer.item);
      this.offers.splice(index, 1);
      this.purgeOutclassed();

      this.log(`Tu achètes ${offer.item.name} pour ${offer.price} or.`, offer.item.color);
      this.fx.equipFlash(this.p.x, this.p.y, offer.item.tier);
      this.audio.play("buy");
      if (replaced) this.log(`La ${replaced.name.toLowerCase()} retourne dans le sac.`, "sys");
      return true;
    }

    closeForge() {
      this.setState(STATE.PLAYING);
      this.offers.length = 0;
      this.endTurn();
    }

    /* -------------------------------------------------- tour */

    wait() {
      this.log("Tu attends…", "sys");
      this.endTurn();
    }

    endTurn() {
      this.turn++;
      this.map.computeFov(this.p.x, this.p.y, this.p.sight);
      if (this.state === STATE.PLAYING) this.monsterTurn();
      this.map.computeFov(this.p.x, this.p.y, this.p.sight);

      if (!this.p.alive && this.state === STATE.PLAYING) this.die();
    }

    monsterTurn() {
      for (const m of this.monsters) {
        if (!m.alive || this.state !== STATE.PLAYING) continue;
        if (this.map.vis(m.x, m.y)) this.chase(m);
        else this.wander(m);
      }
    }

    chase(m) {
      const p = this.p;
      const dx = Math.sign(p.x - m.x);
      const dy = Math.sign(p.y - m.y);

      if (Math.abs(p.x - m.x) + Math.abs(p.y - m.y) === 1) {
        this.monsterAttack(m, dx, dy);
        return;
      }

      const candidates = Math.abs(p.x - m.x) >= Math.abs(p.y - m.y)
        ? [[dx, 0], [0, dy]]
        : [[0, dy], [dx, 0]];

      for (const [ax, ay] of candidates) {
        if (!ax && !ay) continue;
        const nx = m.x + ax, ny = m.y + ay;
        if (nx === p.x && ny === p.y) { this.monsterAttack(m, -ax, -ay); return; }
        if (this.stepIsValid(m, nx, ny)) { m.x = nx; m.y = ny; return; }
      }
    }

    wander(m) {
      if (!this.rng.chance(35)) return;
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const [dx, dy] = this.rng.pick(dirs);
      if (this.stepIsValid(m, m.x + dx, m.y + dy)) { m.x += dx; m.y += dy; }
    }

    stepIsValid(m, x, y) {
      if (!this.map.isPassable(x, y)) return false;
      if (x === this.p.x && y === this.p.y) return false;
      return !this.monsters.some((o) => o !== m && o.alive && o.x === x && o.y === y);
    }

    /* -------------------------------------------------- combat */

    damage(atk, def) {
      return Math.max(1, atk + this.rng.int(0, 2) - def);
    }

    playerAttack(m, dx, dy) {
      if (dx === undefined) {
        dx = Math.sign(m.x - this.p.x);
        dy = Math.sign(m.y - this.p.y);
      }
      m.lunge = 1; m.lungeX = -dx; m.lungeY = -dy;

      let dmg = this.damage(this.p.atk, m.def);
      const crit = this.rng.chance(this.p.crit);
      if (crit) dmg *= 2;

      m.hp -= dmg;
      m.hurtFlash = 1;
      this.fx.hitBurst(m.x, m.y, crit ? "#ffd45e" : m.glow, dmg, crit);
      this.fx.shake(crit ? 9 : 5, crit ? 320 : 180);
      this.audio.play(crit ? "crit" : "hit");

      this.log(`Tu frappes ${cap(m.name)} (-${dmg})${crit ? "  COUP CRITIQUE !" : ""}`,
        crit ? "crit" : "plain");

      if (m.hp <= 0) this.killMonster(m);
    }

    monsterAttack(m, dx, dy) {
      m.lunge = 1; m.lungeX = dx; m.lungeY = dy;

      if (this.rng.chance(this.p.dodge)) {
        this.log(`Tu esquives l'attaque de ${cap(m.name)}.`, "good");
        this.fx.dodgePuff(this.p.x, this.p.y);
        this.audio.play("dodge");
        return;
      }

      const dmg = this.damage(m.atk, this.p.def);
      this.p.hp -= dmg;
      this.p.hurtFlash = 1;
      this.fx.playerHurt(this.p.x, this.p.y, dmg);
      this.fx.shake(11, 380);
      this.audio.play("hurt");
      this.log(`${cap(m.name)} te frappe (-${dmg}).`, "hurt");
    }

    killMonster(m) {
      const i = this.monsters.indexOf(m);
      if (i >= 0) this.monsters.splice(i, 1);
      m.alive = false;
      this.kills++;
      this.fx.deathBurst(m.x, m.y, m.glow);
      this.log(`${cap(m.name)} s'effondre ! (+${m.xp} XP)`, "good");

      this.p.xp += m.xp;
      while (this.p.xp >= this.p.xpNext) {
        this.p.xp -= this.p.xpNext;
        this.p.level++;
        this.p.baseMaxHp += 7;
        this.p.hp = this.p.maxHp;
        this.p.baseAtk += 1;
        this.p.baseDef += 1;
        // Courbe quadratique : en linéaire on obtenait un niveau 61, sans tension.
        const l = this.p.level - 1;
        this.p.xpNext = 25 + 26 * l + 6 * l * l;
        this.log(`NIVEAU ${this.p.level} ! PV max +7, ATQ +1, DFO +1.`, "epic");
        this.fx.levelUp(this.p.x, this.p.y, this.p.level);
        this.audio.play("level");
      }

      if (m.isBoss) {
        this.floor.push({ x: m.x, y: m.y, item: new NEX.Amulet() });
        this.log("L'Amulette de Nex tombe à terre !", "epic");
        const reward = NEX.randomGear(this.rng, NEX.DEPTH_COUNT, null, NEX.MAX_TIER);
        this.floor.push({ x: m.x, y: m.y, item: reward });
        this.log(`Le Gardien laisse aussi ${reward.name}…`, "loot");
        return;
      }

      if (this.rng.chance(38)) {
        const coins = 4 + this.depth * 4 + this.rng.int(0, 8);
        this.p.gold += coins;
        this.log(`Tu ramasses ${coins} pièces d'or.`, "loot");
        this.audio.play("gold");
      }

      // Butin : garanti pour une élite, aléatoire sinon.
      const drop = m.isElite ? 100 : 12 + this.depth * 2;
      if (this.rng.chance(drop)) {
        const gear = NEX.randomGear(this.rng, this.depth);
        this.floor.push({ x: m.x, y: m.y, item: gear });
        this.log(`Tu récupères : ${gear.name}.`, gear.tier >= 3 ? "epic" : "loot");
      }
    }

    /* -------------------------------------------------- fin */

    die() {
      this.endReason = this.kills > 60
        ? "Tant de ripes — et pourtant, insuffisant."
        : this.depth >= NEX.DEPTH_COUNT - 5
          ? "Presque au fond. Presque."
          : "Les cryptes gardent ce qu'elles prennent.";
      this.setState(STATE.DEAD);
      this.fx.shake(20, 700);
      this.audio.play("death");
      this.log("Tu meurs dans les cryptes…", "bad");
    }

    win() {
      this.setState(STATE.WON);
      this.log("L'Amulette est à toi. Nex recule.", "epic");
    }

    /* -------------------------------------------------- requêtes d'aide */

    /** Stats finales affichées à l'écran de fin. */
    finalStats() {
      return [
        ["PROFONDEUR", this.depth + " / " + NEX.DEPTH_COUNT],
        ["NIVEAU", this.p.level],
        ["ABATTUS", this.kills],
        ["OR", this.p.gold],
        ["ÉQUIPEMENT", this.p.gear.filter(Boolean).length + " / 6"],
        ["TOURS", this.turn],
      ];
    }
  }

  NEX.STATE = STATE;
  NEX.Player = Player;
  NEX.Monster = Monster;
  NEX.Game = Game;
  NEX.MAX_ITEMS = MAX_ITEMS;
})();
