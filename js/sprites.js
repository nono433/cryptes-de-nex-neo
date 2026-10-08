/* ============================================================
   sprites.js — pixel-art dessiné à la main
   Chaque sprite est une grille de caractères ; chaque caractère
   renvoie à une couleur de la palette. '.' = transparent.
   Le tout est mis en cache dans un canvas hors écran pour
   un rendu instantané.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});

  /* ------------------------------------------------------ définitions */

  const SPRITES = {

    /* ---------- le héros : l'Éclaireur, capuche et lanterne */
    player: {
      rows: [
        "............",
        "....kkkk....",
        "...kmmmmk...",
        "..kmmmmmmk..",
        "..kmllllmk..",
        "..kmleelmk..",
        "...kmmmmk...",
        "..kkmmmmkk..",
        ".kmmmmmmmmk.",
        ".kmmmmmmmmk.",
        ".kmmaammmmk.",
        "..kmmaammmk.",
        "...kkkkkk...",
      ],
      pal: {
        k: "#0a0d1c", m: "#3d4a80", l: "#8aa0d8",
        e: "#ffdc7a", a: "#c8792c", d: "#232c50",
      },
    },

    /* ---------- bestiaire */
    rat: {
      rows: [
        "............",
        "............",
        "....k.......",
        "...kmk......",
        "...kmk.kkkk.",
        "..kmmkkmmmmk",
        "..kmmmmmmmmk",
        "...kmmlmmmle",
        "....kmmmmmk.",
        ".....kkkk...",
      ],
      pal: { k: "#0d0a08", m: "#6b5b4a", l: "#8f7c66", e: "#ff5c5c", d: "#3f3529" },
    },

    spider: {
      rows: [
        ".k...k...k..",
        ".kmk.kmk.kmk",
        "..k.kmmk.k..",
        "...kmmmmk...",
        "..kmmmmmmk..",
        ".kmmllllmmk.",
        ".kmlelllelmk",
        "..kmmmmmmk..",
        "...kkmmkk...",
        "............",
      ],
      pal: { k: "#0a0710", m: "#3b2350", l: "#6d3f86", e: "#ff3b6b", d: "#241430" },
    },

    goblin: {
      rows: [
        "............",
        "..kk....kk..",
        ".kmmk..kmmk.",
        ".kmmkkkkmmk.",
        "..kmmeemmek.",
        "...kmmmmmk..",
        "...kmmmmk...",
        "..kmmmmmmk..",
        "..kmmaammmk.",
        ".kmmmmmmmmk.",
        ".kmmmmmmmmk.",
        "..kmmllmmmk.",
        "...kkmmkk...",
      ],
      pal: { k: "#08110a", m: "#4e7a33", l: "#79b04c", e: "#ffe45c", a: "#5c3a1a", d: "#2c4419" },
    },

    skeleton: {
      rows: [
        "............",
        "....kkkk....",
        "...kmmmmk...",
        "...kmmmmk...",
        "...kmekmek..",
        "...kmmmmk...",
        "...kmddmk...",
        "...kmmmmk...",
        "..kmmlkmlmk.",
        "..kmmmmmmk..",
        "..kmmlkmlmk.",
        "..kmmmmmmk..",
        "...kmmmmk...",
        "...kkkkkk...",
      ],
      pal: { k: "#15130e", m: "#ded7c1", l: "#f6f1e2", e: "#7fe8ff", d: "#9b9179" },
    },

    orc: {
      rows: [
        "..............",
        "..kkk....kkk..",
        ".kmmmk..kmmmk.",
        ".kmmmmkkmmmmk.",
        "..kmmmmmmmmmk.",
        "..kmeemmeemmk.",
        "...kmmmmmmmk..",
        "...kmmmmmmk...",
        "..kmmmmmmmmk..",
        "..kmmaammmmk..",
        ".kmmmmmmmmmmk.",
        ".kmmlllllllmmk",
        "..kmmkkkkkmmk.",
        "...kkkkkkkkk..",
      ],
      pal: { k: "#0c1008", m: "#5f7c3c", l: "#86a955", e: "#ff7a3b", a: "#3d2a12", d: "#3a4d22" },
    },

    wraith: {
      rows: [
        "............",
        "....kkkk....",
        "...kmmmmk...",
        "..kmmmmmmk..",
        "..kmllllmk..",
        "..kmllllmk..",
        "..kmmmmmmk..",
        "..kmmmmmmk..",
        ".kmmmmmmmmk.",
        ".kmmmmmmmmk.",
        ".kmmmmmmmmk.",
        "..kmm..mmk..",
        "..km....mk..",
        "...k....k...",
      ],
      pal: { k: "#061a20", m: "#2e8f96", l: "#8ff2ee", e: "#d8ffff", d: "#174f57" },
    },

    golem: {
      rows: [
        "..............",
        "..kkkkkkkkkk..",
        ".kmmmmmmmmmmk.",
        ".kmdmmmmmmdmk.",
        ".kmmmmmmmmmmk.",
        ".kmmmmmmmmmmk.",
        ".kmdddddddmmk.",
        ".kmmmmmmmmmmk.",
        ".kmdddddddmmk.",
        ".kmmmmmmmmmmk.",
        ".kmmlleellmmk.",
        ".kmmmmmmmmmmk.",
        ".kmmmmmmmmmmk.",
        "..kkkkkkkkkk..",
      ],
      pal: { k: "#14140f", m: "#8a8577", l: "#b6b0a0", e: "#ff9a3b", d: "#4f4b43" },
    },

    lich: {
      rows: [
        "..............",
        "....kkkkkk....",
        "...kmmmmmmk...",
        "..kmmmmmmmmk..",
        "..kmmmmmmmmk..",
        "..kmlllllllmk.",
        "..kmleeleelmk.",
        "...kmmmmmmk...",
        "..kmmmmmmmmk..",
        "..kmmmmmmmmk..",
        "..kmmaammmmmk.",
        ".kmmmmmmmmmmk.",
        ".kmmlllllllmmk",
        "..kmmkkkkkmmk.",
        "..kk......kk..",
        "..............",
      ],
      pal: { k: "#0d0718", m: "#6f4aa8", l: "#a483d8", e: "#c6ff4a", a: "#3b2158", d: "#2a1740" },
    },

    shade: {
      rows: [
        "................",
        "..k..........k..",
        ".k.k........k.k.",
        ".k.kk......kk.k.",
        ".kkkkkkkkkkkkkk.",
        "..kmmmmmmmmmmk..",
        "..kmllllllllmk..",
        "..kmleelleelmk..",
        "..kmmmmmmmmmmk..",
        ".kmmmmmmmmmmmmk.",
        ".kmmmmmmmmmmmmk.",
        ".kmmaammmmaammk.",
        ".kmmmmmmmmmmmmk.",
        "..kmmmmmmmmmmk..",
        "..kmmk....kmmk..",
        "...kk......kk...",
      ],
      pal: { k: "#06040f", m: "#2a1a4e", l: "#5a3f8c", e: "#ff2f6b", a: "#150c28", d: "#1a1030" },
    },

    /* ---------- élite : la prêtresse des os */
    shaman: {
      rows: [
        "..k............k..",
        ".kkk..........kkk.",
        ".kmk..........kmk.",
        "..kkkkkkkkkkkkkk..",
        "..kmmmmmmmmmmmmk..",
        "..kmllllllllllmk..",
        "..kmleeleellelmk..",
        "..kmmmmmmmmmmmmk..",
        "..kmddddddddddmk..",
        "..kmmmmmmmmmmmmk..",
        "..kmmaammmmmmaamk.",
        ".kmmmmmmmmmmmmmmk.",
        ".kmmllllllllllmmk.",
        "..kmmkkkkkkkkkmmk.",
        "...kkk......kkk...",
        "..................",
      ],
      pal: { k: "#14100a", m: "#e0c98a", l: "#f7ecc4", e: "#ff2f4a", a: "#8a6b3a", d: "#a08a52" },
    },

    /* ---------- boss : le Gardien de l'Amulette */
    boss: {
      rows: [
        "......kkkk......",
        "....kkmmmmkk....",
        "..kkmmaammakk...",
        ".kkmllllllllmkk.",
        ".kmlleelleellmk.",
        ".kmllllllllllmk.",
        "..kmmmmmmmmmmk..",
        "..kmmmmmmmmmmk..",
        ".kmmmmmmmmmmmmk.",
        ".kmmaammmmaammk.",
        ".kmmmmmmmmmmmmk.",
        "kkmmmmmmmmmmmmkk",
        ".kmmmmmmmmmmmmk.",
        ".kmmmmmmmmmmmmk.",
        "..kmmaammmmaamk.",
        "...kmmmmmmmmmk..",
        "....kkkkkkkkkk..",
        "................",
      ],
      pal: { k: "#180512", m: "#c0286b", l: "#f27bb4", e: "#ffd24a", a: "#6b0f3a", d: "#8c1b4e" },
    },

    /* ---------- objets au sol */
    potion: {
      rows: [
        "............",
        "....kkkk....",
        "....kllk....",
        "...kmmmmk...",
        "..kmmmmmmk..",
        "..kmmllmmk..",
        "..kmmaammk..",
        "..kmmmmmmk..",
        "...kmmmmk...",
        "....kkkk....",
        "............",
      ],
      pal: { k: "#06140c", m: "#1f7a4a", l: "#5cf0a8", e: "#e6fff2", a: "#0f4a2c" },
    },

    bigPotion: {
      rows: [
        "............",
        "....kkkk....",
        "....kllk....",
        "...kmmmmk...",
        "..kmmmmmmk..",
        ".kmmmmmmmmk.",
        ".kmmlllmmmkk",
        ".kmmmaammmkk",
        ".kmmmmmmmmk.",
        "..kmmmmmmk..",
        "...kmmmmk...",
        "....kkkk....",
      ],
      pal: { k: "#0a1a12", m: "#1a6f7a", l: "#7ff0ff", e: "#ffffff", a: "#0d4a52" },
    },

    elixir: {
      rows: [
        "............",
        "....kkkk....",
        "....kllk....",
        "...kmmmmk...",
        "..kmmmmmmk..",
        "..kmmllmmk..",
        "..kmlelemmk.",
        "..kmmmmmmk..",
        "...kmmmmk...",
        "....kkkk....",
        "............",
      ],
      pal: { k: "#120a04", m: "#8a5a12", l: "#ffd47a", e: "#fff6d0", a: "#5c3a08" },
    },

    sageElixir: {
      rows: [
        "............",
        "....kkkk....",
        "....kllk....",
        "...kmmmmk...",
        "..kmmmmmmk..",
        "..kmmllmmk..",
        "..kmlelemmk.",
        "..kmmmmmmk..",
        "...kmmmmk...",
        "....kkkk....",
        "............",
      ],
      pal: { k: "#08121a", m: "#2a6ea8", l: "#bfe6ff", e: "#ffffff", a: "#123f66" },
    },

    gold: {
      rows: [
        "............",
        "............",
        "..k..k..k...",
        ".kdk.kdk.kd.",
        ".kkk.kkk.kk.",
        "............",
        ".kdk.kdk.kd.",
        ".kkk.kkk.kk.",
        "............",
      ],
      pal: { k: "#3a2404", m: "#d79a2a", l: "#ffe6a0", e: "#fff8dc", d: "#8a5c0c" },
    },

    scroll: {
      rows: [
        "............",
        "............",
        ".kkkkkkkkkk.",
        ".kllllllllk.",
        ".kllkeekllk.",
        ".kllllllllk.",
        ".kkkkkkkkkk.",
        "............",
      ],
      pal: { k: "#201404", m: "#c8b48c", l: "#efe3c4", e: "#ffb648", d: "#a08a5c" },
    },

    bomb: {
      rows: [
        "............",
        "....k.......",
        "...kkk......",
        "...kmmk.....",
        "..kmmmmk....",
        ".kmmmmmmk...",
        ".kmmmmmmmk..",
        ".kmmmmmammk.",
        ".kmmmmmmmk..",
        "..kmmmmmk...",
        "...kkkkk....",
      ],
      pal: { k: "#0e0508", m: "#565073", l: "#9a92c8", e: "#ffd45e", a: "#332c4e" },
    },

    whetstone: {
      rows: [
        "............",
        "............",
        "............",
        "...kkkkk....",
        "..kmmmmmk...",
        ".kmmmmmmmk..",
        ".kmmllmmmk..",
        "..kmmmmmk...",
        "...kkkkk....",
      ],
      pal: { k: "#16120a", m: "#8a7c62", l: "#c4b69a", e: "#ffe0a0", d: "#5c5140" },
    },

    plate: {
      rows: [
        "............",
        "............",
        "..kkkkkkk...",
        ".kllllllk...",
        ".klllllllk..",
        ".klllllllk..",
        "..klllllk...",
        "...kkkkk....",
      ],
      pal: { k: "#0c1420", m: "#5a4a34", l: "#a68a5c", e: "#e0c48c", d: "#3a2e20" },
    },

    /* ---------- équipement au sol : un sprite par emplacement.
       Le palier (commun → de nex) est appliqué en teintant m / l / a. */

    gearWeapon: {
      rows: [
        ".........kk.",
        "........kmmk",
        ".......kmmk.",
        "......kmmk..",
        ".....kmmk...",
        "....kmmk....",
        "...kmmk.....",
        "..kaak......",
        "..kak.......",
        ".kak........",
        "kkk.........",
        "kk..........",
      ],
      pal: { k: "#0b0d18", m: "#9aa2c4", l: "#e8ecff", a: "#c8792c", e: "#fff" },
    },

    gearArmor: {
      rows: [
        "...kkkkkk...",
        "..kllllllk..",
        ".klmmmmmmmlk",
        ".klmmllmmmlk",
        ".klmmaammmlk",
        ".klmmmmmmmlk",
        ".klmmllmmmlk",
        "..kmmmmmmmk.",
        "..kmmmmmmmk.",
        "...kkkkkk...",
        "............",
        "............",
      ],
      pal: { k: "#0b0d18", m: "#9aa2c4", l: "#e8ecff", a: "#c8792c", e: "#fff" },
    },

    gearHelmet: {
      rows: [
        "...kkkkkk...",
        "..kllllllk..",
        ".kllllllllk.",
        ".klmeeemmlk.",
        ".klmeeemmlk.",
        ".klllllllk..",
        ".kllmkkmlk..",
        ".klllllllk..",
        "..kmmmmmk...",
        "...kkkkkk...",
        "............",
        "............",
      ],
      pal: { k: "#0b0d18", m: "#9aa2c4", l: "#e8ecff", a: "#c8792c", e: "#fff" },
    },

    gearBoots: {
      rows: [
        "...kkkk.....",
        "..kmmmmk....",
        "..kmmmmk....",
        "..kmmmmk....",
        "..kmmmmk....",
        "..kmmmmk....",
        ".kmmmmmmm...",
        ".kmmmmmmm...",
        "kkaakkaak...",
        "kmmmmmmmmm..",
        ".kkkkkkkk...",
        "............",
      ],
      pal: { k: "#0b0d18", m: "#9aa2c4", l: "#e8ecff", a: "#c8792c", e: "#fff" },
    },

    gearRing: {
      rows: [
        "............",
        "...kk..kk...",
        "..kllkkllk..",
        "..klkkkklk..",
        "..klkmmklk..",
        "..klkmmklk..",
        "...kmmmmk...",
        "....kaak....",
        "....kaak....",
        "....kmmk....",
        ".....kk.....",
        "............",
      ],
      pal: { k: "#0b0d18", m: "#9aa2c4", l: "#e8ecff", a: "#c8792c", e: "#fff" },
    },

    gearTalisman: {
      rows: [
        ".....kkk....",
        "....klmlk...",
        "...kllllk...",
        "..kllllllk..",
        "..klmeelmk..",
        "..kllllllk..",
        "..kllllllk..",
        "..klmmmmkl..",
        "..klaaaalk..",
        "..kllllllk..",
        "...kkkkkk...",
        "............",
      ],
      pal: { k: "#0b0d18", m: "#9aa2c4", l: "#e8ecff", a: "#c8792c", e: "#fff" },
    },

    amulet: {
      rows: [
        "............",
        "............",
        "....kkkk....",
        "...kllllk...",
        "..kllllllk..",
        "..kllllellk.",
        "..kllllllk..",
        "...kllllk...",
        "...kkkkkk...",
        ".....kk.....",
      ],
      pal: { k: "#1a0426", m: "#b44ce0", l: "#f0b6ff", e: "#ffffff", a: "#6b1f96" },
    },

    trap: {
      rows: [
        "............",
        "............",
        "............",
        "..k...k...k.",
        "...k.k.k.k..",
        "..k.k.k.k...",
        ".k.k.k.k.k..",
        "...k.k.k.k..",
        "..k...k...k.",
        "............",
      ],
      pal: { k: "#ffb648", m: "#8a5a20", l: "#ffe0a0", e: "#fff", a: "#5c3a08" },
    },
  };

  /* ------------------------------------------------------ mise en cache */

  const cache = new Map();
  const outlineCache = new Map();

  /**
   * Renvoie un canvas hors écran prêt à blitter.
   * @param {string} name  clé de SPRITES
   * @param {object} tint  substitution partielle de palette {m:'#rrggbb', ...}
   */
  function spriteCanvas(name, tint) {
    const key = name + "|" + (tint ? JSON.stringify(tint) : "");
    let c = cache.get(key);
    if (c) return c;

    const def = SPRITES[name];
    const h = def.rows.length;
    const w = def.rows[0].length;

    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d");

    const pal = Object.assign({}, def.pal, tint || {});

    for (let y = 0; y < h; y++) {
      const row = def.rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === "." || ch === undefined) continue;
        const col = pal[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    cache.set(key, cv);
    return cv;
  }

  /**
   * Même sprite, entouré d'un liseré sombre.
   *
   * C'est LA astuce qui rend les créatures lisibles : sur une dalle de pierre
   * gris-brun, un rat gris-brun disparaît. Avec un contour noir d'un pixel,
   * sa forme ressort partout, quelle que soit la couleur de la pierre.
   *
   * Le liseré est construit une seule fois puis mis en cache : le coût est
   * nul à l'exécution.
   */
  function spriteOutlined(name, tint, outlineColor) {
    const col = outlineColor || "#05060c";
    const key = name + "|" + (tint ? JSON.stringify(tint) : "") + "|" + col;
    let c = outlineCache.get(key);
    if (c) return c;

    const src = spriteCanvas(name, tint);
    const def = SPRITES[name];
    const pal = Object.assign({}, def.pal, tint || {});
    const pad = 1;

    const cv = document.createElement("canvas");
    cv.width = src.width + pad * 2;
    cv.height = src.height + pad * 2;
    const g = cv.getContext("2d");

    /*
     * 1. Silhouette dilatée. On redessine la grille de caractères en aplat
     *    8 fois, décalée d'un pixel dans les 8 directions : le résultat est
     *    la forme du sprite épaissie d'un pixel. On relit la GRILLE, pas le
     *    canvas — pas de getImageData, donc c'est rapide et ça reste net.
     */
    const offsets = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1],
    ];
    g.fillStyle = col;
    for (const [ox, oy] of offsets) stampSilhouette(g, def, pad + ox, pad + oy, pal, col);

    // 2. le sprite par-dessus, net
    g.drawImage(src, pad, pad);

    outlineCache.set(key, cv);
    return cv;
  }

  /** Rejoue une grille de sprites dans une seule couleur (silhouette). */
  function stampSilhouette(g, def, dx, dy, pal, col) {
    g.fillStyle = col;
    for (let y = 0; y < def.rows.length; y++) {
      const row = def.rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || pal[ch] === undefined) continue;
        g.fillRect(dx + x, dy + y, 1, 1);
      }
    }
  }

  function spriteSize(name) {
    const def = SPRITES[name];
    return { w: def.rows[0].length, h: def.rows.length };
  }

  /** Ombre portée elliptique sous un acteur — ancre le sprite au sol. */
  function shadow(ctx, cx, cy, w, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.34 : alpha;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.5, w * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  NEX.SPRITES = SPRITES;
  NEX.spriteCanvas = spriteCanvas;
  NEX.spriteOutlined = spriteOutlined;
  NEX.spriteSize = spriteSize;
  NEX.spriteShadow = shadow;
})();
