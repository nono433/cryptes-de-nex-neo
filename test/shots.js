/* Rend de VRAIES images PNG du jeu, pour vérifier le rendu à l'œil.
   Utilise @napi-rs/canvas (optionnel : npm install --no-save @napi-rs/canvas).
   Lancement :  node test/shots.js                                      */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let createCanvas;
try {
  ({ createCanvas } = require("@napi-rs/canvas"));
} catch (e) {
  console.log("@napi-rs/canvas absent — saute. (npm install --no-save @napi-rs/canvas)");
  process.exit(0);
}

const ROOT = path.join(__dirname, "..");
const JS = path.join(ROOT, "js");
const OUT = path.join(ROOT, "shots");
fs.mkdirSync(OUT, { recursive: true });

/* -------------------------------------------------- canvas & DOM */

function mkCanvas(w, h) {
  const cv = createCanvas(w, h);
  return cv;
}

const registry = {};

const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  Uint8Array, Uint8ClampedArray, Float32Array, Int32Array, Map, Set, Proxy,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: () => 0, clearTimeout: () => {},
  performance: { now: () => 1e6 },
  requestAnimationFrame: () => 0,
  devicePixelRatio: 1,
  innerWidth: 1280, innerHeight: 760,
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false }),
  ResizeObserver: function () { this.observe = () => {}; },
  AudioContext: null,
  document: {
    readyState: "complete",
    createElement: (tag) => {
      const cv = mkCanvas(1, 1);
      cv.style = {};
      const ctx2d = cv.getContext("2d");
      cv.getContext = () => ctx2d;   // les canvas napi n'ont qu'un contexte
      return cv;
    },
    getElementById: (id) => registry[id],
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { style: {} },
    documentElement: { style: {} },
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* un canvas principal de 1280x760 */
const main = mkCanvas(1280, 760);
Object.defineProperty(main, "clientWidth", { value: 1280 });
Object.defineProperty(main, "clientHeight", { value: 760 });
main.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1280, bottom: 760, width: 1280, height: 760 });
registry.game = main;

for (const f of ["rng.js", "sprites.js", "data.js", "items.js", "world.js",
  "game.js", "fx.js", "audio.js", "render.js"]) {
  vm.runInContext(fs.readFileSync(path.join(JS, f), "utf8"), sandbox, { filename: f });
}
const NEX = sandbox.NEX;

/* ------------------------------------------------------ tirages */

function save(name, canvas) {
  const file = path.join(OUT, name + ".png");
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log("  " + name + ".png  (" + kb + " Ko)");
}

function scene(name, setup) {
  const cv = mkCanvas(1280, 760);
  Object.defineProperty(cv, "clientWidth", { value: 1280 });
  Object.defineProperty(cv, "clientHeight", { value: 760 });
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1280, bottom: 760, width: 1280, height: 760 });

  const r = new NEX.Renderer(cv);
  r.resize();

  const fx = new NEX.Fx();
  const game = new NEX.Game(fx, new NEX.Audio());
  game.newRun(setup.seed === undefined ? 1234 : setup.seed);
  fx.setPalette(game.map.pal);
  fx.setSize(game.map.w, game.map.h);
  if (setup.build) setup.build(game);

  r.snapTo(game.p.x, game.p.y);
  if (setup.after) setup.after(game, fx);
  for (let i = 0; i < 6; i++) {
    fx.update(1 / 60);
    r.render(game, fx, 1 / 60);
  }
  save(name, cv);
}

/* ------------------------------------------------------ les images */

console.log("— captures —");

// 1. l'état de départ : l'étage 1
scene("01-etage1", { seed: 1234 });

// 2. un couloir éclairé par des torches, avec des monstres autour
scene("02-visibilite", {
  seed: 77,
  build(g) {
    // on place une arène : une salle vide, le héros au centre, des monstres
    // tout autour, dont certains hors de portée de la lanterne
    const room = g.map.rooms[0];
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) g.map.set(x, y, NEX.TILE.FLOOR);
    g.map.set(g.map.stairs.x, g.map.stairs.y, NEX.TILE.STAIRS);
    g.p.x = room.cx; g.p.y = room.cy;
    g.monsters.length = 0;
    g.floor.length = 0;

    const keys = Object.keys(NEX.SPECIES);
    let n = 0;
    // un cercle de créatures, de 1 à 6 cases du héros
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dy = Math.round(Math.sqrt(radius * radius - dx * dx));
        for (const yy of radius === 0 ? [0] : [dy, -dy]) {
          const nx = room.cx + dx, ny = room.cy + yy;
          if (!g.map.isPassable(nx, ny)) continue;
          if (nx === g.p.x && ny === g.p.y) continue;
          if (g.monsters.some((m) => m.x === nx && m.y === ny)) continue;
          g.monsters.push(new NEX.Monster(keys[n++ % keys.length], nx, ny, 1.2));
        }
      }
    }
    g.map.computeFov(g.p.x, g.p.y, g.p.sight);
  },
});

// 3. l'équipement au sol : les 6 emplacements, les 4 paliers
scene("03-equipement", {
  seed: 55,
  build(g) {
    const room = g.map.rooms[0];
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) g.map.set(x, y, NEX.TILE.FLOOR);
    g.map.set(g.map.stairs.x, g.map.stairs.y, NEX.TILE.STAIRS);
    g.p.x = room.x + 1; g.p.y = room.cy;
    g.monsters.length = 0;
    g.floor.length = 0;

    const rng = g.rng;
    let i = 0;
    NEX.SLOTS.forEach((slot) => {
      [1, 2, 3, 4].forEach((tier) => {
        const spec = NEX.GEAR_SPECS.find((sp) => sp[0] === slot.id && sp[1] === tier);
        const x = room.x + 2 + (i % 7) * 2;
        const y = room.y + 1 + Math.floor(i / 7) * 2;
        if (g.map.inBounds(x, y) && g.map.isPassable(x, y)) {
          g.floor.push({ x, y, item: new NEX.Gear(spec) });
        }
        i++;
      });
    });
    // et quelques consommables à côté
    [new NEX.Potion(false), new NEX.Potion(true), new NEX.GoldPile(140),
     new NEX.Amulet(), new NEX.RuneBomb(), new NEX.MapScroll()]
      .forEach((it, k) => {
        g.floor.push({ x: room.x + 3 + k * 2, y: room.y + room.h - 2, item: it });
      });
    void rng;
    g.map.computeFov(g.p.x, g.p.y, 20);
  },
});

// 4. chaque profondeur : une palette différente
[1, 6, 14, 22, 30, 38].forEach((d) => {
  scene("palette-" + String(d).padStart(2, "0"), {
    seed: 900 + d,
    build(g) {
      g.depth = d - 1;
      g.buildLevel();
      fxSync(g);
      function fxSync() { /* la palette est prise dans render */ }
      // on éclaire un peu pour que la palette soit lisible
      g.p.bonus.sight = 10;
      g.map.computeFov(g.p.x, g.p.y, 40);
      const room = g.map.rooms[0];
      for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++) g.map.set(x, y, NEX.TILE.FLOOR);
      g.map.set(g.map.stairs.x, g.map.stairs.y, NEX.TILE.STAIRS);
      g.map.computeFov(g.p.x, g.p.y, 40);
    },
  });
});

// 5. le boss
scene("05-boss", {
  seed: 42,
  build(g) {
    g.depth = 39;
    g.buildLevel();
    g.p.bonus.sight = 6;
    g.map.computeFov(g.p.x, g.p.y, g.p.sight);
    const boss = g.monsters.find((m) => m.isBoss);
    if (boss) { boss.x = g.p.x + 2; boss.y = g.p.y; }
  },
});

// 6. l'élite
scene("06-elite", {
  seed: 43,
  build(g) {
    g.depth = 29;
    g.buildLevel();
    g.p.bonus.sight = 6;
    const elite = g.monsters.find((m) => m.isElite);
    if (elite) { elite.x = g.p.x + 2; elite.y = g.p.y; }
    g.map.computeFov(g.p.x, g.p.y, g.p.sight);
  },
});

// 7. un combat en cours : impacts, particules, dégâts flottants
scene("07-combat", {
  seed: 8,
  build(g) {
    const room = g.map.rooms[0];
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) g.map.set(x, y, NEX.TILE.FLOOR);
    g.p.x = room.cx; g.p.y = room.cy;
    g.monsters.length = 0;
    for (let k = 0; k < 5; k++) {
      const m = new NEX.Monster(["skeleton", "goblin", "orc", "spider", "wraith"][k],
        g.p.x + (k % 2 ? 1 : -1), g.p.y + (k < 2 ? -1 : 1), 2);
      m.hp = Math.round(m.maxHp * 0.55);
      g.monsters.push(m);
    }
    g.map.computeFov(g.p.x, g.p.y, g.p.sight);
  },
  after(g, fx) {
    g.playerAttack(g.monsters[0], 1, 0);
    g.monsters[1].lunge = 0.7;
    fx.hitBurst(g.monsters[0].x, g.monsters[0].y, "#ffd45e", 24, true);
    fx.playerHurt(g.p.x, g.p.y, 9);
    fx.levelUp(g.p.x, g.p.y, 7);
  },
});

console.log("\nImages dans : " + OUT);
