/* ============================================================
   main.js — amorçage, boucle, entrées, états d'interface
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const $ = (id) => document.getElementById(id);
  const clamp = NEX.clamp;

  const DIRS = {
    up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    z: [0, -1], s: [0, 1], q: [-1, 0], d: [1, 0],
    w: [0, -1], a: [-1, 0],
  };

  const App = {
    game: null,
    ui: null,
    renderer: null,
    fx: null,
    audio: null,
    started: false,
    last: 0,
    mouseTile: null,
    hoverKey: null,
    startLock: 0,

    /* ============================================================
       amorçage
       ============================================================ */

    boot() {
      this.fx = new NEX.Fx();
      this.audio = new NEX.Audio();
      this.game = new NEX.Game(this.fx, this.audio);
      this.renderer = new NEX.Renderer($("game"));
      this.ui = new NEX.Ui(this.game);

      // La partie est créée AVANT wire() pour que le premier étage soit déjà
      // prêt à être affiché derrière l'écran-titre. Les palettes et la taille
      // du décor sont donc réglées à la main juste après.
      this.game.newRun();
      this.wire();

      this.fx.setPalette(this.game.map.pal);
      this.fx.setSize(this.game.map.w, this.game.map.h);

      this.renderer.resize();
      this.ui.refresh();
      this.renderer.snapTo(this.game.p.x, this.game.p.y);
      this.ui.showDepthCard(this.game.depth, this.game.decor);

      requestAnimationFrame((t) => this.frame(t));
    },

    /* ============================================================
       branchements
       ============================================================ */

    wire() {
      const g = this.game, ui = this.ui;

      // --- journal
      g.onLog = (text, type) => ui.pushLog(text, type);

      /*
       * Les écrans de fin sont déclenchés ICI, et non à chaque appelant :
       * la mort peut survenir aussi bien après une frappe, un déplacement,
       * une potion ou une descente. Centraliser évite d'oublier un chemin.
       */
      g.onState = (state) => {
        if (state === NEX.STATE.DEAD) setTimeout(() => this.ui.showEnd(false), 700);
        else if (state === NEX.STATE.WON) setTimeout(() => this.ui.showEnd(true), 700);
      };

      g.onLevel = (depth, decor) => {
        this.ui.showDepthCard(depth, decor);
        this.fx.setPalette(g.map.pal);
        this.fx.setSize(g.map.w, g.map.h);
        this.fx.clear();
      };

      // --- l'UI Notifie les actions du jeu
      ui.onUseItem = (i) => this.useItem(i);
      ui.onBuy = (i) => this.buy(i);

      // --- boutons
      $("btnStart").addEventListener("click", () => this.startGame());
      $("btnRestart").addEventListener("click", () => this.restart());
      $("btnSound").addEventListener("click", (e) => {
        e.stopPropagation();
        this.audio.unlock();
        const on = this.audio.toggle();
        e.currentTarget.classList.toggle("off", !on);
        e.currentTarget.textContent = on ? "♪" : "♪";
      });
      $("btnHelp").addEventListener("click", () => this.toggleHelp());

      // --- redimensionnement
      const ro = () => this.renderer.resize();
      window.addEventListener("resize", ro);
      if (window.ResizeObserver) new ResizeObserver(ro).observe($("canvasWrap"));

      // --- clavier
      window.addEventListener("keydown", (e) => this.onKey(e));

      // --- souris : survol de tuile + clic pour attaquer
      $("game").addEventListener("mousemove", (e) => this.onHover(e));
      $("game").addEventListener("mouseleave", () => {
        this.mouseTile = null;
        this.ui.hint("");
      });
      $("game").addEventListener("click", (e) => this.onClick(e));

      // --- écran-titre
      $("seedInput").addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") this.startGame();
      });

      // --- fond animé
      this.initBackdrop();
    },

    /* ============================================================
       fond animé
       ============================================================ */

    initBackdrop() {
      const cv = $("bgCanvas");
      const ctx = cv.getContext("2d");
      const motes = [];
      const resize = () => {
        cv.width = cv.clientWidth * clamp(window.devicePixelRatio || 1, 1, 2);
        cv.height = cv.clientHeight * clamp(window.devicePixelRatio || 1, 1, 2);
      };
      resize();
      window.addEventListener("resize", resize);

      for (let i = 0; i < 90; i++) {
        motes.push({
          x: Math.random(), y: Math.random(),
          r: 0.4 + Math.random() * 1.9,
          vx: (Math.random() * 2 - 1) * 0.000018,
          vy: -0.000012 - Math.random() * 0.00004,
          a: 0.10 + Math.random() * 0.42,
          hue: Math.random() < 0.62 ? "#5de3ff" : (Math.random() < 0.6 ? "#ffb648" : "#a06bff"),
        });
      }

      const draw = () => {
        const w = cv.width, h = cv.height;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        for (const m of motes) {
          m.x += m.vx; m.y += m.vy;
          if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
          if (m.x < -0.05) m.x = 1.05;
          if (m.x > 1.05) m.x = -0.05;
          const g = ctx.createRadialGradient(m.x * w, m.y * h, 0, m.x * w, m.y * h, m.r * 9);
          g.addColorStop(0, hexA(m.hue, m.a));
          g.addColorStop(1, hexA(m.hue, 0));
          ctx.fillStyle = g;
          ctx.fillRect(m.x * w - m.r * 9, m.y * h - m.r * 9, m.r * 18, m.r * 18);
        }
        requestAnimationFrame(draw);
      };
      draw();

      function hexA(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
      }
    },

    /* ============================================================
       boucle
       ============================================================ */

    frame(now) {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
      this.last = now;

      const g = this.game;

      // amortissement des flags d'animation
      for (const m of g.monsters) {
        if (m.lunge > 0) m.lunge = Math.max(0, m.lunge - dt * 5.2);
        if (m.hurtFlash > 0) m.hurtFlash = Math.max(0, m.hurtFlash - dt * 4.2);
      }
      if (g.p.hurtFlash > 0) g.p.hurtFlash = Math.max(0, g.p.hurtFlash - dt * 3.4);

      this.fx.update(dt);

      if (g.map) {
        this.renderer.follow(g.p.x, g.p.y, dt);
        this.renderer.render(g, this.fx, dt);
      }

      // mini-carte ~12 fois/s : suffisant, et ça ne coûte rien
      this._miniAcc = (this._miniAcc || 0) + dt;
      if (this._miniAcc > 0.08) {
        this._miniAcc = 0;
        if (g.map) this.ui.renderMinimap();
      }

      // indice contextuel
      if (this.mouseTile && g.state === NEX.STATE.PLAYING) this.updateHoverHint();

      requestAnimationFrame((t) => this.frame(t));
    },

    /* ============================================================
       états d'interface
       ============================================================ */

    startGame() {
      this.audio.unlock();
      this.audio.play("descend");

      const seedInput = $("seedInput").value.trim();
      if (seedInput && this.game.seedLabel !== seedInput) {
        this.restart(seedInput);
      }
      $("ovTitle").classList.add("hidden");
      this.started = true;
      this.game.setState(NEX.STATE.PLAYING);
      this.ui.refresh();
      this.ui.hint("Descends. L'escalier est là pour ça.");
    },

    restart(seed) {
      this.audio.unlock();
      this.fx.clear();
      this.game.newRun(seed === undefined ? undefined : seed);
      this.fx.setPalette(this.game.map.pal);
      this.fx.setSize(this.game.map.w, this.game.map.h);

      // newRun a déjà écrit dans le journal via onLog : on le repart de zéro
      // puis on rejoue les lignes déjà produites, sinon l'introduction disparaît.
      this.ui.clearLog();
      this.game.logEntries.forEach((e) => this.ui.pushLog(e.text, e.type));

      this.ui.refresh();
      this.renderer.snapTo(this.game.p.x, this.game.p.y);
      this.ui.showDepthCard(this.game.depth, this.game.decor);
      this.game.setState(NEX.STATE.PLAYING);
      $("ovEnd").classList.add("hidden");
      $("ovTitle").classList.add("hidden");
      this.started = true;
      this.audio.play("descend");
    },

    toggleHelp() {
      if (this.ui.openOverlay === "ovHelp") {
        this.ui.closeOverlay();
        this.game.setState(NEX.STATE.PLAYING);
        this.audio.play("close");
      } else {
        this.ui.openHelp();
        this.game.setState(NEX.STATE.HELP);
        this.audio.play("open");
      }
    },

    /* ============================================================
       sac / autel
       ============================================================ */

    useItem(i) {
      const g = this.game;
      if (g.state !== NEX.STATE.PLAYING && g.state !== NEX.STATE.BAG) return;
      if (!g.p.bag[i]) return;

      const ok = g.useBagItem(i);
      if (!ok) return;

      this.ui.refresh();
      this.ui.flashSlot(i);
      this.ui.closeOverlay();     // le sac se referme après l'action
      this.ui.renderBag();

      // Utiliser un objet consomme TOUJOURS un tour : boire une potion
      // pendant que trois rats te sautent dessus, ce n'est pas gratuit.
      // On repasse par PLAYING : endTurn n'anime les monstres que là.
      if (g.state !== NEX.STATE.PLAYING) g.setState(NEX.STATE.PLAYING);
      g.endTurn();
    },

    buy(i) {
      const g = this.game;
      if (g.state !== NEX.STATE.FORGE) return;
      const ok = g.buyOffer(i);
      if (!ok) { this.ui.renderForge(); return; }
      this.ui.refresh();
      this.ui.renderForge();
    },

    closeForge() {
      const g = this.game;
      if (g.state !== NEX.STATE.FORGE) return;
      this.ui.closeOverlay();
      g.closeForge();
    },

    /*
     * Les écrans de fin ne passent pas par ici : ils sont déclenchés par
     * le callback `onState` (voir wire()), qui couvre tous les chemins.
     */

    /* ============================================================
       entrées
       ============================================================ */

    onKey(e) {
      const g = this.game;
      const key = e.key;
      const low = typeof key === "string" ? key.toLowerCase() : "";

      // --- écran-titre
      if (!this.started) {
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      // --- écran de fin
      if (g.state === NEX.STATE.DEAD || g.state === NEX.STATE.WON) {
        if (low === "r") { e.preventDefault(); this.restart(); }
        else if (key === "Escape") { e.preventDefault(); this.restart(); }
        else if (low === "q") { e.preventDefault(); this.quit(); }
        return;
      }

      // --- superpositions
      if (this.ui.openOverlay) {
        if (key === "Escape") {
          e.preventDefault();
          if (this.ui.openOverlay === "ovForge") this.closeForge();
          else if (this.ui.openOverlay === "ovBag") { this.ui.closeOverlay(); g.setState(NEX.STATE.PLAYING); this.audio.play("close"); }
          else if (this.ui.openOverlay === "ovHero") { this.ui.closeOverlay(); g.setState(NEX.STATE.PLAYING); this.audio.play("close"); }
          else if (this.ui.openOverlay === "ovHelp") this.toggleHelp();
          this.ui.renderBag();
          return;
        }

        const which = this.ui.openOverlay;
        if (which === "ovBag") {
          if (key >= "1" && key <= "9") {
            e.preventDefault();
            this.useItem(parseInt(key, 10) - 1);
          }
        } else if (which === "ovForge") {
          if (key >= "1" && key <= "6") {
            e.preventDefault();
            this.buy(parseInt(key, 10) - 1);
          } else if (low === "x" || low === "f") {
            e.preventDefault();
            this.closeForge();
          }
        } else if (which === "ovHelp") {
          if (low === "h") { e.preventDefault(); this.toggleHelp(); }
        }
        return;
      }

      if (g.state !== NEX.STATE.PLAYING) return;

      // --- jeu
      switch (low) {
        case "i":
          e.preventDefault();
          this.ui.openBag();
          g.setState(NEX.STATE.BAG);
          this.audio.play("open");
          return;
        case "c":
          e.preventDefault();
          this.ui.openHero();
          g.setState(NEX.STATE.HERO);
          this.audio.play("open");
          return;
        case "h":
        case "?":
          e.preventDefault();
          this.toggleHelp();
          return;
        case "m": {
          e.preventDefault();
          this.audio.unlock();
          const on = this.audio.toggle();
          $("btnSound").classList.toggle("off", !on);
          return;
        }
        case "r":
          e.preventDefault();
          this.restart();
          return;
        case "x":
          e.preventDefault();
          if (g.onAltar) {
            g.openForge();
            this.ui.openForge();
          } else {
            g.openForge(); // journalise « il faut monter sur un autel »
          }
          return;
        case ">":
        case ".":
          if (g.onStairs) { e.preventDefault(); g.descend(); this.ui.refresh(); }
          return;
        case " ":
          e.preventDefault();
          if (g.onStairs) { g.descend(); this.ui.refresh(); }
          else g.wait();
          return;
        case "escape":
          e.preventDefault();
          this.quit();
          return;
      }

      if (key >= "1" && key <= "9") {
        e.preventDefault();
        this.useItem(parseInt(key, 10) - 1);
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        if (g.onStairs) { g.descend(); this.ui.refresh(); }
        return;
      }

      // --- déplacement
      const d = DIRS[low] || arrowDir(key);
      if (d) {
        e.preventDefault();
        this.move(d[0], d[1]);
      }
    },

    move(dx, dy) {
      const g = this.game;
      // Anti-rebond d'un double événement clavier, sans brider la répétition
      // automatique : maintenir une touche doit continuer d'avancer.
      const now = performance.now();
      if (now - this._lastMove < 25) return;
      this._lastMove = now;

      g.tryMove(dx, dy);
      this.ui.refresh();
    },

    /* --- souris --- */

    onHover(e) {
      const t = this.tileUnderPointer(e);
      this.mouseTile = t;
    },

    tileUnderPointer(e) {
      const g = this.game;
      if (!g.map) return null;
      const rect = $("game").getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const s = this.renderer.tile;
      const viewTilesX = this.renderer.viewTilesX;
      const viewTilesY = this.renderer.viewTilesY;
      const originX = viewTilesX / 2 - (this.renderer.camX + this.fx.shakeX);
      const originY = viewTilesY / 2 - (this.renderer.camY + this.fx.shakeY);
      const tx = Math.floor(x / s - originX);
      const ty = Math.floor(y / s - originY);
      if (!g.map.inBounds(tx, ty)) return null;
      return { x: tx, y: ty };
    },

    onClick(e) {
      const g = this.game;
      if (!this.started || g.state !== NEX.STATE.PLAYING) return;

      const t = this.tileUnderPointer(e);
      if (!t) return;

      // cliquer un monstre adjacent = frapper
      const m = g.monsterAt(t.x, t.y);
      if (m) {
        const dx = m.x - g.p.x, dy = m.y - g.p.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          g.playerAttack(m, dx, dy);

          g.endTurn();

          this.ui.refresh();
          return;
        }
        this.ui.hint("Trop loin : approche-toi d'abord.");
        return;
      }

      // cliquer l'escalier = descendre
      if (g.onStairs || (g.map.hasStairs && t.x === g.map.stairs.x && t.y === g.map.stairs.y)) {
        if (g.onStairs) {
          g.descend();
          this.ui.refresh();
        } else {
          this.ui.hint("L'escalier est ailleurs. Suis la lueur verte de la mini-carte.");
        }
        return;
      }

      // cliquer l'autel = commercer
      if (g.map.altar && t.x === g.map.altar.x && t.y === g.map.altar.y) {
        if (g.onAltar) {
          g.openForge();
          this.ui.openForge();
        } else {
          g.openForge();
        }
      }
    },

    updateHoverHint() {
      const g = this.game;
      const t = this.mouseTile;
      if (!t) { this.ui.hint(""); return; }
      if (g.map.at(t.x, t.y).type === NEX.TILE.WATER) { this.ui.hint("Eau — infranchissable"); return; }
      this.ui.hint("");
    },

    /** Quitter : on grise l'écran, puis on recharge la page. */
    quit() {
      this.audio.play("close");
      document.body.style.filter = "grayscale(1) brightness(.4)";
      setTimeout(() => {
        const loc = window.location;
        if (loc && typeof loc.reload === "function") loc.reload();
      }, 320);
    },
  };

  function arrowDir(key) {
    if (key === "ArrowUp") return [0, -1];
    if (key === "ArrowDown") return [0, 1];
    if (key === "ArrowLeft") return [-1, 0];
    if (key === "ArrowRight") return [1, 0];
    return null;
  }

  App._lastMove = 0;

  window.NEX = NEX;
  window.NEXApp = App;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => App.boot());
  } else {
    App.boot();
  }
})();
