/* Rend une planche de spriteszoomés, pour les inspecter à l'œil.
   Lancement :  node test/spritesheet.js                               */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let createCanvas;
try {
  ({ createCanvas } = require("@napi-rs/canvas"));
} catch (e) {
  console.log("@napi-rs/canvas absent — saute.");
  process.exit(0);
}

const JS = path.join(__dirname, "..", "js");
const OUT = path.join(__dirname, "..", "shots");
fs.mkdirSync(OUT, { recursive: true });

function mk(w, h) {
  const cv = createCanvas(w, h);
  const g = cv.getContext("2d");
  cv.style = {};
  cv.getContext = () => g;
  return cv;
}

const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  Uint8Array, Uint8ClampedArray, Float32Array, Int32Array, Map, Set, Proxy,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: () => 0, clearTimeout: () => {},
  performance: { now: () => 1e6 }, requestAnimationFrame: () => 0,
  devicePixelRatio: 1, innerWidth: 1, innerHeight: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false }),
  AudioContext: null,
  document: {
    readyState: "complete", createElement: () => mk(1, 1),
    getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], addEventListener() {},
    body: { style: {} }, documentElement: { style: {} },
  },
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);

for (const f of ["rng.js", "sprites.js", "data.js", "items.js", "world.js", "render.js"])
  vm.runInContext(fs.readFileSync(path.join(JS, f), "utf8"), sb, { filename: f });
const NEX = sb.NEX;

/* ------------------------------------------------------------ planche */

const ZOOM = 6;          // agrandissement
const CELL = 22;         // cellules de 22 px source
const PAD = 4;

const list = [
  ["héros", NEX.spriteOutlined("player"), null],
  ["rat", NEX.spriteOutlined("rat"), null],
  ["araignée", NEX.spriteOutlined("spider"), null],
  ["gobelin", NEX.spriteOutlined("goblin"), null],
  ["squelette", NEX.spriteOutlined("skeleton"), null],
  ["orc", NEX.spriteOutlined("orc"), null],
  ["spectre", NEX.spriteOutlined("wraith"), null],
  ["goleme", NEX.spriteOutlined("golem"), null],
  ["nécro.", NEX.spriteOutlined("lich"), null],
  ["seigneur", NEX.spriteOutlined("shade"), null],
  ["prêtresse", NEX.spriteOutlined("shaman"), null],
  ["GARDIEN", NEX.spriteOutlined("boss"), null],
];

const gear = {};
NEX.SLOTS.forEach((slot) => {
  [1, 2, 3, 4].forEach((tier) => {
    const spec = NEX.GEAR_SPECS.find((sp) => sp[0] === slot.id && sp[1] === tier);
    const g = new NEX.Gear(spec);
    const cv = NEX.spriteOutlined(g.sprite, NEX.tierTint(g));
    gear[slot.id + tier] = cv;
  });
});

const objects = [
  ["potion", NEX.spriteOutlined("potion")],
  ["grand fl.", NEX.spriteOutlined("bigPotion")],
  ["élixir", NEX.spriteOutlined("elixir")],
  ["él. sage", NEX.spriteOutlined("sageElixir")],
  ["or", NEX.spriteOutlined("gold")],
  ["parchemin", NEX.spriteOutlined("scroll")],
  ["bombe", NEX.spriteOutlined("bomb")],
  ["aiguisoir", NEX.spriteOutlined("whetstone")],
  ["plaque", NEX.spriteOutlined("plate")],
  ["amulette", NEX.spriteOutlined("amulet")],
  ["piège", NEX.spriteOutlined("trap")],
];

const gearOrder = [
  ["arme", "weapon"], ["armure", "armor"], ["casque", "helmet"],
  ["bottes", "boots"], ["anneau", "ring"], ["talisman", "talisman"],
];

const cols = Math.max(list.length, gearOrder.length * 4, objects.length);
const rows = 1 + gearOrder.length + 1;
const W = (cols + 1) * (CELL + PAD) * ZOOM;
const H = (rows + 1) * (CELL + PAD) * ZOOM;

const cv = mk(W, H);
const g = cv.getContext("2d");

// fond : deux damiers pour juger du contraste sur clair et sur sombre
g.fillStyle = "#15182a";
g.fillRect(0, 0, W, H);
const cw = (CELL + PAD) * ZOOM;
g.fillStyle = "#1d2138";
for (let y = 0; y * cw < H; y++)
  for (let x = 0; x * cw < W; x++)
    if ((x + y) % 2 === 0) g.fillRect(x * cw, y * cw, cw, cw);

g.imageSmoothingEnabled = false;

function place(cv2, col, row, label) {
  const ox = (col + 1) * cw;
  const oy = (row + 1) * cw;
  // repère : la case de 22 px (la tuile de référence)
  g.strokeStyle = "rgba(255,255,255,.14)";
  g.lineWidth = 1;
  g.strokeRect(ox + 0.5, oy + 0.5, CELL * ZOOM, CELL * ZOOM);

  const f = NEX.fitSprite(cv2.width, cv2.height, CELL * ZOOM, 1, NEX.FIT.boss);
  g.drawImage(cv2, Math.round(ox + (CELL * ZOOM - f.w) / 2),
    Math.round(oy + (CELL * ZOOM - f.h) / 2), f.w, f.h);

  g.fillStyle = "#cfe0ff";
  g.font = "13px sans-serif";
  g.textAlign = "center";
  g.fillText(label, ox + (CELL * ZOOM) / 2, oy + CELL * ZOOM + 15);
}

// ligne 1 : créatures
list.forEach(([label, cv2], i) => place(cv2, i, 0, label));

// ligne 2+ : équipement, 4 paliers par emplacement
gearOrder.forEach(([label, id], r) => {
  [1, 2, 3, 4].forEach((tier, c) => {
    place(gear[id + tier], c, r + 1, (c === 0 ? label + " " : "") + "T" + tier);
  });
});

// dernière ligne : objets
objects.forEach(([label, cv2], i) => place(cv2, i, rows - 1, label));

fs.writeFileSync(path.join(OUT, "sprites.png"), cv.toBuffer("image/png"));
console.log("shots/sprites.png  (" + (W / ZOOM) + "x" + (H / ZOOM) + " source, "
  + Math.round(fs.statSync(path.join(OUT, "sprites.png")).size / 1024) + " Ko)");
