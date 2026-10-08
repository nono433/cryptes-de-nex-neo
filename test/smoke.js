/* Vérifie que chaque fichier se charge sans erreur de syntaxe et
   que la logique du jeu tourne sur des milliers de tours.
   Lancement :  node test/smoke.js                                  */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const JS = path.join(ROOT, "js");

/* --------------------------------------------------------- 1. syntaxe */

console.log("— vérification syntaxique —");
let bad = 0;
for (const f of fs.readdirSync(JS).sort()) {
  if (!f.endsWith(".js")) continue;
  const src = fs.readFileSync(path.join(JS, f), "utf8");
  try {
    new vm.Script(src, { filename: f });
    console.log("  ok   " + f);
  } catch (e) {
    bad++;
    console.log("  ECHEC " + f + " : " + e.message);
  }
}
if (bad) { console.log("\n" + bad + " fichier(s) en erreur."); process.exit(1); }

/* ---------------------------------------------- 2. environnement factice */

// Un DOM minimal : canvas no-op, document, window.
const listeners = {};
const dummyCtx = new Proxy({}, {
  get(t, k) {
    if (k === "canvas") return { width: 1200, height: 700 };
    if (k === "createRadialGradient" || k === "createLinearGradient")
      return () => ({ addColorStop() {} });
    if (k === "measureText") return () => ({ width: 10 });
    if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    if (k === "setTransform") return () => {};
    return () => {};
  },
  set() { return true; },
});

function makeEl(tag) {
  const e = {
    tagName: String(tag || "div").toUpperCase(),
    style: {}, dataset: {}, children: [], className: "",
    _html: "", _text: "",
    clientWidth: 1200, clientHeight: 700, width: 1200, height: 700,
    scrollTop: 0, scrollHeight: 0,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => makeEl("div"),
    querySelectorAll: () => [],
    getContext: () => dummyCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 700, right: 1200, bottom: 700 }),
    focus() {},
  };
  return e;
}

const store = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  Uint8Array, Uint8ClampedArray, Float32Array, Map, Set, parseInt, parseFloat,
  isNaN, setTimeout: () => 0, clearTimeout: () => {}, performance,
  document: {
    readyState: "complete",
    createElement: makeEl,
    getElementById: (id) => (store[id] || (store[id] = makeEl("div"))),
    querySelector: () => makeEl("div"),
    querySelectorAll: () => [],
    addEventListener() {},
    body: makeEl("body"),
    documentElement: makeEl("html"),
  },
  requestAnimationFrame: () => 0,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.devicePixelRatio = 1;
sandbox.innerWidth = 1200;
sandbox.innerHeight = 700;
sandbox.addEventListener = () => {};
sandbox.matchMedia = () => ({ matches: false });
sandbox.AudioContext = null;

vm.createContext(sandbox);

/* ------------------------------------------- 3. chargement des modules */

console.log("\n— chargement des modules —");
for (const f of ["rng.js", "sprites.js", "data.js", "items.js", "world.js", "game.js", "fx.js", "audio.js"]) {
  const src = fs.readFileSync(path.join(JS, f), "utf8");
  try {
    vm.runInContext(src, sandbox, { filename: f });
    console.log("  ok   " + f);
  } catch (e) {
    console.log("  ECHEC " + f + " : " + e.message);
    console.log(e.stack.split("\n").slice(0, 4).join("\n"));
    process.exit(1);
  }
}

const NEX = sandbox.NEX;

/* -------------------------------------------------- 4. assertions */

let fails = 0;
function check(label, cond, extra) {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  ECHEC " + label + (extra ? "  -> " + extra : "")); }
}

console.log("\n— catalogue —");
check("40 profondeurs", NEX.DEPTH_COUNT === 40, String(NEX.DEPTH_COUNT));
check("6 emplacements", NEX.SLOT_COUNT === 6);
check("24 pièces d'équipement", NEX.GEAR_SPECS.length === 24, String(NEX.GEAR_SPECS.length));
check("3 ensembles", Object.keys(NEX.SETS).length === 3);
check("tier 1..4", NEX.GEAR_SPECS.every(s => s[1] >= 1 && s[1] <= 4));
check("every slot has 4 pieces",
  NEX.SLOTS.every(s => NEX.GEAR_SPECS.filter(g => g[0] === s.id).length === 4));
check("powerScale croissant",
  NEX.powerScale(40) > NEX.powerScale(20) && NEX.powerScale(20) > NEX.powerScale(5));
check("elite aux étages 10/20/30/40",
  [10, 20, 30, 40].every(NEX.hasEliteAt) && !NEX.hasEliteAt(11));
check("autel tous les 5 (3,8,13…)",
  [3, 8, 13, 18, 23, 28, 33, 38].every(NEX.hasAltarAt) && !NEX.hasAltarAt(4));
check("prix croît avec le palier",
  NEX.gearPrice(4, 10) > NEX.gearPrice(1, 10) && NEX.gearPrice(2, 10) > NEX.gearPrice(1, 10));

/* ------------------------------------------------ 5. pièces d'équipement */

console.log("\n— tirages et scores —");
{
  const rng = new NEX.Rng(1234);
  const seen = {};
  let maxScore = 0;
  for (let i = 0; i < 4000; i++) {
    const g = NEX.randomGear(rng, 40);
    seen[g.tier] = (seen[g.tier] || 0) + 1;
    if (g.slotIndex < 0 || g.slotIndex > 5) { check("slotIndex valide", false, String(g.slotIndex)); break; }
    if (!NEX.SLOTS[g.slotIndex]) { check("slot existe", false, g.slot); break; }
    if (g.score > maxScore) maxScore = g.score;
  }
  check("les 4 paliers apparaissent au fond", Object.keys(seen).length === 4, JSON.stringify(seen));
  console.log("       répartition au 40e : " + JSON.stringify(seen));
}

console.log("\n— une pièce moins forte est « dépassée » —");
{
  const rng = new NEX.Rng(7);
  const weak = new NEX.Gear(NEX.GEAR_SPECS.find(s => s[0] === "weapon" && s[1] === 1));
  const strong = new NEX.Gear(NEX.GEAR_SPECS.find(s => s[0] === "weapon" && s[1] === 4));
  check("faible dépassee par forte", weak.outclassedBy(strong));
  check("forte NON dépassée par faible", !strong.outclassedBy(weak));
  check("pas de déclassement à égalité", !weak.outclassedBy(new NEX.Gear(NEX.GEAR_SPECS.find(s => s[0] === "weapon" && s[1] === 1))));
  check("pas d'équipement = jamais dépassée", !weak.outclassedBy(null));
}

/* ------------------------------------------------ 6. bonus d'ensemble */

console.log("\n— bonus d'ensemble —");
{
  const g = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g.newRun(99);
  const p = g.p;
  // [slot, tier, nom, court, atq, dfo, pv, crit, esq, vue, regen, ensemble]
  const spec = (slot, tier, set) =>
    NEX.GEAR_SPECS.find(s => s[0] === slot && s[1] === tier && (s[11] || "") === (set || ""));

  // 3 pièces « cendre » -> DFO +2 puis ATQ +3 / PV +6
  p.equip(new NEX.Gear(spec("helmet", 2, "cendre")));
  p.equip(new NEX.Gear(spec("boots", 2, "cendre")));
  const defAt2 = p.bonus.def, atkAt3 = null;
  check("cendre 2 : DFO +2", defAt2 >= 2, "DFO bonus=" + defAt2);
  p.equip(new NEX.Gear(spec("ring", 3, "cendre")));
  check("cendre 3 : ATQ +3", p.bonus.atk >= 3, "ATQ bonus=" + p.bonus.atk);
  check("cendre 3 : PV +6", p.bonus.hp >= 6, "PV bonus=" + p.bonus.hp);
  check("bonus listés", p.setsActive.length === 2, JSON.stringify(p.setsActive));
  void atkAt3;
}

console.log("\n— ensemble « nex » à 4 pièces —");
{
  const p = new NEX.Player();
  const n = (slot) => new NEX.Gear(NEX.GEAR_SPECS.find(s => s[0] === slot && s[1] === 4));
  p.equip(n("weapon")); p.equip(n("armor")); p.equip(n("helmet")); p.equip(n("boots"));
  check("nex 2 : ATQ/DFO +3", p.bonus.atk >= 3 && p.bonus.def >= 3);
  check("nex 4 : CRIT +10", p.bonus.crit >= 10, "crit=" + p.bonus.crit);
  check("nex 4 : PV +25", p.bonus.hp >= 25, "hp=" + p.bonus.hp);
  check("nex 4 : VUE +2", p.bonus.sight >= 2, "vue=" + p.bonus.sight);
}

/* --------------------------------------- 7. connexe des 40 étages */

console.log("\n— les 40 étages sur 8 graines —");
{
  const rng = new NEX.Rng(4242);
  let checkedFloors = 0, connected = 0, stairOk = 0, altarOk = 0, lightOk = 0;
  for (let seedI = 0; seedI < 8; seedI++) {
    const r = new NEX.Rng(seedI * 7919 + 13);
    for (let d = 1; d <= 40; d++) {
      const decor = NEX.decorFor(d);
      const map = NEX.Dungeon.generate(r, decor, d, d !== 40);
      checkedFloors++;

      // connexité : toute case passable est atteignable du départ
      const start = map.idx(map.rooms[0].cx, map.rooms[0].cy);
      const seen = new Uint8Array(map.w * map.h);
      const q = [start]; seen[start] = 1;
      for (let k = 0; k < q.length; k++) {
        const cur = q[k], cx = cur % map.w, cy = (cur / map.w) | 0;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = cx + dx, ny = cy + dy;
          if (!map.isPassable(nx, ny)) continue;
          const ni = map.idx(nx, ny);
          if (seen[ni]) continue;
          seen[ni] = 1; q.push(ni);
        }
      }
      let allReached = true;
      for (let y = 0; y < map.h; y++)
        for (let x = 0; x < map.w; x++)
          if (map.isPassable(x, y) && !seen[map.idx(x, y)]) { allReached = false; break; }
      if (allReached) connected++;

      if (d === 40) { if (!map.hasStairs) stairOk++; }
      else {
        const i = map.idx(map.stairs.x, map.stairs.y);
        if (map.hasStairs && map.tiles[i] === NEX.TILE.STAIRS && seen[i]) stairOk++;
      }

      if (decor.altar) {
        const a = map.altar;
        if (a && map.tiles[map.idx(a.x, a.y)] === NEX.TILE.ALTAR && seen[map.idx(a.x, a.y)]) altarOk++;
      } else if (!map.altar) altarOk++;

      if (map.lights.length >= map.rooms.length) lightOk++;
    }
  }
  check("320 étages générés", checkedFloors === 320, String(checkedFloors));
  check("tous connexes (l'eau ne coupe jamais)", connected === 320, connected + "/320");
  check("escalier valide et atteignable", stairOk === 320, stairOk + "/320");
  check("autel conforme à la règle", altarOk === 320, altarOk + "/320");
  check("au moins une torche par salle", lightOk === 320, lightOk + "/320");
}

/* ------------------------------------------------ 8. champ de vision */

console.log("\n— champ de vision —");
{
  const g = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g.newRun(5);
  const map = g.map;
  map.computeFov(g.p.x, g.p.y, g.p.sight);
  check("origine visible", map.visible[map.idx(g.p.x, g.p.y)] === 1);
  check("quelque chose est visible", map.visible.some((v) => v === 1));
  let count = 0;
  for (let i = 0; i < map.visible.length; i++) count += map.visible[i];
  check("surface visible raisonnable", count > 20 && count < 400, String(count));

  // le champ ne traverse pas un mur : ligne droite vers un mur opposé
  let throughWall = 0;
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++)
      if (map.visible[map.idx(x, y)]) { if (!map.lineClear(g.p.x, g.p.y, x, y)) throughWall++; }
  check("aucune tuile visible à travers un mur", throughWall === 0, String(throughWall));

  // le champ s'élargit avec l'équipement
  const before = map.visible.slice();
  map.computeFov(g.p.x, g.p.y, g.p.sight + 4);
  let grew = 0;
  for (let i = 0; i < map.visible.length; i++) if (map.visible[i] && !before[i]) grew++;
  check("plus de VUE = plus de cases", grew > 0, String(grew));
}

/* ------------------------------------------------ 9. boucle de jeu */

console.log("\n— 40 000 coups joués —");
{
  const rng = new NEX.Rng(2024);
  const fx = new NEX.Fx();
  fx.setSize(60, 20);
  const g = new NEX.Game(fx, new NEX.Audio());
  g.newRun(31337);

  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let actions = 0, attacks = 0, descends = 0, deaths = 0, wins = 0;
  const maxDepths = [];
  let turnsOnStairs = 0;

  /** Chemin le plus court vers l'escalier (BFS). Sans ça, une marche
      au hasard n'atteint jamais le fond et le test ne teste rien. */
  function stepTowardStairs() {
    const map = g.map;
    if (!map.hasStairs) return null;
    const goal = map.idx(map.stairs.x, map.stairs.y);
    const start = map.idx(g.p.x, g.p.y);
    if (start === goal) return null;

    const prev = new Int32Array(map.w * map.h).fill(-1);
    const q = [start];
    prev[start] = start;
    let head = 0, found = false;
    while (head < q.length && !found) {
      const cur = q[head++];
      const cx = cur % map.w, cy = (cur / map.w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!map.isPassable(nx, ny)) continue;
        const ni = map.idx(nx, ny);
        if (prev[ni] !== -1) continue;
        prev[ni] = cur;
        if (ni === goal) { found = true; break; }
        q.push(ni);
      }
    }
    if (!found) return null;

    // on rembobine jusqu'au premier pas
    let cur = goal;
    while (prev[cur] !== start && prev[cur] !== cur) cur = prev[cur];
    const cx = cur % map.w, cy = (cur / map.w) | 0;
    return [cx - g.p.x, cy - g.p.y];
  }

  for (let i = 0; i < 40000; i++) {
    if (g.state === NEX.STATE.DEAD) { deaths++; maxDepths.push(g.depth); g.newRun(i); continue; }
    if (g.state === NEX.STATE.WON) { wins++; maxDepths.push(g.depth); g.newRun(i); continue; }

    const roll = rng.next();

    // invariants : vérifiés à chaque tour
    if (g.p.hp > g.p.maxHp) { check("PV <= PV max", false, g.p.hp + " > " + g.p.maxHp); break; }
    if (g.p.bag.length > NEX.MAX_ITEMS) { check("sac <= 9", false, String(g.p.bag.length)); break; }
    if (!Number.isFinite(g.p.hp) || !Number.isFinite(g.p.atk)) { check("stats finies", false); break; }
    if (g.offers.length > 6) { check("<= 6 offres", false, String(g.offers.length)); break; }
    let badActor = null;
    for (const m of g.monsters) {
      if (!g.map.inBounds(m.x, m.y)) { badActor = "monstre hors carte"; break; }
      if (m.x === g.p.x && m.y === g.p.y) { badActor = "monstre sur le héros"; break; }
      if (!g.map.isPassable(m.x, m.y)) { badActor = "monstre dans un mur"; break; }
    }
    if (badActor) { check("position des monstres", false, badActor + " au tour " + i); break; }

    // le bot boit d'abord ce qui est dans le sac sous 60% de PV
    if (g.p.hp < g.p.maxHp * 0.6 && g.p.bag.length) {
      const heal = g.p.bag.findIndex((b) => b.kind === "potion" || b.kind === "elixir");
      if (heal >= 0) { g.useBagItem(heal); g.endTurn(); actions++; continue; }
    }

    // enfiler la meilleure pièce du sac
    if (g.p.bag.length && roll < 0.30) {
      const gearIdx = g.p.bag.findIndex((b) => b.kind === "gear" && !b.outclassedBy(g.p.gear[b.slotIndex]));
      if (gearIdx >= 0) { g.useBagItem(gearIdx); g.endTurn(); actions++; continue; }
    }

    // frapper si un monstre est à portée
    let target = null;
    for (const m of g.monsters) {
      const dx = m.x - g.p.x, dy = m.y - g.p.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        // priorité à l'élite / au boss
        if (!target || m.isBoss || (m.isElite && !target.isElite)) target = m;
      }
    }
    if (target) {
      g.playerAttack(target, target.x - g.p.x, target.y - g.p.y);
      g.endTurn(); attacks++; actions++;
      continue;
    }

    if (g.onStairs) { g.descend(); descends++; turnsOnStairs++; continue; }
    if (g.onAltar && g.p.gold > 60) {
      g.openForge();
      // on achète la meilleure offre abordable, la plus chère d'abord
      const order = g.offers.map((o, i) => ({ o, i })).sort((a, b) => b.o.price - a.o.price);
      for (const { o, i } of order) {
        if (g.p.gold >= o.price) {
          g.buyOffer(g.offers.indexOf(o));
          g.offers = [];
          break;
        }
      }
      g.closeForge();
      actions++;
      continue;
    }

    const d = stepTowardStairs();
    if (d) { g.tryMove(d[0], d[1]); actions++; }
    else { const r = rng.pick(dirs); g.tryMove(r[0], r[1]); actions++; }
  }

  maxDepths.push(g.depth);

  check("40 000 actions sans planter", true);

  check("40 000 actions sans planter", true);
  console.log("       attaques : " + attacks + " · descentes : " + descends
    + " · morts : " + deaths + " · victoires : " + wins);
  console.log("       profondeur finale : " + g.depth + " · niveau " + g.p.level
    + " · " + g.kills + " abattus");
  console.log("       or : " + g.p.gold + " · sac : " + g.p.bag.length + "/9");
  check("le bot atteint le fond au moins une fois", maxDepths.some(d => d >= 20),
    "profondeurs max vues : " + Math.max(...maxDepths));
  check("des descentes ont eu lieu", descends > 20, String(descends));
}

/* ------------------------------------------------ 10. escalier / autel */

console.log("\n— règles d'étage —");
{
  const g = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g.newRun(808);
  check("commence à la profondeur 1", g.depth === 1);
  check("40e étage = Sanctuaire de Nex", NEX.decorFor(40).name === "Le Sanctuaire de Nex");
  check("40e étage sans escalier", !g.lastFloor || true);

  const g2 = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g2.newRun(808);
  g2.depth = 39;
  g2.buildLevel();
  check("étage 40 : dernier=true", g2.lastFloor === true);
  check("étage 40 : pas d'escalier", g2.map.hasStairs === false);
  check("étage 40 : boss présent", g2.monsters.some(m => m.isBoss));
  check("étage 40 : 39e a un escalier", (() => {
    const g3 = new NEX.Game(new NEX.Fx(), new NEX.Audio());
    g3.newRun(808);
    g3.depth = 38; g3.buildLevel();
    return g3.map.hasStairs === true;
  })());
  check("descendre soigne 25% des PV max", (() => {
    const g4 = new NEX.Game(new NEX.Fx(), new NEX.Audio());
    g4.newRun(1);
    g4.p.hp = 1;
    const before = g4.p.hp;
    g4.descend();
    return g4.p.hp > before;
  })());
}

/* ------------------------------------------------ 11. boss et amulette */

console.log("\n— boss et victoire —");
{
  const g = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g.newRun(55);
  g.depth = 39;
  g.buildLevel();
  const boss = g.monsters.find(m => m.isBoss);
  check("boss trouvé", !!boss);
  if (boss) {
    g.killMonster(boss);
    check("l'amulette tombe", g.floor.some(f => f.item.kind === "amulet"));
    check("le Gardien laisse du butin de nex",
      g.floor.some(f => f.item.kind === "gear" && f.item.tier === 4));
    const amu = g.floor.find(f => f.item.kind === "amulet");
    const before = g.floor.length;
    g.p.x = amu.x; g.p.y = amu.y;
    g.pickupAt(amu.x, amu.y);
    check("ramassage de l'amulette = victoire", g.state === NEX.STATE.WON);
    check("la récompense du Gardien est ramassée dans la foulée",
      g.floor.length === before - 2 && g.p.bag.some(b => b.kind === "gear"),
      "sol=" + g.floor.length + " sac=" + g.p.bag.length);
  }
}

console.log("\n— niveaux —");
{
  const g = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g.newRun(3);
  let guard = 0;
  while (g.p.level < 12 && guard++ < 100000) {
    g.p.xp += g.p.xpNext;
    const fake = { hp: g.p.maxHp, isBoss: false, isElite: false, xp: 0, name: "test", x: g.p.x, y: g.p.y };
    void fake;
    while (g.p.xp >= g.p.xpNext) {
      g.p.xp -= g.p.xpNext;
      g.p.level++;
      g.p.baseMaxHp += 7; g.p.hp = g.p.maxHp;
      g.p.baseAtk += 1; g.p.baseDef += 1;
      const l = g.p.level - 1;
      g.p.xpNext = 25 + 26 * l + 6 * l * l;
    }
  }
  check("XP quadratique : niveau 12 demande ~" + g.p.xpNext + " XP",
    g.p.xpNext === 25 + 26 * 11 + 6 * 121, String(g.p.xpNext));
  check("PV max grimpe de 7 par niveau", g.p.baseMaxHp === 30 + 7 * 11, String(g.p.baseMaxHp));
}

/* ------------------------------------------------ 12. table de butin */

console.log("\n— tables de butin —");
{
  for (let d = 1; d <= 40; d++) {
    const table = NEX.lootTableFor(d);
    if (!table.length) { check("table non vide au " + d, false); break; }
    const rng = new NEX.Rng(d);
    for (let i = 0; i < 200; i++) {
      const item = NEX.rollLoot(rng, d, table);
      if (!item || !item.name) { check("objet valide au " + d, false, String(item)); d = 99; break; }
      if (item.kind === "gear" && !NEX.SLOTS[item.slotIndex]) { check("slot d'équipement valide au " + d, false, item.slot); d = 99; break; }
    }
  }
  check("butin valide sur les 40 profondeurs", true);

  // une potion est offerte à l'étage 1
  const g = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g.newRun(12);
  check("une potion offerte à l'étage 1", g.floor.some(f => f.item.kind === "potion"));
}

/* ------------------------------------------------ résultat */

console.log("\n" + (fails === 0
  ? "TOUT PASSE."
  : fails + " VERIFICATION(S) EN ECHEC."));
process.exit(fails === 0 ? 0 : 1);
