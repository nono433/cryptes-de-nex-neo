/* ============================================================
   audio.js — sons entièrement synthétisés (WebAudio)
   Aucun fichier à charger : tout est oscillators + bruit.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});

  class Audio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.noise = null;
      this.last = {};
    }

    /** Doit être appelé depuis un geste utilisateur (autoplay policy). */
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      try {
        this.ctx = new AC();
      } catch (e) { this.enabled = false; return; }

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.30;

      // Un léger filtre global : ça « coherentise » les sons synthétisés.
      const shelf = this.ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 4200;
      shelf.gain.value = -4;

      this.master.connect(shelf);
      shelf.connect(this.ctx.destination);

      // Tampon de bruit blanc réutilisé par tous les effets percussifs.
      const len = this.ctx.sampleRate * 1.0;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }

    toggle() {
      this.enabled = !this.enabled;
      if (this.master) {
        this.master.gain.setTargetAtTime(this.enabled ? 0.30 : 0, this.ctx.currentTime, 0.02);
      }
      return this.enabled;
    }

    get t() { return this.ctx.currentTime; }

    /* -------------------------------------------------- briques */

    /** Une note simple avec enveloppe. */
    tone(freq, dur, type, gain, delay, sweepTo) {
      if (!this.ctx || !this.enabled) return;
      const t0 = this.t + (delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t0);
      if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + Math.min(0.012, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }

    /** Un souffle filtré — pour les impacts, les poudres, le feu. */
    noiseHit(dur, gain, filterType, freq, q, delay, sweepTo) {
      if (!this.ctx || !this.enabled || !this.noise) return;
      const t0 = this.t + (delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;

      const f = this.ctx.createBiquadFilter();
      f.type = filterType || "bandpass";
      f.frequency.setValueAtTime(freq, t0);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
      f.Q.value = q || 1;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    /** Limite les répétitions du même son dans la même milliseconde. */
    throttle(name, ms) {
      const now = performance.now();
      if (this.last[name] && now - this.last[name] < ms) return false;
      this.last[name] = now;
      return true;
    }

    /* -------------------------------------------------- banque de sons */

    play(name) {
      if (!this.ctx || !this.enabled) return;
      const fn = this["sfx_" + name];
      if (fn) fn.call(this);
    }

    sfx_hit() {
      if (!this.throttle("hit", 40)) return;
      this.noiseHit(0.11, 0.30, "bandpass", 1800, 1.1, 0, 400);
      this.tone(180, 0.09, "square", 0.14, 0, 70);
    }

    sfx_crit() {
      this.noiseHit(0.16, 0.42, "bandpass", 2600, 1.4, 0, 500);
      this.tone(300, 0.14, "sawtooth", 0.20, 0, 90);
      this.tone(880, 0.10, "triangle", 0.14, 0.03, 1500);
    }

    sfx_hurt() {
      if (!this.throttle("hurt", 90)) return;
      this.noiseHit(0.20, 0.34, "lowpass", 900, 0.8, 0, 200);
      this.tone(150, 0.20, "sawtooth", 0.18, 0, 55);
    }

    sfx_dodge() {
      this.noiseHit(0.16, 0.16, "highpass", 2600, 0.7, 0, 5200);
      this.tone(660, 0.10, "sine", 0.10, 0.02, 1320);
    }

    sfx_pickup() {
      this.tone(760, 0.07, "triangle", 0.16);
      this.tone(1140, 0.09, "triangle", 0.12, 0.055);
    }

    sfx_gold() {
      if (!this.throttle("gold", 60)) return;
      this.tone(1180, 0.06, "square", 0.09);
      this.tone(1560, 0.08, "square", 0.07, 0.04);
      this.tone(2100, 0.10, "triangle", 0.06, 0.08);
    }

    sfx_level() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => this.tone(f, 0.22, "triangle", 0.16, i * 0.075));
      this.noiseHit(0.5, 0.10, "highpass", 1800, 0.6, 0, 6000);
    }

    sfx_descend() {
      this.tone(330, 0.55, "sine", 0.16, 0, 82);
      this.noiseHit(0.55, 0.14, "lowpass", 1400, 0.7, 0, 200);
      this.tone(220, 0.5, "triangle", 0.10, 0.05, 110);
    }

    sfx_trap() {
      this.noiseHit(0.18, 0.34, "highpass", 2200, 0.9, 0, 700);
      this.tone(90, 0.22, "square", 0.16, 0, 40);
    }

    sfx_bump() {
      if (!this.throttle("bump", 120)) return;
      this.noiseHit(0.07, 0.10, "lowpass", 500, 0.7);
    }

    sfx_deny() {
      this.tone(200, 0.10, "square", 0.10);
      this.tone(150, 0.14, "square", 0.09, 0.08);
    }

    sfx_buy() {
      this.noiseHit(0.14, 0.20, "bandpass", 1200, 1.6, 0, 3000);
      const notes = [659, 880, 1318];
      notes.forEach((f, i) => this.tone(f, 0.18, "triangle", 0.13, 0.04 + i * 0.055));
    }

    sfx_forge() {
      this.tone(110, 0.5, "sawtooth", 0.10, 0, 220);
      this.tone(330, 0.4, "sine", 0.08, 0.06, 495);
      this.noiseHit(0.35, 0.08, "lowpass", 900, 0.6);
    }

    sfx_ui() {
      if (!this.throttle("ui", 50)) return;
      this.tone(520, 0.04, "triangle", 0.06, 0, 700);
    }

    sfx_open() {
      this.tone(300, 0.10, "sine", 0.08, 0, 480);
      this.tone(600, 0.08, "triangle", 0.05, 0.04);
    }

    sfx_close() {
      this.tone(480, 0.08, "sine", 0.07, 0, 300);
    }

    sfx_elite() {
      this.tone(140, 0.7, "sawtooth", 0.16, 0, 70);
      this.tone(210, 0.6, "square", 0.09, 0.06, 105);
      this.noiseHit(0.7, 0.12, "lowpass", 700, 0.5);
    }

    sfx_boss() {
      this.tone(70, 1.3, "sawtooth", 0.22, 0, 34);
      this.tone(105, 1.2, "square", 0.12, 0.08, 52);
      this.tone(280, 1.0, "triangle", 0.10, 0.18, 70);
      this.noiseHit(1.2, 0.16, "lowpass", 500, 0.4);
    }

    sfx_death() {
      this.tone(220, 1.4, "sawtooth", 0.20, 0, 42);
      this.tone(160, 1.6, "sine", 0.14, 0.10, 30);
      this.noiseHit(1.5, 0.14, "lowpass", 800, 0.5, 0, 90);
    }

    sfx_win() {
      const notes = [523, 659, 784, 1046, 1318, 1568];
      notes.forEach((f, i) => {
        this.tone(f, 0.5, "triangle", 0.15, i * 0.11);
        this.tone(f * 2, 0.35, "sine", 0.06, i * 0.11 + 0.02);
      });
      this.noiseHit(1.6, 0.10, "highpass", 1600, 0.5, 0.1, 7000);
    }
  }

  NEX.Audio = Audio;
})();
