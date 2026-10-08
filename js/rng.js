/* ============================================================
   rng.js — générateur pseudo-aléatoire déterministe
   Une graine -> une partie. Sert aussi aux textures du décor.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});

  /** mulberry32 : rapide, correct, et entièrement reproductible. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Hachage de chaîne -> entier 32 bits (pour les graines textuelles). */
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Bruit de valeur stable : même graine -> mêmes taches de pierre. */
  function hash2(x, y, salt) {
    let h = (x * 374761393 + y * 668265263 + salt * 1442695041) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  class Rng {
    constructor(seed) {
      this.seed = seed >>> 0;
      this._n = mulberry32(this.seed);
    }
    next() { return this._n(); }
    /** Flottant dans [a, b). */
    range(a, b) { return a + this._n() * (b - a); }
    /** Entier dans [a, b] inclus. */
    int(a, b) { return a + Math.floor(this._n() * (b - a + 1)); }
    chance(pct) { return this._n() * 100 < pct; }
    pick(arr) { return arr[Math.floor(this._n() * arr.length)]; }
    /** Tirage pondéré : weights = [10, 0, 5] -> jamais le poids nul. */
    weighted(items, weights) {
      let total = 0;
      for (let i = 0; i < weights.length; i++) total += weights[i];
      if (total <= 0) return items[0];
      let roll = this._n() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll < 0) return items[i];
      }
      return items[items.length - 1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this._n() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  }

  NEX.Rng = Rng;
  NEX.mulberry32 = mulberry32;
  NEX.hashString = hashString;
  NEX.hash2 = hash2;
  NEX.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
})();
