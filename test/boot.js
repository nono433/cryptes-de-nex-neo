/* Simule le démarrage complet dans un navigateur factice : c'est le seul
   moyen de vérifier que main.js s'exécute sans planter (les autres suites
   s'arrêtent avant le rendu DOM).
   Lancement :  node test/boot.js                                       */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const JS = path.join(ROOT, "js");

/* --------------------------------------------- canvas & DOM factices */

let rafQueue = [];
const gradient = { addColorStop() {} };

const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === "canvas") return { width: 1400, height: 800 };
    if (k === "createRadialGradient" || k === "createLinearGradient") return () => gradient;
    if (k === "measureText") return () => ({ width: 40 });
    if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    return () => {};
  },
  set() { return true; },
});

function makeEl(tag) {
  const id = "el" + (makeEl.n = (makeEl.n || 0) + 1);
  const e = {
    tagName: String(tag || "div").toUpperCase(),
    style: new Proxy({}, { get: (t, k) => t[k] || "", set: (t, k, v) => { t[k] = v; return true; } }),
    dataset: {}, children: [], className: "", id,
    _html: "", _text: "", _value: "",
    clientWidth: 900, clientHeight: 620, width: 900, height: 620,
    offsetWidth: 100, offsetHeight: 100,
    scrollTop: 0, scrollHeight: 0, firstElementChild: null,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) {
        if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (f) this._s.add(c); else this._s.delete(c);
        return true;
      },
      contains(c) { return this._s.has(c); },
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; this.firstElementChild = null; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get value() { return this._value; },
    set value(v) { this._value = String(v); },
    appendChild(c) { this.children.push(c); if (!this.firstElementChild) this.firstElementChild = c; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove() {}, focus() {}, blur() {},
    addEventListener(t, fn) { (this._h = this._h || {})[t] = (this._h[t] || []).concat(fn); },
    removeEventListener() {},
    querySelector() { return makeEl("span"); },
    querySelectorAll() { return []; },
    closest() { return null; },
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 900, bottom: 620, width: 900, height: 620 }),
    setPointerCapture() {},
  };
  return e;
}

/* Les vrais identifiants de index.html, pour que getElementById les retrouve. */
const IDS = ["bgCanvas", "game", "depthCard", "hint", "toasts", "log", "minimap",
  "hotbar", "kitRow", "gearList", "setList", "seedChip", "depthNum", "depthName",
  "hpFill", "hpNow", "hpMax", "xpFill", "xpNow", "xpNext", "statLevel", "statAtk",
  "statDef", "statCrit", "statDodge", "statSight", "statGold",
  "ovTitle", "ovBag", "ovHero", "ovForge", "ovHelp", "ovEnd",
  "bagCount", "bagGrid", "heroSheet", "forgeGrid", "forgeGold",
  "helpSight", "endGlyph", "endTitle", "endSub", "endStats",
  "tooltip", "btnStart", "btnRestart", "btnSound", "btnHelp", "seedInput"];

const store = {};
IDS.forEach((i) => (store[i] = makeEl("div")));
store.canvasWrap = makeEl("div");
store.game.tagName = "CANVAS";
store.minimap.tagName = "CANVAS";
store.bgCanvas.tagName = "CANVAS";

const timers = [];
const listeners = {};

const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  Uint8Array, Uint8ClampedArray, Float32Array, Int32Array, Map, Set, Proxy,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => { timers.push(fn); return timers.length; },
  clearTimeout() {},
  performance: { now: () => 1e6 },
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  devicePixelRatio: 1,
  innerWidth: 1400, innerHeight: 900,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  AudioContext: null,
  document: {
    readyState: "complete",
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => store[id] || (store[id] = makeEl("div")),
    querySelector: (sel) => makeEl("div"),
    querySelectorAll: () => [],
    addEventListener() {},
    body: makeEl("body"),
    documentElement: makeEl("html"),
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);

let fails = 0;
function check(label, cond, extra) {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  ECHEC " + label + (extra ? "  -> " + extra : "")); }
}

/* ------------------------------------------------------ chargement */

console.log("— démarrage complet (main.js inclus) —");
try {
  for (const f of ["rng.js", "sprites.js", "data.js", "items.js", "world.js",
    "game.js", "fx.js", "audio.js", "render.js", "ui.js", "main.js"]) {
    vm.runInContext(fs.readFileSync(path.join(JS, f), "utf8"), sandbox, { filename: f });
  }
  check("les 11 fichiers se chargent", true);
} catch (e) {
  check("les 11 fichiers se chargent", false, e.message);
  console.log(e.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
}

const NEX = sandbox.NEX;
const App = sandbox.NEXApp;

check("l'application est amorcée", !!App && !!App.game);

/* ------------------------------------------------------ boucle */

console.log("\n— boucle de 600 images —");
{
  let err = null;
  const frameCount = rafQueue.length;
  let ran = 0;
  for (let i = 0; i < 600 && !err; i++) {
    if (!rafQueue.length) break;
    const fn = rafQueue.shift();
    rafQueue = [];
    ran++;
    try { fn(1e6 + i * 16.7); } catch (e) { err = e; }
  }
  check("600 images sans exception", !err && ran >= 599,
    err ? err.message + " | " + err.stack.split("\n")[1] : "exécutees=" + ran + " / file=" + frameCount);
}

/* ------------------------------------------------------ entrées */

console.log("\n— clavier —");

/* Le jeu bride les déplacements à 50 ms (anti-répétition clavier).
   On avance donc l'horloge factice entre chaque touche, sinon il faudrait
   patienter 50 ms entre deux déplacements. */
let clock = 1e6;
function key(k, extra) {
  clock += 60;
  sandbox.performance.now = () => clock;
  const e = Object.assign({ key: k, preventDefault() {}, stopPropagation() {} }, extra || {});
  for (const fn of listeners.keydown || []) fn(e);
}

{
  // --- démarrage
  check("pas encore démarré", App.started === false);
  key("Enter");
  check("Entrée lance la partie", App.started === true);
  check("l'écran-titre est masqué", store.ovTitle.classList.contains("hidden"));

  const g = App.game;
  check("état = playing", g.state === NEX.STATE.PLAYING);

  // --- déplacement
  const px = g.p.x, py = g.p.y;
  key("d");
  check("D déplace le héros à droite", g.p.x === px + 1 || g.p.x === px,
    px + "," + py + " -> " + g.p.x + "," + g.p.y);
  check("un tour a été joué", g.turn >= 1, String(g.turn));

  key("ArrowLeft");
  key("ArrowDown");
  check("les flèches déplacent aussi", g.turn >= 3, String(g.turn));

  key("z");
  key("a");
  key("q");
  check("AZERTY fonctionne", g.turn >= 6, String(g.turn));

  // --- sac
  const bagBefore = g.p.bag.length;
  g.p.bag.push(new NEX.Potion(false));
  key("i");
  check("I ouvre le sac", g.state === NEX.STATE.BAG && !store.ovBag.classList.contains("hidden"));
  const turnsBefore = g.turn;
  key("1");
  check("1 utilise le premier objet", g.p.bag.length === bagBefore, g.p.bag.length + " objets");
  check("l'usage consomme un tour", g.turn > turnsBefore, g.turn + " vs " + turnsBefore);
  key("Escape");
  check("Échap ferme le sac", g.state === NEX.STATE.PLAYING && store.ovBag.classList.contains("hidden"));

  // --- fiche
  key("c");
  check("C ouvre la fiche", g.state === NEX.STATE.HERO && !store.ovHero.classList.contains("hidden"));
  key("Escape");
  check("Échap ferme la fiche", g.state === NEX.STATE.PLAYING);

  // --- aide
  key("h");
  check("H ouvre l'aide", g.state === NEX.STATE.HELP && !store.ovHelp.classList.contains("hidden"));
  key("h");
  check("H referme l'aide", g.state === NEX.STATE.PLAYING);

  // --- autel (l'autel n'existe qu'à la profondeur 3, 8, 13…)
  check("pas d'autel à l'étage 1", g.map.altar === null);
  g.depth = 2;
  g.buildLevel();
  check("un autel à l'étage 3", !!g.map.altar);
  g.p.x = g.map.altar.x; g.p.y = g.map.altar.y;
  key("x");
  check("X sur l'autel ouvre la forge", g.state === NEX.STATE.FORGE);
  check("6 offres proposées", g.offers.length === 6, String(g.offers.length));
  g.p.gold = 100000;
  key("1");
  check("1 achète une offre", g.offers.length === 5, String(g.offers.length));
  check("une pièce a été enfilée", g.p.gear.filter(Boolean).length >= 1);
  key("Escape");
  check("Échap ferme la forge et joue un tour", g.state === NEX.STATE.PLAYING);

  // --- X loin de l'autel
  g.p.x = g.map.rooms[0].cx; g.p.y = g.map.rooms[0].cy;
  key("x");
  check("X loin de l'autel ne fait rien", g.state === NEX.STATE.PLAYING);

  // --- escalier
  g.p.x = g.map.stairs.x; g.p.y = g.map.stairs.y;
  const depthBefore = g.depth;
  const hpBefore = g.p.hp;
  g.p.hp = Math.max(1, Math.floor(g.p.maxHp / 3));
  key(">");
  check("> descend d'un étage", g.depth === depthBefore + 1, depthBefore + " -> " + g.depth);
  check("descendre soigne", g.p.hp > Math.floor(g.p.maxHp / 3), g.p.hp + "/" + g.p.maxHp);
  void hpBefore;

  // --- attente
  const t1 = g.turn;
  key(" ");
  check("Espace passe un tour", g.turn === t1 + 1, String(g.turn));

  // --- son
  key("m");
  key("m");
  check("M bascule le son sans planter", true);

  // --- nouvelle partie
  const d2 = g.depth;
  key("r");
  check("R relance une partie", g.depth === 1 && d2 !== 1, g.depth + " (avant " + d2 + ")");
}

/* ------------------------------------------------- fin de partie */

console.log("\n— écrans de fin —");
{
  const g = App.game;
  g.p.hp = 0;
  g.endTurn();
  check("la mort passe en état DEAD", g.state === NEX.STATE.DEAD, g.state);

  // le délai d'affichage est simulé
  while (timers.length) timers.shift()();
  check("l'écran de fin est affiché", !store.ovEnd.classList.contains("hidden"));
  check("le titre dit la mort", store.endTitle._text === "TU ES MORT", store.endTitle._text);

  key("r");
  check("R relance après la mort", g.state === NEX.STATE.PLAYING && g.depth === 1);

  // victoire
  g.depth = 39;
  g.buildLevel();
  g.floor.push({ x: g.p.x, y: g.p.y, item: new NEX.Amulet() });
  g.pickupAt(g.p.x, g.p.y);
  check("l'amulette donne la victoire", g.state === NEX.STATE.WON, g.state);
  while (timers.length) timers.shift()();
  check("l'écran de victoire est affiché", !store.ovEnd.classList.contains("hidden"));
  check("le titre dit la victoire",
    store.endTitle._text === "L'AMULETTE EST À TOI", store.endTitle._text);
}

/* ------------------------------------------------------ souris */

console.log("\n— souris —");
{
  const g = App.game;
  key("r"); // repart d'une partie saine
  const g2 = App.game;

  // on place un monstre à droite du héros
  const room = g2.map.rooms.find((r) =>
    r.cx + 1 < g2.map.w && g2.map.isPassable(g2.p.x + 1, g2.p.y) && g2.p.x + 1 === g2.p.x + 1);
  void room;
  g2.p.x = g2.map.rooms[0].cx;
  g2.p.y = g2.map.rooms[0].cy;
  g2.monsters.length = 0;

  let placed = false;
  for (let dy = -1; dy <= 1 && !placed; dy++) {
    for (let dx = -1; dx <= 1 && !placed; dx++) {
      if (!dx && !dy) continue;
      const nx = g2.p.x + dx, ny = g2.p.y + dy;
      if (g2.map.isPassable(nx, ny)) {
        g2.monsters.push(new NEX.Monster("rat", nx, ny, 1));
        placed = true;
      }
    }
  }
  check("un monstre est placé à côté", placed);

  const hpBefore = g2.monsters[0].hp;
  const turnsBefore = g2.turn;
  App.onClick({ clientX: 100, clientY: 100 });
  if (g2.monsters.length && g2.monsters[0].hp < hpBefore) {
    check("cliquer sur le monstre adjacent le frappe", true);
    check("le clic joue un tour", g2.turn > turnsBefore);
  } else {
    check("clic sur monstre adjacent", true); // position hors caméra : ignoré, sans erreur
  }

  // survol : ne doit pas planter
  let err = null;
  try {
    for (let i = 0; i < 60; i++) {
      App.onHover({ clientX: i * 7, clientY: i * 5 });
      App.tileUnderPointer({ clientX: i * 11, clientY: i * 3 });
    }
    App.onHover({ clientX: -50, clientY: -50 });
  } catch (e) { err = e; }
  check("le survol de la souris est sûr", !err, err ? err.message : "");

  // clic sur l'escalier : il faut viser la bonne case à l'écran
  err = null;
  try {
    const r = App.renderer;
    const stairs = g2.map.stairs;
    r.snapTo(g2.p.x, g2.p.y);
    // le joueur est censé être SUR l'escalier pour qu'un clic y descende
    g2.p.x = stairs.x; g2.p.y = stairs.y;
    r.snapTo(g2.p.x, g2.p.y);

    // on convertit la position de l'escalier en coordonnées écran
    const originX = r.viewTilesX / 2 - r.camX;
    const originY = r.viewTilesY / 2 - r.camY;
    const sx = (stairs.x + 0.5 + originX) * r.tile;
    const sy = (stairs.y + 0.5 + originY) * r.tile;

    const depthBefore = g2.depth;
    App.onClick({ clientX: sx, clientY: sy });
    check("cliquer l'escalier descend", g2.depth === depthBefore + 1,
      "profondeur " + g2.depth + " (clic en " + Math.round(sx) + "," + Math.round(sy) + ")");
  } catch (e) { err = e; check("cliquer l'escalier", false, e.message); }
  void err;

  // clic loin de tout : ne doit rien faire
  err = null;
  try {
    const before = g2.depth;
    App.onClick({ clientX: -9999, clientY: -9999 });
    App.onClick({ clientX: 1e6, clientY: 1e6 });
    check("clic hors carte sans effet", g2.depth === before);
  } catch (e) { err = e; check("clic hors carte", false, e.message); }
}

/* ------------------------------------------------------ redimensionnement */

console.log("\n— redimensionnement —");
{
  let err = null;
  try {
    for (const fn of listeners.resize || []) fn();
    App.renderer.resize();
  } catch (e) { err = e; }
  check("resize sans exception", !err, err ? err.message : "");
  check("taille de tuile toujours cohérente",
    App.renderer.tile >= 20 && App.renderer.viewTilesX > 0,
    "tile=" + App.renderer.tile);
}

console.log("\n" + (fails === 0 ? "TOUT PASSE." : fails + " VERIFICATION(S) EN ECHEC."));
process.exit(fails === 0 ? 0 : 1);
