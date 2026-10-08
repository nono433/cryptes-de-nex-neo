/* ============================================================
   data.js — le contenu du jeu
   Les quarante profondeurs, le bestiaire, l'équipement,
   les ensembles et les palettes de décor par bande.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const clamp = NEX.clamp;

  /* ============================================================
     BESTIAIRE
     ============================================================ */

  const SPECIES = {
    rat:    { name: "le rat",                    sprite: "rat",    hp: 6,  atk: 2,  def: 0, xp: 5,   glow: "#7a6a55", scale: 1 },
    spider: { name: "l'araignée",                sprite: "spider", hp: 9,  atk: 3,  def: 0, xp: 9,   glow: "#c44bd0", scale: 1 },
    goblin: { name: "le gobelin",                sprite: "goblin", hp: 14, atk: 4,  def: 1, xp: 15,  glow: "#7fc14a", scale: 1 },
    skeleton: { name: "le squelette",            sprite: "skeleton", hp: 18, atk: 5, def: 2, xp: 22,  glow: "#7fe8ff", scale: 1 },
    orc:    { name: "l'orc",                     sprite: "orc",    hp: 26, atk: 7,  def: 3, xp: 32,  glow: "#ff7a3b", scale: 1 },
    wraith: { name: "le spectre",                sprite: "wraith", hp: 24, atk: 8,  def: 1, xp: 42,  glow: "#8ff2ee", scale: 1 },
    golem:  { name: "le goleme de pierre",       sprite: "golem",  hp: 46, atk: 10, def: 6, xp: 105, glow: "#ff9a3b", scale: 1 },
    lich:   { name: "le nécromancien",           sprite: "lich",   hp: 36, atk: 11, def: 3, xp: 90,  glow: "#c6ff4a", scale: 1 },
    shade:  { name: "le seigneur des ombres",    sprite: "shade",  hp: 52, atk: 13, def: 4, xp: 165, glow: "#ff2f6b", scale: 1 },
    shaman: { name: "la prêtresse des os",       sprite: "shaman", hp: 52, atk: 10, def: 3, xp: 190, elite: true,  glow: "#ffd24a", scale: 1.15 },
    boss:   { name: "le Gardien de l'Amulette",  sprite: "boss",   hp: 110, atk: 14, def: 5, xp: 800, boss: true, glow: "#ff5fd2", scale: 1.7 },
  };

  /* Les huit cohortes, de la plus faible à la plus forte. */
  const BANDS = [
    ["rat", "spider"],
    ["spider", "goblin"],
    ["goblin", "skeleton"],
    ["skeleton", "orc"],
    ["orc", "wraith"],
    ["wraith", "golem"],
    ["golem", "lich"],
    ["lich", "shade"],
  ];

  /* ============================================================
     LES QUARANTE PROFONDEURS
     ============================================================ */

  const FLOORS = [
    ["Les Marches Noyées", "L'eau froide suinte le long des murs."],
    ["La Galerie des Ratiers", "Des griffures fraîches couvrent la pierre."],
    ["Le Cloître des Os", "Les crânes t'observent depuis leurs niches."],
    ["Les Fosses de Cendre", "L'air est si épais qu'il respire presque solide."],
    ["Le Labyrinthe de Verre", "Quelque chose garde l'escalier, et ce n'est pas un rat."],
    ["La Forge Engloutie", "L'enclume frappe encore, toute seule, dans le noir."],
    ["Le Coeur des Racines", "Les racines boivent ton sang à travers la pierre."],
    ["La Crypte des Spectres", "Le silence a un goût de cendre et de verre."],
    ["Le Seuil Interdit", "Nex te regarde depuis l'autre côté du mur."],
    ["Le Sanctuaire Brisé", "Le Gardien est tombé ici. Le temple s'en souvient."],

    ["La Galerie des Mille Yeux", "Chaque pierre porte un oeil. Aucun ne cligne."],
    ["Les Puits de Cendre", "On y souffle et la cendre remonte en bouffées."],
    ["Le Cloître des Noyés", "Des corps très anciens sont alignés sur les murs."],
    ["L'Enclos des Bêtes", "Les bêtes des près ont été amenées ici une par une."],
    ["La Forge des Clameurs", "Chaque marteau qui tombe est un cri."],
    ["Le Pont des Arches", "Le sol manque par endroits. Ne te presse pas."],
    ["La Bibliothèque Pourrie", "Les livres se retournent seuls quand tu tournes le dos."],
    ["Les Racines Noyées", "L'eau est noire ici, et elle bouge."],
    ["L'Ossuaire des Rois", "Des couronnes pourries, encore posé sur des crânes."],
    ["La Grande Descente", "L'escalier ne mène nulle part. Nex le sait."],

    ["Le Givre Noir", "Le gel colle la lave à la pierre."],
    ["Les Ruines de Karastor", "Une cité tombée, puis solidifiée par les caves."],
    ["La Forge du Vide", "L'enclume forge dans le vide. Ne la touche pas."],
    ["Les Racines de Cendre", "La forêt est morte. Ses racines marchent quand même."],
    ["La Crypte de la Mienne", "Tu creuses depuis longtemps. La pierre sourit."],
    ["Les Marées Noires", "La marée monte quand tu n'as pas regardé."],
    ["Le Sanctuaire Miroir", "Ton reflet bouge une seconde trop tard."],
    ["Les Enclumes Folles", "Elles se cognent entre elles, sans raison."],
    ["Les Écheances Immortelles", "On ne devrait pas être encore debout ici."],
    ["Le Seuil de la Quatrième Porte", "Quatre portes. Trois sont fermées depuis longtemps."],

    ["La Faille de Rien", "La carte s'arrête ici. Toi non."],
    ["Les Racines de Verre", "Elles sonnent creux quand on les coupe."],
    ["La Forge des Ténèbres", "La fumée est noire et elle descend."],
    ["Le Cloître des Fantômes", "Ils comptaient. Ils comptent encore."],
    ["La Descente Éternelle", "C'est ici que les autres se sont arrêtés."],
    ["Le Coeur de la Montagne", "La pierre bat un peu, comme un coeur."],
    ["Les Racines du Monde", "Elles entourent déjà tes propres os."],
    ["La Crypte du Destructeur", "Quelque chose a brisé tout ce qu'il y avait ici."],
    ["L'Ossuaire Final", "Plus un corps debout. Plus un survivant non plus."],
    ["Le Sanctuaire de Nex", "L'Amulette est ici. Il n'y a plus d'issue."],
  ];

  const DEPTH_COUNT = FLOORS.length;

  /* ============================================================
     PALETTES DE DÉCOR — une par bande de quatre profondeurs.
     C'est ce qui donne à chaque étage sa « couleur ».
     ============================================================ */

  const PALETTES = [
    { // 1-4 : les marches noyées
      name: "marais",
      floor: "#2b3a3a", floor2: "#243130", grout: "#1a2525",
      wall: "#1b2624", wallTop: "#26332f", wallEdge: "#0d1413",
      water: "#1f6f9c", waterHi: "#63d2f2",
      accent: "#5de3ff", fog: "#0a1a1c", dust: "#9fd8e0",
    },
    { // 5-8 : la galerie des ratiers
      name: "ratier",
      floor: "#38342a", floor2: "#312e25", grout: "#221f18",
      wall: "#221f18", wallTop: "#312c22", wallEdge: "#0f0e0a",
      water: "#2a5a3c", waterHi: "#7fd8a0",
      accent: "#ffb648", fog: "#161208", dust: "#e0c48c",
    },
    { // 9-12 : le cloître des os
      name: "os",
      floor: "#3a3833", floor2: "#33312c", grout: "#232220",
      wall: "#262420", wallTop: "#38352e", wallEdge: "#100f0e",
      water: "#3a5a6a", waterHi: "#8fd0e6",
      accent: "#ded7c1", fog: "#141310", dust: "#f0e8d4",
    },
    { // 13-16 : les fosses de cendre
      name: "cendre",
      floor: "#3a332e", floor2: "#322b27", grout: "#221d1a",
      wall: "#241f1b", wallTop: "#3a312b", wallEdge: "#100d0b",
      water: "#7a3a12", waterHi: "#ffb648",
      accent: "#ff7a3b", fog: "#1a1210", dust: "#ffcf9a",
    },
    { // 17-20 : le labyrinthe de verre
      name: "verre",
      floor: "#2e3540", floor2: "#282e38", grout: "#1b2029",
      wall: "#1c222c", wallTop: "#2b3441", wallEdge: "#0c0f14",
      water: "#2f6fa8", waterHi: "#a8e4ff",
      accent: "#7fe8ff", fog: "#0c1420", dust: "#cfeaff",
    },
    { // 21-24 : la forge engloutie
      name: "forge",
      floor: "#3b2f2a", floor2: "#332823", grout: "#231b17",
      wall: "#261c18", wallTop: "#42302a", wallEdge: "#120c0a",
      water: "#8a2a10", waterHi: "#ff8a3b",
      accent: "#ff6a2a", fog: "#1e0f08", dust: "#ffb07a",
    },
    { // 25-28 : le coeur des racines
      name: "racines",
      floor: "#2f3626", floor2: "#28301f", grout: "#1a2015",
      wall: "#1e2418", wallTop: "#303a24", wallEdge: "#0c100a",
      water: "#2f6a3a", waterHi: "#8fe0a0",
      accent: "#9ade6a", fog: "#0f1409", dust: "#cfe8a0",
    },
    { // 29-32 : la crypte des spectres
      name: "spectres",
      floor: "#2c3242", floor2: "#252b39", grout: "#181c26",
      wall: "#1a1f2c", wallTop: "#29303f", wallEdge: "#0a0d14",
      water: "#3a5a8a", waterHi: "#8ff2ee",
      accent: "#8ff2ee", fog: "#0a0e18", dust: "#d0fffb",
    },
    { // 33-36 : le seuil interdit
      name: "seuil",
      floor: "#382a3a", floor2: "#302431", grout: "#1f1720",
      wall: "#231a26", wallTop: "#342738", wallEdge: "#0f0a11",
      water: "#6a2a7a", waterHi: "#e08aff",
      accent: "#ff5fd2", fog: "#160a1c", dust: "#f5c8ff",
    },
    { // 37-40 : le sanctuaire de Nex
      name: "nex",
      floor: "#3d3038", floor2: "#342a31", grout: "#221a1e",
      wall: "#2a1f26", wallTop: "#43303c", wallEdge: "#120c10",
      water: "#7a1a5a", waterHi: "#ff8ae0",
      accent: "#a06bff", fog: "#180a16", dust: "#ecd0ff",
    },
  ];

  function paletteFor(depth) {
    return PALETTES[clamp(Math.floor((depth - 1) / 4), 0, PALETTES.length - 1)];
  }

  /* ============================================================
     ÉQUIPEMENT
     ============================================================ */

  const SLOTS = [
    { id: "weapon",   label: "Arme",    glyph: "🗡" },
    { id: "armor",    label: "Armure",  glyph: "🛡" },
    { id: "helmet",   label: "Casque",  glyph: "⛑" },
    { id: "boots",    label: "Bottes",  glyph: "👢" },
    { id: "ring",     label: "Anneau",  glyph: "💍" },
    { id: "talisman", label: "Talisman",glyph: "🔮" },
  ];

  const SLOT_INDEX = {};
  SLOTS.forEach((s, i) => (SLOT_INDEX[s.id] = i));
  const SLOT_COUNT = SLOTS.length;

  const TIER_NAMES = ["commun", "rare", "épique", "de nex"];
  const TIER_COLORS = ["#9aa2c4", "#5aa9ff", "#ff6ad5", "#ffd45e"];
  const TIER_GLOW = ["rgba(154,162,196,.35)", "rgba(90,169,255,.55)",
                    "rgba(255,106,213,.6)", "rgba(255,212,94,.7)"];
  const MAX_TIER = 4;

  function tierName(t) { return TIER_NAMES[clamp(t, 1, 4) - 1]; }
  function tierColor(t) { return TIER_COLORS[clamp(t, 1, 4) - 1]; }
  function tierGlow(t) { return TIER_GLOW[clamp(t, 1, 4) - 1]; }

  // slot, tier, nom, court, atq, dfo, pv, crit, esq, vue, regen, ensemble
  const GEAR_SPECS = [
    // --- Arme
    ["weapon", 1, "Épée rouillée", "épée", 2, 0, 0, 0, 0, 0, 0, ""],
    ["weapon", 2, "Lame d'acier", "lame", 4, 0, 0, 0, 3, 0, 0, ""],
    ["weapon", 3, "Fendoir de brume", "fendoir", 7, 0, 4, 5, 0, 0, 0, ""],
    ["weapon", 4, "Tranchant de Nex", "tranchant", 12, 0, 8, 8, 0, 1, 0, "nex"],

    // --- Armure
    ["armor", 1, "Tunique de cuir", "tunique", 0, 2, 6, 0, 0, 0, 0, ""],
    ["armor", 2, "Plastron de fer", "plastron", 0, 4, 12, 0, 0, 0, 0, ""],
    ["armor", 3, "Cuirasse du fondeur", "cuirasse", 1, 6, 20, 0, 0, 0, 0, "fondeur"],
    ["armor", 4, "Manteau de Nex", "manteau", 2, 9, 32, 0, 4, 0, 0, "nex"],

    // --- Casque
    ["helmet", 1, "Capuche rapiécée", "capuche", 0, 1, 2, 0, 0, 1, 0, ""],
    ["helmet", 2, "Heaume de cendre", "heaume", 0, 3, 4, 0, 0, 1, 0, "cendre"],
    ["helmet", 3, "Couronne d'os", "couronne", 0, 5, 6, 2, 0, 2, 0, ""],
    ["helmet", 4, "Diadème de Nex", "diadème", 1, 7, 10, 3, 0, 3, 0, "nex"],

    // --- Bottes
    ["boots", 1, "Bottes usées", "bottes", 0, 1, 0, 0, 3, 0, 0, ""],
    ["boots", 2, "Bottes de cendre", "bottes", 0, 3, 2, 0, 4, 0, 1, "cendre"],
    ["boots", 3, "Sandales du vent", "sandales", 0, 4, 4, 0, 6, 2, 0, ""],
    ["boots", 4, "Souliers spectraux", "souliers", 0, 6, 6, 0, 9, 4, 0, "nex"],

    // --- Anneau
    ["ring", 1, "Anneau de cuivre", "anneau", 1, 0, 4, 0, 0, 0, 0, ""],
    ["ring", 2, "Bague d'obsidienne", "bague", 3, 1, 8, 2, 0, 0, 0, ""],
    ["ring", 3, "Anneau de cendre", "anneau", 5, 2, 12, 3, 0, 0, 0, "cendre"],
    ["ring", 4, "Sceau du vortex", "sceau", 9, 3, 20, 5, 5, 0, 0, "nex"],

    // --- Talisman
    ["talisman", 1, "Talisman fané", "talisman", 0, 0, 8, 0, 0, 0, 1, ""],
    ["talisman", 2, "Parchemin de garde", "parchemin", 0, 2, 14, 0, 2, 0, 0, ""],
    ["talisman", 3, "Sceau de la forge", "sceau", 4, 3, 16, 0, 0, 0, 1, "fondeur"],
    ["talisman", 4, "Sceau de Nex", "sceau", 6, 5, 24, 3, 0, 1, 3, "nex"],
  ];

  const SETS = {
    cendre: {
      label: "cendre", color: "#b8c4e0",
      steps: [
        { pieces: 2, atk: 0, def: 2, hp: 0, crit: 0, dodge: 0, sight: 0, regen: 0, text: "DFO +2" },
        { pieces: 3, atk: 3, def: 0, hp: 6, crit: 0, dodge: 0, sight: 0, regen: 0, text: "ATQ +3, PV +6" },
      ],
    },
    fondeur: {
      label: "fondeur", color: "#ff9a3b",
      steps: [
        { pieces: 2, atk: 0, def: 0, hp: 15, crit: 0, dodge: 0, sight: 0, regen: 0, text: "PV max +15" },
        { pieces: 3, atk: 4, def: 2, hp: 0, crit: 0, dodge: 3, sight: 0, regen: 0, text: "ATQ +4, DFO +2, ESQ +3%" },
      ],
    },
    nex: {
      label: "nex", color: "#ff5fd2",
      steps: [
        { pieces: 2, atk: 3, def: 3, hp: 0, crit: 0, dodge: 0, sight: 0, regen: 0, text: "ATQ +3, DFO +3" },
        { pieces: 4, atk: 0, def: 0, hp: 25, crit: 10, dodge: 0, sight: 2, regen: 0, text: "PV max +25, CRIT +10%, VUE +2" },
      ],
    },
  };

  /* Probabilités de palier selon la profondeur (colonnes T1..T4). */
  const TIER_WEIGHTS = [
    [70, 28, 2, 0],
    [60, 33, 7, 0],
    [45, 38, 15, 2],
    [32, 40, 24, 4],
    [22, 40, 31, 7],
    [14, 36, 39, 11],
    [8, 30, 45, 17],
    [5, 24, 48, 23],
    [3, 18, 50, 29],
    [2, 12, 50, 36],
  ];

  /* ============================================================
     RÈGLES DE PROFONDEUR
     ============================================================ */

  /** Multiplicateur de puissance des monstres selon la profondeur. */
  function powerScale(depth) {
    const d = clamp(depth, 1, DEPTH_COUNT);
    if (d <= 8) return 1 + (d - 1) * 0.035;
    const extra = d - 8;
    return 1.245 + extra * 0.112 + Math.max(0, extra - 24) * 0.075;
  }

  /** Les élites montent plus vite que le bestiaire courant. */
  function elitePower(depth) {
    return 1 + (depth / 10) * 0.4 + Math.max(0, depth - 20) * 0.025;
  }

  const hasEliteAt = (d) => d % 10 === 0;
  const hasAltarAt = (d) => d % 5 === 3;

  /** Décor : eau, pièges, butin — déduits de la profondeur. */
  function decorFor(depth) {
    return {
      name: FLOORS[depth - 1][0],
      tagline: FLOORS[depth - 1][1],
      band: clamp(Math.floor((depth - 1) / 5), 0, BANDS.length - 1),
      monsters: BANDS[clamp(Math.floor((depth - 1) / 5), 0, BANDS.length - 1)],
      waterPools: depth === 1 ? 0 : Math.min(6, 1 + Math.floor(depth / 7)),
      traps: Math.min(14, 2 + Math.floor(depth / 3)),
      items: Math.min(9, 5 + Math.floor(depth / 6)),
      altar: hasAltarAt(depth),
    };
  }

  /* ---- prix : il monte avec le palier ET avec la profondeur ---- */
  function gearPrice(tier, depth) {
    const t = clamp(tier, 1, MAX_TIER);
    const base = 40 + 70 * (t - 1) + 50 * (t - 1) * (t - 1);
    return base + depth * 15 * t;
  }

  NEX.SPECIES = SPECIES;
  NEX.SLOTS = SLOTS;
  NEX.SLOT_INDEX = SLOT_INDEX;
  NEX.SLOT_COUNT = SLOT_COUNT;
  NEX.GEAR_SPECS = GEAR_SPECS;
  NEX.SETS = SETS;
  NEX.TIER_WEIGHTS = TIER_WEIGHTS;
  NEX.MAX_TIER = MAX_TIER;
  NEX.DEPTH_COUNT = DEPTH_COUNT;
  NEX.PALETTES = PALETTES;

  NEX.tierName = tierName;
  NEX.tierColor = tierColor;
  NEX.tierGlow = tierGlow;
  NEX.paletteFor = paletteFor;
  NEX.powerScale = powerScale;
  NEX.elitePower = elitePower;
  NEX.hasEliteAt = hasEliteAt;
  NEX.hasAltarAt = hasAltarAt;
  NEX.decorFor = decorFor;
  NEX.gearPrice = gearPrice;

  /** Description « ATQ +7, PV +4 » d'une fiche d'équipement. */
  function describeGear(spec) {
    const p = [];
    if (spec.atk) p.push("ATQ +" + spec.atk);
    if (spec.def) p.push("DFO +" + spec.def);
    if (spec.hp) p.push("PV +" + spec.hp);
    if (spec.crit) p.push("CRIT +" + spec.crit + "%");
    if (spec.dodge) p.push("ESQ +" + spec.dodge + "%");
    if (spec.sight) p.push("VUE +" + spec.sight);
    if (spec.regen) p.push("REGEN +" + spec.regen);
    return p.length ? p.join(", ") : "sans effet";
  }
  NEX.describeGear = describeGear;
})();
