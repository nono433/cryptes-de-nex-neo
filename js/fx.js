/* ============================================================
   fx.js — particules, nombres flottants, secousse d'écran
   Tampons à taille fixe : aucune allocation par boucle.
   Tout est exprimé en TUILES (pas en pixels) — le moteur de
   rendu met lui-même à l'échelle.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const TAU = Math.PI * 2;
  const MAX_P = 1100;

  class Fx {
    constructor() {
      this.px = new Float32Array(MAX_P);
      this.py = new Float32Array(MAX_P);
      this.vx = new Float32Array(MAX_P);
      this.vy = new Float32Array(MAX_P);
      this.life = new Float32Array(MAX_P);
      this.maxLife = new Float32Array(MAX_P);
      this.size = new Float32Array(MAX_P);
      this.grav = new Float32Array(MAX_P);
      this.add = new Uint8Array(MAX_P);
      this.col = new Array(MAX_P);
      this.count = 0;

      this.texts = [];
      this.rings = [];

      this.shakeAmt = 0;
      this.shakeMax = 0.001;
      this.shakeTime = 0;
      this.shakeX = 0;
      this.shakeY = 0;

      this.flash = null;
      this.ambientTimer = 0;
      this.pal = null;
      this.w = 60; this.h = 20;
    }

    setPalette(pal) { this.pal = pal; }
    setSize(w, h) { this.w = w; this.h = h; }

    /* -------------------------------------------------- particules */

    spawn(x, y, vx, vy, life, size, color, additive, gravity) {
      let i;
      if (this.count < MAX_P) {
        i = this.count++;
      } else {
        i = (Math.random() * MAX_P) | 0;
      }
      this.px[i] = x; this.py[i] = y;
      this.vx[i] = vx; this.vy[i] = vy;
      this.life[i] = life; this.maxLife[i] = life;
      this.size[i] = size;
      this.col[i] = color;
      this.add[i] = additive ? 1 : 0;
      this.grav[i] = gravity || 0;
    }

    update(dt) {
      /* --- particules */
      let w = 0;
      for (let i = 0; i < this.count; i++) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) continue;
        this.py[i] += this.vy[i] * dt;
        this.px[i] += this.vx[i] * dt;
        this.vy[i] += this.grav[i] * dt;
        const f = 1 - 1.7 * dt;
        const damp = f > 0 ? f : 0;
        this.vx[i] *= damp;

        if (w !== i) {
          this.px[w] = this.px[i]; this.py[w] = this.py[i];
          this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i];
          this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i];
          this.size[w] = this.size[i]; this.col[w] = this.col[i];
          this.add[w] = this.add[i]; this.grav[w] = this.grav[i];
        }
        w++;
      }
      this.count = w;

      /* --- textes flottants */
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y -= dt * 1.2;
        if (t.life <= 0) this.texts.splice(i, 1);
      }

      /* --- anneaux de choc */
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life -= dt;
        r.r += dt * 3.4;
        if (r.life <= 0) this.rings.splice(i, 1);
      }

      /* --- secousse d'écran */
      if (this.shakeTime > 0) {
        this.shakeTime -= dt;
        const k = Math.max(0, this.shakeTime / this.shakeMax);
        const a = this.shakeAmt * k * k;
        this.shakeX = (Math.random() * 2 - 1) * a * 0.045;
        this.shakeY = (Math.random() * 2 - 1) * a * 0.045;
        if (this.shakeTime <= 0) { this.shakeX = 0; this.shakeY = 0; this.shakeAmt = 0; }
      }

      /* --- flash plein écran */
      if (this.flash) {
        this.flash.life -= dt;
        if (this.flash.life <= 0) this.flash = null;
      }

      /* --- poussière ambiante : c'est elle qui fait « respirer » la crypte */
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0 && this.pal) {
        this.ambientTimer = 0.06 + Math.random() * 0.20;
        this.spawn(
          Math.random() * this.w,
          this.h + 0.5,
          (Math.random() * 2 - 1) * 0.05,
          -0.05 - Math.random() * 0.16,
          6 + Math.random() * 7,
          0.030 + Math.random() * 0.045,
          this.pal.dust,
          true, 0
        );
      }
    }

    /** Au changement d'étage : on repart d'un écran propre. */
    clear() {
      this.count = 0;
      this.texts.length = 0;
      this.rings.length = 0;
      this.flash = null;
      this.shakeTime = 0;
      this.shakeX = this.shakeY = 0;
      this.shakeAmt = 0;
    }

    /* -------------------------------------------------- émetteurs */

    hitBurst(x, y, color, dmg, crit) {
      const n = crit ? 24 : 13;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const s = 1.7 + Math.random() * (crit ? 5.5 : 3.1);
        this.spawn(x, y - 0.12, Math.cos(a) * s, Math.sin(a) * s - 0.7,
          0.26 + Math.random() * 0.34,
          0.045 + Math.random() * (crit ? 0.085 : 0.055),
          i % 3 === 0 ? "#ffffff" : color, true, 0);
      }
      this.ring(x, y, crit ? "#ffd45e" : color, crit ? 1.0 : 0.6);
      this.pop(x, y - 0.30, "-" + dmg, crit ? "#ffd45e" : "#ffffff", crit ? 1.55 : 1);
    }

    playerHurt(x, y, dmg) {
      this.pop(x, y - 0.45, "-" + dmg, "#ff6a78", 1.25);
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * TAU;
        this.spawn(x, y - 0.1, Math.cos(a) * 2.6, Math.sin(a) * 2.6 - 1,
          0.30 + Math.random() * 0.3, 0.05 + Math.random() * 0.05, "#ff5a6a", true, 0);
      }
      this.ring(x, y, "#ff5a6a", 0.8);
      this.flashScreen("#ff2040", 0.24, 0.26);
    }

    deathBurst(x, y, color) {
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * TAU;
        const s = 1.2 + Math.random() * 3.8;
        this.spawn(x, y - 0.1, Math.cos(a) * s, Math.sin(a) * s - 1.5,
          0.45 + Math.random() * 0.55, 0.05 + Math.random() * 0.075,
          i % 4 === 0 ? "#ffffff" : color, true, 1.4);
      }
      this.ring(x, y, color, 1.2);
    }

    stepPuff(x, y) {
      const col = this.pal ? this.pal.dust : "#8899aa";
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * TAU;
        this.spawn(x, y + 0.34, Math.cos(a) * 0.55, Math.sin(a) * 0.22 - 0.2,
          0.24, 0.030, col, false, 0.4);
      }
    }

    trapBurst(x, y) {
      for (let i = 0; i < 22; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        const s = 3 + Math.random() * 4.5;
        this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
          0.34 + Math.random() * 0.3, 0.045 + Math.random() * 0.05, "#ffb648", true, 11);
      }
      this.ring(x, y, "#ffb648", 1.0);
    }

    pickup(x, y, color) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * TAU;
        this.spawn(x, y - 0.1, Math.cos(a) * 1.5, -1.7 - Math.random() * 2.2,
          0.42, 0.040, color, true, 1.6);
      }
      this.ring(x, y, color, 0.55);
    }

    equipFlash(x, y, tier) {
      const col = NEX.tierColor(tier);
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * TAU;
        const s = 1.6 + Math.random() * 2.6;
        this.spawn(x, y - 0.15, Math.cos(a) * s, Math.sin(a) * s - 1.1,
          0.5 + Math.random() * 0.45, 0.045 + Math.random() * 0.04, col, true, 0.5);
      }
      this.ring(x, y, col, 1.15);
      this.pop(x, y - 0.55, NEX.tierName(tier).toUpperCase(), col, 1.15);
    }

    levelUp(x, y, level) {
      for (let i = 0; i < 52; i++) {
        const a = Math.random() * TAU;
        const s = 1.4 + Math.random() * 3.6;
        this.spawn(x, y - 0.15, Math.cos(a) * s, Math.sin(a) * s - 2.2,
          0.7 + Math.random() * 0.55, 0.045 + Math.random() * 0.055,
          i % 3 ? "#ffd45e" : "#ffffff", true, -1.3);
      }
      this.ring(x, y, "#ffd45e", 1.5);
      this.pop(x, y - 0.7, "NIVEAU " + level, "#ffd45e", 1.5);
      this.flashScreen("#ffd45e", 0.4, 0.18);
    }

    descendFlash(x, y) {
      const col = this.pal ? this.pal.accent : "#5de3ff";
      for (let i = 0; i < 40; i++) {
        this.spawn(x + (Math.random() * 2 - 1) * 0.5, y + 0.3,
          (Math.random() * 2 - 1) * 4.5, -2.2 - Math.random() * 3.4,
          0.6, 0.055, col, true, -0.7);
      }
      this.ring(x, y, col, 1.6);
      this.flashScreen(col, 0.5, 0.42);
    }

    teleportBurst(x, y) {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * TAU;
        this.spawn(x, y - 0.1, Math.cos(a) * 3.2, Math.sin(a) * 3.2,
          0.42, 0.050, "#ff5fd2", true, 0);
      }
      this.ring(x, y, "#ff5fd2", 1.3);
    }

    dodgePuff(x, y) {
      this.pop(x, y - 0.5, "ESQUIVE", "#a8f0ff", 1);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU;
        this.spawn(x, y - 0.1, Math.cos(a) * 2.2, Math.sin(a) * 2.2,
          0.26, 0.040, "#a8f0ff", true, 0);
      }
    }

    bump(x, y) {
      for (let i = 0; i < 6; i++) {
        this.spawn(x, y + 0.3, (Math.random() * 2 - 1) * 0.8, -0.5,
          0.22, 0.028, "#7a82a8", false, 1.2);
      }
    }

    victoryBurst(cx, cy) {
      for (let i = 0; i < 150; i++) {
        const a = Math.random() * TAU;
        const s = 2 + Math.random() * 8;
        this.spawn(cx + (Math.random() * 2 - 1) * 20, cy + (Math.random() * 2 - 1) * 11,
          Math.cos(a) * s, Math.sin(a) * s,
          1.1 + Math.random() * 0.8, 0.055 + Math.random() * 0.06,
          ["#ff5fd2", "#ffd45e", "#a06bff", "#ffffff"][i & 3], true, 0.4);
      }
    }

    /* -------------------------------------------------- utilitaires */

    ring(x, y, color, strength) {
      if (this.rings.length > 40) this.rings.shift();
      this.rings.push({ x, y, color, s: strength || 1, r: 0.2, life: 0.45, max: 0.45 });
    }

    pop(x, y, text, color, scale) {
      if (this.texts.length > 26) this.texts.shift();
      this.texts.push({ x, y, text, color, scale: scale || 1, life: 0.95, max: 0.95 });
    }

    shake(amount, time) {
      const t = (time || 300) / 1000;
      if (amount >= this.shakeAmt || this.shakeTime <= 0) {
        this.shakeAmt = amount;
        this.shakeTime = t;
        this.shakeMax = Math.max(0.001, t);
      }
    }

    flashScreen(color, life, peak) {
      this.flash = { color, life, max: life, peak: peak || 0.3 };
    }
  }

  NEX.Fx = Fx;
})();
