/* ============================================================
   items.js — le sac : consommables et pièces d'équipement
   Chaque objet sait s'appliquer lui-même au héros.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const clamp = NEX.clamp;

  /* ============================================================
     Pièces d'équipement
     ============================================================ */

  let gearUid = 0;

  function Gear(spec) {
    const [slot, tier, name, short, atk, def, hp, crit, dodge, sight, regen, setName] = spec;
    this.kind = "gear";
    this.uid = ++gearUid;
    this.slot = slot;
    this.slotIndex = NEX.SLOT_INDEX[slot];
    this.tier = tier;
    this.name = name;
    this.short = short;
    this.atk = atk; this.def = def; this.hp = hp;
    this.crit = crit; this.dodge = dodge;
    this.sight = sight; this.regen = regen;
    this.setName = setName || "";
    // Un sprite par emplacement : c'est bien plus lisible au sol qu'un
    // cristal générique, et on sait tout de suite ce qu'on ramasse.
    this.sprite = "gear" + slot.charAt(0).toUpperCase() + slot.slice(1);
    this.color = NEX.tierColor(tier);
    this.effect = NEX.describeGear(spec);
  }

  /** Score de puissance : sert à comparer deux pièces d'un même emplacement. */
  Object.defineProperty(Gear.prototype, "score", {
    get() {
      return this.atk * 3 + this.def * 2 + this.hp
        + this.crit * 2 + this.dodge * 2 + this.sight * 2 + this.regen * 2;
    },
  });

  Gear.prototype.tierName = function () { return NEX.tierName(this.tier); };

  /** Vrai si la pièce n'apporte rien face à celle déjà portée. */
  Gear.prototype.outclassedBy = function (current) {
    return !!current && this.score < current.score;
  };

  Gear.prototype.use = function (p, rng, log) {
    const replaced = p.equip(this);
    log(`Tu enfiles ${this.name} (${this.effect}).`, this.color, "loot");
    if (replaced) log(`La ${replaced.name.toLowerCase()} retourne dans le sac.`, "sys");
    return replaced || null;
  };

  function gearSpecsFor(slot) {
    return NEX.GEAR_SPECS.filter((s) => !slot || s[0] === slot);
  }

  /**
   * Tire une pièce : plus on descend, plus le palier est élevé.
   * `forcedTier` sert au butin du boss (toujours de nex).
   */
  function randomGear(rng, depth, slot, forcedTier) {
    const idx = clamp(depth, 1, NEX.TIER_WEIGHTS.length) - 1;
    const weights = NEX.TIER_WEIGHTS[idx];
    const tier = forcedTier || weightedIndex(rng, weights);

    const pool = gearSpecsFor(slot);
    let candidates = pool.filter((s) => s[1] === tier);
    if (!candidates.length) candidates = pool; // ce palier n'existe pas ici
    return new Gear(candidates[rng.int(0, candidates.length - 1)]);
  }

  function weightedIndex(rng, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let roll = rng.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return i + 1;
    }
    return 1;
  }

  /** Les six offres d'un autel : une pièce par emplacement, avec son prix. */
  function forgeOffers(rng, depth) {
    return NEX.SLOTS.map((s) => {
      const item = randomGear(rng, depth, s.id);
      return { item, price: NEX.gearPrice(item.tier, depth) };
    });
  }

  /* ============================================================
     Consommables
     ============================================================ */

  function Potion(greater) {
    this.kind = "potion";
    this.greater = !!greater;
    this.name = greater ? "grand flacon de soin" : "potion de soin";
    this.short = greater ? "grand flacon" : "potion";
    this.sprite = greater ? "bigPotion" : "potion";
    this.color = greater ? "#7ff0ff" : "#5cf0a8";
    this.effect = greater ? "rend 28 à 40 PV" : "rend 12 à 18 PV";
  }
  Potion.prototype.use = function (p, rng, log) {
    const max = this.greater ? 28 : 12;
    const spread = this.greater ? 13 : 7;
    const healed = p.heal(max + rng.int(0, spread - 1));
    log(this.greater
      ? `Le grand flacon te vide d'un coup (+${healed} PV).`
      : `Tu bois la potion (+${healed} PV).`, "good");
    return null;
  };

  function Elixir(kind) {
    const sage = kind === "sage";
    this.kind = "elixir";
    this.name = sage ? "élixir du sage" : "élixir d'âme";
    this.short = sage ? "élixir sage" : "élixir";
    this.sprite = sage ? "sageElixir" : "elixir";
    this.color = sage ? "#bfe6ff" : "#ffd47a";
    this.effect = sage ? "+16 PV max" : "+8 PV max";
    this.sage = sage;
  }
  Elixir.prototype.use = function (p, rng, log) {
    const gain = this.sage ? 16 : 8;
    p.baseMaxHp += gain;
    const healed = p.heal(gain);
    log(this.sage
      ? `Une lumière blanche te remplit. PV max +16 (+${healed} PV).`
      : `L'élixir coule en toi… PV max +8 (+${healed} PV).`, "epic");
    return null;
  };

  function Whetstone() {
    this.kind = "whetstone";
    this.name = "pierre à aiguiser";
    this.short = "aiguisoir";
    this.sprite = "whetstone";
    this.color = "#ffe0a0";
    this.effect = "ATQ +1 définitif";
  }
  Whetstone.prototype.use = function (p, rng, log) {
    p.baseAtk += 1;
    log("Tu aiguises ta lame. ATQ +1.", "good");
    return null;
  };

  function HidePlate() {
    this.kind = "plate";
    this.name = "plaque de cuir bouilli";
    this.short = "plaque";
    this.sprite = "plate";
    this.color = "#e0c48c";
    this.effect = "DFO +1 définitif";
  }
  HidePlate.prototype.use = function (p, rng, log) {
    p.baseDef += 1;
    log("Tu fixes la plaque sur toi. DFO +1.", "good");
    return null;
  };

  function RuneBomb() {
    this.kind = "bomb";
    this.name = "bombe de rune";
    this.short = "bombe";
    this.sprite = "bomb";
    this.color = "#ff8a3b";
    this.effect = "14 à 20 dégâts à tout ce qui te voit";
  }
  RuneBomb.prototype.use = function (p, rng, log) {
    const world = p.world;
    if (!world) return null;
    const victims = world.monsters.filter((m) => m.hp > 0 && world.map.vis(m.x, m.y));
    if (!victims.length) {
      log("La bombe explose dans le vide…", "sys");
      return null;
    }
    for (const m of victims) {
      const dmg = 14 + rng.int(0, 6);
      m.hp -= dmg;
      log(`La rune éclate sur ${cap(m.name)} (-${dmg}).`, "crit");
      world.fx.hitBurst(m.x, m.y, m.glow, dmg);
      if (m.hp <= 0) world.killMonster(m);
    }
    log(`La bombe frappe ${victims.length} ennemi${victims.length > 1 ? "s" : ""} visible${victims.length > 1 ? "s" : ""}.`, "crit");
    return null;
  };

  function TeleportScroll() {
    this.kind = "teleport";
    this.name = "parchemin de téléportation";
    this.short = "téléport";
    this.sprite = "scroll";
    this.color = "#ff5fd2";
    this.effect = "t'apparaît hors de vue";
  }
  TeleportScroll.prototype.use = function (p, rng, log) {
    const world = p.world;
    if (!world) return null;
    for (let i = 0; i < 900; i++) {
      const x = rng.int(0, world.map.w - 1);
      const y = rng.int(0, world.map.h - 1);
      const t = world.map.at(x, y);
      if (!t.passable || t.visible) continue;
      if (world.monsterAt(x, y)) continue;
      world.fx.teleportBurst(p.x, p.y);
      p.x = x; p.y = y;
      world.fx.teleportBurst(x, y);
      log(`Tu disparais dans un éclair et réapparais plus loin.`, "epic");
      return null;
    }
    log("Le sort ne trouve aucun refuge…", "sys");
    return null;
  };

  function MapScroll() {
    this.kind = "map";
    this.name = "parchemin de cartographie";
    this.short = "carte";
    this.sprite = "scroll";
    this.color = "#ffb648";
    this.effect = "révèle tout l'étage";
  }
  MapScroll.prototype.use = function (p, rng, log) {
    const world = p.world;
    if (!world) return null;
    world.map.revealAll();
    log("La carte de l'étage s'allume dans ta mémoire.", "epic");
    return null;
  };

  function GoldPile(amount) {
    this.kind = "gold";
    this.name = amount + " pièces d'or";
    this.short = "or";
    this.sprite = "gold";
    this.color = "#ffd24a";
    this.amount = amount;
    this.effect = "";
  }
  GoldPile.prototype.use = function () { return null; }; // ramassé au sol

  function Amulet() {
    this.kind = "amulet";
    this.name = "Amulette de Nex";
    this.short = "amulette";
    this.sprite = "amulet";
    this.color = "#ff5fd2";
    this.effect = "la victoire";
  }
  Amulet.prototype.use = function () { return null; }; /* remportée au sol */

  /* ============================================================
     Tables de butin
     Chaque entrée : [ poids, fabrique ]
     ============================================================ */

  function lootTableFor(depth) {
    const t = [];
    const add = (w, f) => { if (w > 0) t.push({ w, f }); };

    add(Math.max(9, 38 - depth), () => new Potion(false));
    add(Math.max(6, 24 - Math.floor(depth / 2)), () => new Potion(true));
    add(5, () => new Elixir("soul"));
    add(depth > 6 ? Math.min(8, 2 + Math.floor(depth / 6)) : 0, () => new Elixir("sage"));

    add(14, (rng, d) => new GoldPile(4 + Math.floor(d / 4) + rng.int(0, 8)));

    add(depth > 2 ? Math.min(10, 2 + Math.floor(depth / 5)) : 0, () => new RuneBomb());
    add(depth > 4 ? Math.min(7, Math.floor(depth / 8)) : 0, () => new TeleportScroll());
    add(depth > 5 ? Math.min(6, Math.floor(depth / 9)) : 0, () => new MapScroll());
    add(depth > 1 ? 2 : 0, () => new Whetstone());
    add(depth > 1 ? 2 : 0, () => new HidePlate());

    const gear = 6 + Math.floor(depth / 4);
    add(gear + 2, (rng, d) => randomGear(rng, d, "weapon"));
    add(gear, (rng, d) => randomGear(rng, d, "armor"));
    add(Math.max(2, gear - 1), (rng, d) => randomGear(rng, d, "helmet"));
    add(Math.max(2, gear - 2), (rng, d) => randomGear(rng, d, "boots"));
    add(Math.max(2, gear - 2), (rng, d) => randomGear(rng, d, "ring"));
    add(Math.max(2, gear - 2), (rng, d) => randomGear(rng, d, "talisman"));

    return t;
  }

  function rollLoot(rng, depth, table) {
    let total = 0;
    for (const e of table) total += e.w;
    if (total <= 0) return new Potion(false);
    let roll = rng.next() * total;
    for (const e of table) {
      roll -= e.w;
      if (roll < 0) return e.f(rng, depth);
    }
    return new Potion(false);
  }

  function cap(s) { return s.length ? s[0].toUpperCase() + s.slice(1) : s; }

  NEX.Gear = Gear;
  NEX.randomGear = randomGear;
  NEX.forgeOffers = forgeOffers;
  NEX.Potion = Potion;
  NEX.Elixir = Elixir;
  NEX.Whetstone = Whetstone;
  NEX.HidePlate = HidePlate;
  NEX.RuneBomb = RuneBomb;
  NEX.TeleportScroll = TeleportScroll;
  NEX.MapScroll = MapScroll;
  NEX.GoldPile = GoldPile;
  NEX.Amulet = Amulet;
  NEX.lootTableFor = lootTableFor;
  NEX.rollLoot = rollLoot;
  NEX.cap = cap;
})();
