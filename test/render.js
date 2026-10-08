/* Vérifie que le rendu et l'interface se construisent et s'exécutent
   sans erreur, en simulant un canvas et un DOM.
   Lancement :  node test/render.js                                      */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const JS = path.join(ROOT, "js");

/* ------------------------------------------- canvas & DOM factices */

const gradient = { addColorStop() {} };
const drawCalls = { count: 0, ops: {} };

const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === "canvas") return { width: 1200, height: 700 };
    if (k === "createRadialGradient" || k === "createLinearGradient") return () => gradient;
    if (k === "measureText") return () => ({ width: 40 });
    if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    if (k === "setTransform" || k === "save" || k === "restore" || k === "beginPath"
      || k === "closePath" || k === "fill" || k === "stroke" || k === "translate"
      || k === "scale" || k === "rotate" || k === "clip" || k === "fillRect"
      || k === "strokeRect" || k === "clearRect" || k === "fillText"
      || k === "strokeText" || k === "arc" || k === "ellipse" || k === "rect"
      || k === "moveTo" || k === "lineTo" || k === "quadraticCurveTo"
      || k === "bezierCurveTo" || k === "roundRect" || k === "putImageData") {
      drawCalls.count++;
      return () => {};
    }
    return () => {};
  },
  set(_, k, v) {
    if (typeof k === "string") drawCalls.ops[k] = String(v).slice(0, 40);
    return true;
  },
});

function makeEl(tag) {
  const e = {
    tagName: String(tag || "div").toUpperCase(),
    style: {}, dataset: {}, children: [], className: "",
    _html: "", _text: "",
    clientWidth: 1200, clientHeight: 700, width: 1200, height: 700,
    offsetWidth: 100, offsetHeight: 100,
    scrollTop: 0, scrollHeight: 0, firstElementChild: null,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) {
        if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (f) this._s.add(c); else this._s.delete(c);
      },
      contains(c) { return this._s.has(c); },
    },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); if (!this.firstElementChild) this.firstElementChild = c; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove() {}, focus() {}, blur() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return makeEl("span"); },
    querySelectorAll() { return []; },
    closest() { return null; },
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1200, bottom: 700, width: 1200, height: 700 }),
    setPointerCapture() {},
  };
  return e;
}

const store = {};
const listeners = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  Uint8Array, Uint8ClampedArray, Float32Array, Int32Array, Map, Set,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: () => 0, clearTimeout: () => {},
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  devicePixelRatio: 1,
  innerWidth: 1400, innerHeight: 900,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  AudioContext: null,
  document: {
    readyState: "complete",
    createElement: (tag) => (tag === "canvas" ? makeEl("canvas") : makeEl(tag)),
    createElementNS: (ns, tag) => makeEl(tag),
    getElementById: (id) => (store[id] || (store[id] = makeEl("div"))),
    querySelector: () => makeEl("div"),
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

/* --------------------------------------------------- chargement */

let fails = 0;
function check(label, cond, extra) {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  ECHEC " + label + (extra ? "  -> " + extra : "")); }
}

console.log("— chargement —");
for (const f of ["rng.js", "sprites.js", "data.js", "items.js", "world.js",
  "game.js", "fx.js", "audio.js", "render.js", "ui.js"]) {
  try {
    vm.runInContext(fs.readFileSync(path.join(JS, f), "utf8"), sandbox, { filename: f });
    console.log("  ok   " + f);
  } catch (e) {
    console.log("  ECHEC " + f + " : " + e.message);
    process.exit(1);
  }
}

const NEX = sandbox.NEX;

/* --------------------------------------------------- sprites */

console.log("\n— sprites —");
{
  const names = Object.keys(NEX.SPRITES);
  check("22 sprites définis", names.length >= 22, String(names.length));

  let bad = [];
  for (const name of names) {
    const rows = NEX.SPRITES[name].rows;
    const w = rows[0].length;
    for (let y = 0; y < rows.length; y++) {
      if (rows[y].length !== w) bad.push(name + " ligne " + y + " : " + rows[y].length + " au lieu de " + w);
      for (const ch of rows[y]) {
        if (ch !== "." && !NEX.SPRITES[name].pal[ch]) bad.push(name + " caractère inconnu '" + ch + "'");
      }
    }
  }
  check("toutes les lignes ont la bonne largeur et des couleurs connues",
    bad.length === 0, bad.slice(0, 5).join(" | "));

  // mise en cache des canvas de sprite
  const cv = NEX.spriteCanvas("player");
  check("sprite mis en cache", cv.width === 12 && cv.height === 13,
    cv.width + "x" + cv.height);
  check("sprite teinté = autre canvas", NEX.spriteCanvas("gearRing", { m: "#ff0000" }) !== cv);

  // liseré : +2 px dans chaque dimension (1 px de marge de chaque côté)
  const ol = NEX.spriteOutlined("player");
  check("le liseré ajoute 2 px", ol.width === 14 && ol.height === 15,
    ol.width + "x" + ol.height);
  check("liseré mis en cache", NEX.spriteOutlined("player") === ol);
  check("liseré teinté = autre canvas",
    NEX.spriteOutlined("gearRing", { m: "#ff0000" }) !== NEX.spriteOutlined("gearRing"));

  // toutes les créatures sont des sprites valides
  let miss = [];
  for (const key of Object.keys(NEX.SPECIES)) {
    if (!NEX.SPRITES[NEX.SPECIES[key].sprite]) miss.push(key);
  }
  check("chaque créature a son sprite", miss.length === 0, miss.join(","));

  // chaque objet aussi
  const p = new NEX.Potion(false), p2 = new NEX.Potion(true);
  const it = [new NEX.Elixir("sage"), new NEX.Whetstone(), new NEX.HidePlate(),
    new NEX.RuneBomb(), new NEX.TeleportScroll(), new NEX.MapScroll(),
    new NEX.GoldPile(12), new NEX.Amulet(), new NEX.Gear(NEX.GEAR_SPECS[0])];
  check("sprites d'objets présents",
    [p, p2].concat(it).every(o => NEX.SPRITES[o.sprite]),
    [p, p2].concat(it).filter(o => !NEX.SPRITES[o.sprite]).map(o => o.sprite).join(","));
}

console.log("\n— un sprite d'équipement par emplacement —");
{
  // chaque emplacement doit avoir SON sprite, pas un cristal générique
  const wanted = {
    weapon: "gearWeapon", armor: "gearArmor", helmet: "gearHelmet",
    boots: "gearBoots", ring: "gearRing", talisman: "gearTalisman",
  };
  const wrong = [];
  for (const spec of NEX.GEAR_SPECS) {
    const g = new NEX.Gear(spec);
    if (g.sprite !== wanted[g.slot]) wrong.push(g.slot + " -> " + g.sprite);
    if (!NEX.SPRITES[g.sprite]) wrong.push("sprite absent : " + g.sprite);
  }
  check("les 24 pièces utilisent le sprite de leur emplacement",
    wrong.length === 0, wrong.slice(0, 4).join(", "));

  check("les 6 sprites d'équipement existent",
    Object.keys(wanted).every(k => !!NEX.SPRITES[wanted[k]]));

  // le teintage doit produire 4 apparences distinctes (une par palier)
  const tints = [1, 2, 3, 4].map((t) => JSON.stringify(NEX.tierTint(new NEX.Gear(
    NEX.GEAR_SPECS.find((s) => s[0] === "weapon" && s[1] === t)))));
  check("les 4 paliers ont 4 teintes distinctes", new Set(tints).size === 4);
  check("le teinture ne s'applique qu'à l'équipement",
    NEX.tierTint(new NEX.Potion(false)) === null);

  // et les sprites teintés doivent être fabricables
  let err = null;
  try {
    for (const spec of NEX.GEAR_SPECS) {
      const g = new NEX.Gear(spec);
      NEX.spriteOutlined(g.sprite, NEX.tierTint(g));
    }
  } catch (e) { err = e; }
  check("les 24 sprites teintés + liserés se construisent", !err, err ? err.message : "");
}

/* --------------------------------------------------- rendu */

console.log("\n— aucun sprite ne déborde de sa case —");
{
  /*
   * Régression directe sur le bug rapporté : « le perso passe sur les murs ».
   * Pour chaque créature et chaque objet, on vérifie que le rectangle
   * réellement dessiné reste dans la tuile, une fois l'ancrage par les
   * pieds appliqué.
   */
  const S = 40;                       // taille de tuile de référence
  const overs = [];

  function footprint(w, h, want, maxH, label) {
    const f = NEX.fitSprite(w, h, S, want, maxH);
    // pire cas de l'animation : balancement +-0.030 tuile, flottement +0.10
    const top = NEX.FOOT_Y * S - f.h - S * 0.03;
    const bottom = NEX.FOOT_Y * S + S * 0.10;
    // La case va de -S/2 à +S/2 autour du centre.
    //
    // EN HAUT, c'est là qu'est le mur du dessus : un débordement masque la
    // case et c'est ce qui donne l'impression que « le perso marche sur les
    // murs ». Interdit, sauf pour le Gardien.
    //
    // En bas, le débordement est bénin : c'est du sol, et c'est exactement
    // ce qui fait qu'une créature qui lévite semble décoller.
    if (top < -S / 2) overs.push(label + " déborde de " + (-S / 2 - top).toFixed(1) + " px en haut");
    if (bottom > S * 0.62) overs.push(label + " déborde de " + (bottom - S / 2).toFixed(1) + " px en bas");
    if (f.w > S * maxH + 1) overs.push(label + " trop large (" + f.w + ")");
  }

  for (const key of Object.keys(NEX.SPECIES)) {
    const sp = NEX.SPECIES[key];
    const ol = NEX.spriteOutlined(sp.sprite);
    footprint(ol.width, ol.height, sp.scale || 1, sp.boss ? NEX.FIT.boss : NEX.FIT.actor, sp.name);
  }
  const pol = NEX.spriteOutlined("player");
  footprint(pol.width, pol.height, 1.012, NEX.FIT.actor, "le héros");

  const sampleItems = [new NEX.Potion(false), new NEX.Potion(true), new NEX.Elixir("sage"),
    new NEX.Elixir("soul"), new NEX.Whetstone(), new NEX.HidePlate(), new NEX.RuneBomb(),
    new NEX.TeleportScroll(), new NEX.MapScroll(), new NEX.GoldPile(7), new NEX.Amulet()];
  sampleItems.forEach((it) => {
    const ol = NEX.spriteOutlined(it.sprite, NEX.tierTint(it));
    footprint(ol.width, ol.height, 1, NEX.FIT.item, it.name);
  });
  NEX.SLOTS.forEach((slot) => {
    const g = new NEX.Gear(NEX.GEAR_SPECS.find((sp) => sp[0] === slot.id));
    const ol = NEX.spriteOutlined(g.sprite, NEX.tierTint(g));
    footprint(ol.width, ol.height, 1, NEX.FIT.item, g.name);
  });

  const normal = overs.filter((o) => o.indexOf("Gardien") < 0);
  check("rien ne déborde vers le haut (les murs restent visibles)", normal.length === 0,
    normal.slice(0, 6).join(" | "));
  check("seul le Gardien déborde (c'est voulu)",
    overs.length > 0 && overs.every((o) => o.indexOf("Gardien") >= 0),
    overs.join(" | "));

  // et à toutes les tailles de tuile possibles
  let anyOverflow = null;
  for (let s = 20; s <= 80; s += 1) {
    for (const key of Object.keys(NEX.SPECIES)) {
      const sp = NEX.SPECIES[key];
      if (sp.boss) continue;
      const f = NEX.fitSprite(s + 2, s + 2, s, sp.scale || 1, NEX.FIT.actor);
      if (f.h > s + 1) { anyOverflow = key + " à s=" + s; break; }
    }
    if (anyOverflow) break;
  }
  check("aucun débordement de s=20 à s=80", !anyOverflow, anyOverflow || "");
}

console.log("\n— chaque objet est dessiné DANS sa case —");
{
  /*
   * Régression sur un bug réel : dans drawItem, la hauteur du sprite était
   * calculée sans le cy de la case. Résultat, tous les objets se
   * retrouvaient empilés en haut de l'écran — on ne voyait que leurs halos,
   * et le butin semblait « n'avoir pas de sprite ».
   *
   * On enregistre les appels à drawImage et on vérifie que le rectangle
   * tracé recouvre bien la case de l'objet.
   */
  const blits = [];
  let tx = 0, ty = 0;   // translation en cours (les acteurs font translate + blit relatif)
  const spyCtx = new Proxy({}, {
    get(_, k) {
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => gradient;
      if (k === "measureText") return () => ({ width: 10 });
      if (k === "translate") return (x, y) => { tx += x; ty += y; };
      if (k === "save") return () => {};
      if (k === "restore") return () => { tx = 0; ty = 0; };
      if (k === "scale") return () => {};
      if (k === "drawImage") {
        return (img, dx, dy, dw, dh) => {
          if (typeof dx === "number") {
            blits.push({ dx: dx + tx, dy: dy + ty, dw, dh, img: img.width + "x" + img.height });
          }
        };
      }
      return () => {};
    },
    set() { return true; },
  });

  const r2 = new NEX.Renderer(store.game || (store.game = makeEl("canvas")));
  r2.tile = 40;
  r2.W = 800; r2.H = 480;
  r2.viewTilesX = 20; r2.viewTilesY = 12;

  const items = [
    new NEX.Potion(false), new NEX.Potion(true), new NEX.Elixir("sage"),
    new NEX.GoldPile(30), new NEX.Amulet(), new NEX.RuneBomb(),
  ];
  NEX.SLOTS.forEach((slot) =>
    items.push(new NEX.Gear(NEX.GEAR_SPECS.find((sp) => sp[0] === slot.id))));

  const misplaced = [];
  items.forEach((item, i) => {
    blits.length = 0;
    tx = 0; ty = 0;
    const dx = 100 + i * 30, dy = 200;   // position écran de la case
    r2.drawItem(spyCtx, item, dx, dy, 40, 0.5, false);

    // le blit du SPRITE est le dernier (halo et ombre ne sont pas des blits)
    const sprite = blits[blits.length - 1];
    if (!sprite) { misplaced.push(item.short + " : aucun blit"); return; }

    const tileTop = dy;
    const tileBottom = dy + 40;
    if (sprite.dy < tileTop - 20 || sprite.dy + sprite.dh > tileBottom + 20) {
      misplaced.push(item.short + " : blit en y=" + sprite.dy + " alors que la case est "
        + tileTop + "…" + tileBottom);
    }
    if (sprite.dx < dx - 20 || sprite.dx + sprite.dw > dx + 40 + 20) {
      misplaced.push(item.short + " : blit en x=" + sprite.dx + " pour une case en " + dx);
    }
  });
  check("les " + items.length + " objets sont dessinés dans leur case",
    misplaced.length === 0, misplaced.slice(0, 4).join(" | "));

  // et le héros / les monstres aussi
  const g2 = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  g2.newRun(31);
  blits.length = 0; tx = 0; ty = 0;
  r2.drawPlayer(spyCtx, g2, 300, 300, 40, 0.5);
  const pb = blits[blits.length - 1];
  check("le héros reste dans sa case",
    pb && pb.dy >= 300 - 20 && pb.dy + pb.dh <= 300 + 40 + 20,
    pb ? "y=" + pb.dy + " h=" + pb.dh : "aucun blit");

  // une créature qui lévite, au pire moment de son flottement :
  // elle ne doit jamais masquer le mur du dessus
  let mb = null, ok = true;
  for (let i = 0; i < 16; i++) {
    blits.length = 0; tx = 0; ty = 0;
    r2.drawMonster(spyCtx, new NEX.Monster("wraith", 5, 5, 1), 200, 300, 40, i * 0.4);
    mb = blits[blits.length - 1];
    if (!mb || mb.dy < 280) { ok = false; break; }
  }
  check("une créature qui lévite ne masque jamais le mur du dessus",
    ok, mb ? "y=" + mb.dy.toFixed(1) + " (plancher 280)" : "aucun blit");

  // le boss, lui, DOIT déborder : on vérifie qu'il le fait vraiment
  blits.length = 0; tx = 0; ty = 0;
  r2.drawMonster(spyCtx, new NEX.Monster("boss", 5, 5, 1), 200, 300, 40, 0.5);
  const bb = blits[blits.length - 1];
  check("le Gardien déborde volontairement",
    bb && bb.dh > 40 * 1.2, bb ? "h=" + bb.dh : "aucun blit");
}

console.log("\n— construction du moteur de rendu —");
let renderer;
try {
  renderer = new NEX.Renderer(store.game || (store.game = makeEl("canvas")));
  check("constructeur", true);
} catch (e) {
  check("constructeur", false, e.message);
}

try {
  renderer.resize();
  check("resize : taille de tuile cohérente",
    renderer.tile >= 20 && renderer.viewTilesX >= 8 && renderer.viewTilesY >= 5,
    "tile=" + renderer.tile + " vue=" + renderer.viewTilesX + "x" + renderer.viewTilesY);
} catch (e) {
  check("resize", false, e.message);
}

/* --------------------------------------------------- boucle de rendu */

console.log("\n— 240 images rendues —");
{
  const fx = new NEX.Fx();
  const game = new NEX.Game(fx, new NEX.Audio());
  game.newRun(4242);
  fx.setPalette(game.map.pal);
  fx.setSize(game.map.w, game.map.h);

  renderer.snapTo(game.p.x, game.p.y);

  let err = null;
  const before = drawCalls.count;

  for (let f = 0; f < 240 && !err; f++) {
    try {
      const dt = 1 / 60;
      fx.update(dt);
      for (const m of game.monsters) {
        if (m.lunge > 0) m.lunge = Math.max(0, m.lunge - dt * 5);
        if (m.hurtFlash > 0) m.hurtFlash = Math.max(0, m.hurtFlash - dt * 4);
      }
      game.p.hurtFlash = Math.max(0, game.p.hurtFlash - dt * 3);
      renderer.follow(game.p.x, game.p.y, dt);
      renderer.render(game, fx, dt);
    } catch (e) {
      err = e;
    }
  }
  check("aucune exception sur 240 images", !err, err ? err.message + "\n" + err.stack.split("\n")[1] : "");
  console.log("       " + (drawCalls.count - before) + " appels de dessin");

  try {
    renderer.renderMinimap(store.minimap ? store.minimap.getContext("2d") : ctx2d, game);
    check("mini-carte rendue", true);
  } catch (e) {
    check("mini-carte rendue", false, e.message);
  }
}

console.log("\n— rendu sur les 40 étages —");
{
  const fx = new NEX.Fx();
  const game = new NEX.Game(fx, new NEX.Audio());
  game.newRun(777);
  fx.setPalette(game.map.pal);
  fx.setSize(60, 20);

  let err = null;
  const depths = [];
  for (let d = 1; d <= 40 && !err; d++) {
    game.depth = d - 1;
    game.buildLevel();
    fx.setPalette(game.map.pal);
    try {
      for (let f = 0; f < 3; f++) {
        game.map.computeFov(game.p.x, game.p.y, game.p.sight);
        renderer.render(game, fx, 1 / 60);
      }
      renderer.renderMinimap(ctx2d, game);
      depths.push(d);
    } catch (e) { err = e; }
  }
  check("les 40 étages se rendent (chaque palette)", !err,
    err ? "étage " + depths.length + " : " + err.message + " | " + err.stack.split("\n")[1] : "");
}

console.log("\n— rendu avec tous les objets et monstres possibles —");
{
  const fx = new NEX.Fx();
  const game = new NEX.Game(fx, new NEX.Audio());
  game.newRun(31337);
  fx.setPalette(game.map.pal);
  fx.setSize(60, 20);

  // on sème la carte d'objets et de créatures la plus dense possible
  let err = null;
  try {
    const map = game.map;
    game.floor.length = 0;
    game.monsters.length = 0;

    const makers = [
      () => new NEX.Potion(false), () => new NEX.Potion(true),
      () => new NEX.Elixir("soul"), () => new NEX.Elixir("sage"),
      () => new NEX.Whetstone(), () => new NEX.HidePlate(),
      () => new NEX.RuneBomb(), () => new NEX.TeleportScroll(),
      () => new NEX.MapScroll(), () => new NEX.GoldPile(99),
      () => new NEX.Amulet(), () => NEX.randomGear(game.rng, 40),
    ];
    let k = 0;
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        if (!map.isPassable(x, y)) continue;
        if ((x + y) % 3 === 0) game.floor.push({ x, y, item: makers[k++ % makers.length]() });
      }

    // toutes les créatures, y compris l'élite et le boss
    const keys = Object.keys(NEX.SPECIES);
    let n = 0;
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        if (!map.isPassable(x, y)) continue;
        if (x === game.p.x && y === game.p.y) continue;
        if ((x * 3 + y) % 5 !== 0) continue;
        game.monsters.push(new NEX.Monster(keys[n++ % keys.length], x, y, 3));
      }

    // et on force l'affichage de tout
    for (let i = 0; i < map.w * map.h; i++) { map.explored[i] = 1; map.visible[i] = 1; }
    game.monsters.forEach(m => { m.hurtFlash = 1; m.lunge = 1; });

    fx.count = 600;
    for (let i = 0; i < 600; i++) {
      fx.spawn(Math.random() * 60, Math.random() * 20, 0, 0, 2, 0.05, "#fff", i % 2 === 0, 0);
    }
    fx.texts.push({ x: 10, y: 10, text: "-42", color: "#fff", scale: 2, life: 1, max: 1 });
    fx.rings.push({ x: 10, y: 10, color: "#fff", s: 1, r: 1, life: 0.4, max: 0.4 });
    fx.shake(20, 300);
    fx.flashScreen("#ff0000", 0.3, 0.4);

    renderer.render(game, fx, 1 / 60);
  } catch (e) { err = e; }
  check("scène surchargée rendue sans erreur", !err,
    err ? err.message + " | " + err.stack.split("\n")[1] : "");
  console.log("       " + game.floor.length + " objets · " + game.monsters.length + " monstres · "
    + fx.count + " particules");
}

console.log("\n— caméra et tuiles hors carte —");
{
  const fx = new NEX.Fx();
  const game = new NEX.Game(fx, new NEX.Audio());
  game.newRun(1);
  fx.setPalette(game.map.pal);
  game.p.x = 0; game.p.y = 0;
  renderer.snapTo(0, 0);
  let err = null;
  try {
    game.map.computeFov(0, 0, game.p.sight);
    renderer.render(game, fx, 1 / 60);
    game.p.x = game.map.w - 1; game.p.y = game.map.h - 1;
    game.map.computeFov(game.p.x, game.p.y, game.p.sight);
    renderer.render(game, fx, 1 / 60);
  } catch (e) { err = e; }
  check("joueur dans les quatre coins", !err, err ? err.message : "");

  // la tuile d'arrivée existe toujours comme centre
  check("centre de la 1re salle = point d'arrivée",
    game.map.rooms[0].cx < game.map.w && game.map.rooms[0].cy < game.map.h);
}

/* --------------------------------------------------- interface */

console.log("\n— interface —");
{
  const game = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  game.newRun(2468);
  const ui = new NEX.Ui(game);
  let err = null;
  try {
    ui.refresh();
    ui.renderBag();
    ui.renderHero();
    ui.renderForge();
    ui.showDepthCard(3, NEX.decorFor(3));
    ui.toast("essai", "good");
    ui.hint("essai");
    for (let i = 0; i < 200; i++) ui.pushLog("ligne " + i, "loot");
    ui.renderMinimap();
    ui.showEnd(true);
    ui.showEnd(false);
    ui.open("ovBag"); ui.closeOverlay();
    ui.openHero();
    ui.openForge();
    ui.openHelp();
    ui.closeOverlay();
  } catch (e) { err = e; }
  check("tous les panneaux se construisent", !err,
    err ? err.message + " | " + err.stack.split("\n")[1] : "");
}

console.log("\n— interface avec un sac et un équipement pleins —");
{
  const game = new NEX.Game(new NEX.Fx(), new NEX.Audio());
  game.newRun(99);
  const ui = new NEX.Ui(game);
  const rng = game.rng;

  for (let i = 0; i < 6; i++) game.p.equip(NEX.randomGear(rng, 40, NEX.SLOTS[i].id));
  game.p.bag.push(new NEX.Potion(false), new NEX.Potion(true), new NEX.Elixir("sage"),
    new NEX.Whetstone(), new NEX.HidePlate(), new NEX.RuneBomb(),
    NEX.randomGear(rng, 40), new NEX.GoldPile(50));

  let err = null;
  try {
    ui.refresh();
    ui.renderBag();
    ui.renderHero();
    NEX.forgeOffers(rng, 40).forEach(o => game.offers.push(o));
    ui.renderForge();
  } catch (e) { err = e; }
  check("6 emplacements + 8 objets + 6 offres", !err,
    err ? err.message + " | " + err.stack.split("\n")[1] : "");
  check("6 pièces équipées", game.p.gear.filter(Boolean).length === 6);
  check("bonus d'ensemble actifs", game.p.setsActive.length > 0,
    JSON.stringify(game.p.setsActive));
}

/* --------------------------------------------------- couleurs */

console.log("\n— couleurs —");
{
  const samples = [
    ...NEX.PALETTES.flatMap(p => [p.floor, p.floor2, p.grout, p.wall, p.wallTop,
      p.wallEdge, p.water, p.waterHi, p.accent, p.fog, p.dust]),
    "#000000", "#ffffff",
  ];
  const bad = samples.filter(c => !/^#[0-9a-f]{6}$/i.test(c));
  check("toutes les couleurs sont des #rrggbb", bad.length === 0, bad.join(" "));

  const glows = [];
  for (const k of Object.keys(NEX.SPECIES)) glows.push(NEX.SPECIES[k].glow);
  check("toutes les lueurs de créature sont valides",
    glows.every(c => /^#[0-9a-f]{6}$/i.test(c)),
    glows.filter(c => !/^#[0-9a-f]{6}$/i.test(c)).join(" "));

  check("mix/hexA/shade disponibles",
    typeof NEX.mix === "function" && typeof NEX.hexA === "function" && typeof NEX.shade === "function");
  check("chaque palette a un nom unique",
    new Set(NEX.PALETTES.map(p => p.name)).size === NEX.PALETTES.length);
}

console.log("\n" + (fails === 0 ? "TOUT PASSE." : fails + " VERIFICATION(S) EN ECHEC."));
process.exit(fails === 0 ? 0 : 1);
