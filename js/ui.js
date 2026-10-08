/* ============================================================
   ui.js — tout le DOM : panneaux, journal, sac, fiche, autel,
   aide, écran-titre, fin de partie, infobulles, mini-carte.
   ============================================================ */
(function () {
  const NEX = (window.NEX = window.NEX || {});
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  const KIND_CLASS = {
    good: "le good", bad: "le bad", hurt: "le hurt",
    loot: "le loot", epic: "le epic", crit: "le crit", sys: "le sys",
    plain: "le",
  };

  class Ui {
    constructor(game) {
      this.game = game;
      this.mini = $("minimap");
      this.miniCtx = this.mini.getContext("2d");
      this.tooltip = $("tooltip");
      this.depthCard = $("depthCard");
      this.toasts = $("toasts");
      this.openOverlay = null;

      this.bindStatic();
    }

    /* -------------------------------------------------- statique */

    bindStatic() {
      document.querySelectorAll("[data-close]").forEach((b) => {
        b.addEventListener("click", () => this.closeOverlay());
      });

      // Fermeture au clic sur le fond
      document.querySelectorAll(".overlay").forEach((ov) => {
        ov.addEventListener("mousedown", (e) => {
          if (e.target === ov && ov.id !== "ovTitle" && ov.id !== "ovEnd") this.closeOverlay();
        });
      });
    }

    /* -------------------------------------------------- journal */

    pushLog(text, type) {
      const box = $("log");
      const node = el("div", KIND_CLASS[type] || "le", escapeHtml(text));
      box.appendChild(node);
      while (box.childElementCount > 140) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    }

    clearLog() { $("log").innerHTML = ""; }

    /* -------------------------------------------------- panneaux */

    refresh() {
      const g = this.game;
      const p = g.p;

      // barre de vie
      const hpFrac = Math.max(0, p.hp / p.maxHp);
      $("hpFill").style.width = (hpFrac * 100).toFixed(1) + "%";
      $("hpNow").textContent = p.hp;
      $("hpMax").textContent = p.maxHp;

      const xpFrac = Math.max(0, p.xp / p.xpNext);
      $("xpFill").style.width = (xpFrac * 100).toFixed(1) + "%";
      $("xpNow").textContent = p.xp;
      $("xpNext").textContent = p.xpNext;

      $("statLevel").textContent = p.level;
      $("statAtk").textContent = p.atk;
      $("statDef").textContent = p.def;
      $("statCrit").textContent = p.crit + "%";
      $("statDodge").textContent = p.dodge + "%";
      $("statSight").textContent = p.sight;
      $("statGold").textContent = p.gold;

      $("depthNum").textContent = g.depth;
      $("depthName").textContent = g.decor.name;
      $("seedChip").textContent = g.seedLabel;

      this.renderKit();
      this.renderGearList();
      this.renderHotbar();
    }

    renderKit() {
      const row = $("kitRow");
      row.innerHTML = "";
      NEX.SLOTS.forEach((slot, i) => {
        const gear = this.game.p.gear[i];
        const cell = el("div", "kit-cell" + (gear ? " has t" + gear.tier : ""));
        cell.textContent = slot.glyph;
        cell.style.color = gear ? NEX.tierColor(gear.tier) : "";
        if (gear) {
          cell.addEventListener("mouseenter", (e) =>
            this.showTooltip(e, gear.name, gear.effect,
              gear.setName ? "ensemble " + gear.setName : null));
          cell.addEventListener("mouseleave", () => this.hideTooltip());
        } else {
          cell.title = slot.label;
        }
        row.appendChild(cell);
      });
    }

    renderGearList() {
      const box = $("gearList");
      box.innerHTML = "";
      NEX.SLOTS.forEach((slot, i) => {
        const gear = this.game.p.gear[i];
        const row = el("div", "gear-row" + (gear ? " t" + gear.tier : " empty"));
        row.innerHTML =
          `<span class="gi">${slot.glyph}</span>` +
          `<span class="gn">${gear ? escapeHtml(gear.name) : slot.label}</span>` +
          `<span class="gt">${gear ? NEX.tierName(gear.tier) : "—"}</span>`;
        if (gear) {
          row.addEventListener("mouseenter", (e) =>
            this.showTooltip(e, gear.name, gear.effect,
              gear.setName ? "ensemble " + gear.setName : null));
          row.addEventListener("mouseleave", () => this.hideTooltip());
        }
        box.appendChild(row);
      });

      const sets = $("setList");
      sets.innerHTML = "";
      const active = this.game.p.setsActive;
      if (!active.length) {
        sets.appendChild(el("div", "set-chip",
          "Aucun ensemble actif — porte 2 à 4 pièces du même nom."));
      } else {
        active.forEach((a) => {
          sets.appendChild(el("div", "set-chip",
            `<b style="color:${NEX.SETS[a.set].color}">${a.set} ${a.pieces}</b> — ${a.text}`));
        });
      }
    }

    renderHotbar() {
      const bar = $("hotbar");
      bar.innerHTML = "";
      const bag = this.game.p.bag;
      for (let i = 0; i < NEX.MAX_ITEMS; i++) {
        const item = bag[i];
        const slot = el("div", "slot" + (item ? "" : " empty"));
        slot.dataset.index = i;
        if (item) {
          const gearIcon = item.kind === "gear" ? "✦" : glyphFor(item);
          slot.innerHTML =
            `<span class="key">${i + 1}</span>` +
            `<span class="ic" style="color:${item.color}">${gearIcon}</span>` +
            `<span class="nm">${escapeHtml(item.short)}</span>`;
          slot.addEventListener("click", () => this.onUseItem && this.onUseItem(i));
          slot.addEventListener("mouseenter", (e) =>
            this.showTooltip(e, item.name, item.effect, null,
              item.kind === "gear" ? NEX.tierName(item.tier) : null,
              isObsolete(item, this.game.p)
                ? "Cette pièce est dépassée par ce que tu portes : elle sera jetée."
                : null));
          slot.addEventListener("mouseleave", () => this.hideTooltip());
        } else {
          slot.innerHTML = `<span class="key">${i + 1}</span>`;
        }
        bar.appendChild(slot);
      }
    }

    flashSlot(i) {
      const slot = $("hotbar").children[i];
      if (!slot) return;
      slot.classList.remove("flash");
      void slot.offsetWidth;
      slot.classList.add("flash");
    }

    /* -------------------------------------------------- infobulle */

    showTooltip(e, name, effect, tag, tierLabel, note) {
      const t = this.tooltip;
      t.innerHTML =
        `<span class="tt-n">${escapeHtml(name)}</span>` +
        (effect ? `<span class="tt-e">${escapeHtml(effect)}</span>` : "") +
        (tag ? `<div class="tt-e" style="margin-top:4px;color:${NEX.tierColor(4)}">${escapeHtml(tag)}</div>` : "") +
        (tierLabel ? `<div class="tt-e" style="opacity:.7">palier : ${escapeHtml(tierLabel)}</div>` : "") +
        (note ? `<div class="tt-x">${escapeHtml(note)}</div>` : "");
      t.classList.remove("hidden");

      const r = t.getBoundingClientRect();
      let x = e.clientX + 14;
      let y = e.clientY - r.height - 12;
      if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
      if (y < 8) y = e.clientY + 18;
      t.style.left = x + "px";
      t.style.top = y + "px";
    }

    hideTooltip() { this.tooltip.classList.add("hidden"); }

    /* -------------------------------------------------- carte de titre */

    showDepthCard(depth, decor) {
      this.depthCard.querySelector(".dc-num").textContent = "PROFONDEUR " + depth;
      this.depthCard.querySelector(".dc-name").textContent = decor.name;
      this.depthCard.querySelector(".dc-tag").textContent = decor.tagline;
      this.depthCard.classList.remove("show");
      void this.depthCard.offsetWidth;
      this.depthCard.classList.add("show");
    }

    toast(text, kind) {
      const t = el("div", "toast" + (kind ? " " + kind : ""), escapeHtml(text));
      this.toasts.appendChild(t);
      setTimeout(() => t.remove(), 2100);
    }

    hint(text) {
      const h = $("hint");
      if (!text) { h.classList.remove("show"); return; }
      h.textContent = text;
      h.classList.add("show");
      clearTimeout(this._hintT);
      this._hintT = setTimeout(() => h.classList.remove("show"), 2600);
    }

    /* -------------------------------------------------- superpositions */

    open(id) {
      this.closeOverlay();
      const ov = $(id);
      ov.classList.remove("hidden");
      this.openOverlay = id;
      this.hideTooltip();
    }

    closeOverlay() {
      if (this.openOverlay) {
        $(this.openOverlay).classList.add("hidden");
        this.openOverlay = null;
      }
      this.hideTooltip();
    }

    /* ---- sac ---- */

    openBag() {
      this.renderBag();
      this.open("ovBag");
    }

    renderBag() {
      const grid = $("bagGrid");
      grid.innerHTML = "";
      const bag = this.game.p.bag;

      $("bagCount").textContent = bag.length + " / " + NEX.MAX_ITEMS + " objets";

      if (!bag.length) {
        grid.appendChild(el("div", "bag-empty", "Ton sac est vide. Marche sur les objets au sol pour les ramasser."));
        return;
      }

      bag.forEach((item, i) => {
        const obsolete = isObsolete(item, this.game.p);
        const tier = item.kind === "gear" ? item.tier : null;
        const card = el("div",
          "item-card" + (item.kind === "gear" ? " gear t" + item.tier : "") + (obsolete ? " obsolete" : ""));
        card.innerHTML =
          `<span class="num">${i + 1}</span>` +
          `<div class="ic-top">` +
          `<span class="ic" style="color:${item.color}">${item.kind === "gear" ? "✦" : glyphFor(item)}</span>` +
          `<span class="nm" style="color:${item.kind === "gear" ? NEX.tierColor(item.tier) : "#e8ecff"}">` +
          `${escapeHtml(item.name)}</span></div>` +
          `<div class="ef">${escapeHtml(item.effect || (item.kind === "gear" ? "" : ""))}</div>` +
          (tier ? `<div class="ef" style="opacity:.7;margin-top:3px">palier : ${NEX.tierName(item.tier)}` +
            (item.setName ? ` · ensemble ${escapeHtml(item.setName)}` : "") + `</div>` : "") +
          (obsolete ? `<div class="ef" style="color:#7d84ab;margin-top:3px">dépassée par ce que tu portes</div>` : "");
        card.addEventListener("click", () => this.onUseItem && this.onUseItem(i));
        card.addEventListener("mouseenter", (e) => this.showTooltip(e, item.name, item.effect,
          item.setName ? "ensemble " + item.setName : null, null,
          obsolete ? " sera jetée si tu l'utilises" : null));
        card.addEventListener("mouseleave", () => this.hideTooltip());
        grid.appendChild(card);
      });
    }

    /* ---- fiche du héros ---- */

    openHero() {
      this.renderHero();
      this.open("ovHero");
    }

    renderHero() {
      const g = this.game, p = g.p;
      const box = $("heroSheet");
      box.innerHTML = "";

      /* --- colonne gauche : stats --- */
      const left = el("div", "sheet-block");
      left.appendChild(el("h4", null, "Le héros"));

      const grid = el("div", "sheet-grid");
      const rows = [
        ["NIVEAU", p.level],
        ["VITALITÉ", p.hp + " / " + p.maxHp],
        ["EXPÉRIENCE", p.xp + " / " + p.xpNext],
        ["ATTAQUE", p.atk],
        ["DÉFENSE", p.def],
        ["CRITIQUE", p.crit + "%"],
        ["ESQUIVE", p.dodge + "%"],
        ["PORTÉE DE VUE", p.sight + " cases"],
        ["OR", p.gold],
        ["ABBATTUS", g.kills],
      ];
      rows.forEach(([k, v]) => {
        grid.appendChild(el("div", "sheet-stat", `<span>${k}</span><b>${v}</b>`));
      });
      left.appendChild(grid);

      if (p.regen > 0) {
        left.appendChild(el("p", "ov-dim",
          `Régénération : +${p.regen} PV à chaque descente.`));
      }
      left.appendChild(el("p", "ov-dim",
        `Dégâts infligés : <b>1 à ${p.atk + 2}</b> avant défense. Un coup critique (${p.crit} %) fait le double.`));

      /* --- ensembles --- */
      left.appendChild(el("h4", null, "Ensembles"));
      const setBox = el("div", "set-list");
      Object.keys(NEX.SETS).forEach((key) => {
        const set = NEX.SETS[key];
        const have = p.countSet(key);
        const steps = set.steps.map((s) => {
          const on = have >= s.pieces;
          return `<div style="font-family:var(--mono);font-size:9.5px;
            color:${on ? set.color : "#5c6285"};margin-top:3px">
            ${have >= s.pieces ? "✓" : "·"} ${s.pieces} pièces — ${escapeHtml(s.text)}</div>`;
        }).join("");
        setBox.appendChild(el("div",
          "sg" + (have ? "" : " empty"),
          `<div class="gicon" style="color:${set.color}">◈</div>` +
          `<div><div class="gname" style="color:${have ? set.color : ""}">ensemble ${key}</div>` +
          `<div class="gstat">${have} / ${set.steps[set.steps.length - 1].pieces} pièces</div>${steps}</div>`));
      });
      left.appendChild(setBox);

      /* --- colonne droite : équipement --- */
      const right = el("div", "sheet-block");
      right.appendChild(el("h4", null, "Équipement"));

      const gearBox = el("div", "sheet-gear");
      NEX.SLOTS.forEach((slot, i) => {
        const gear = p.gear[i];
        const row = el("div", "sg" + (gear ? " t" + gear.tier : " empty"));
        row.innerHTML =
          `<div class="gicon" style="${gear ? "color:" + NEX.tierColor(gear.tier) : ""}">${slot.glyph}</div>` +
          `<div><div class="gname">${gear ? escapeHtml(gear.name) : slot.label + " — vide"}</div>` +
          `<div class="gstat">${gear ? escapeHtml(gear.effect) : "rien de'équipé ici"}</div></div>`;
        gearBox.appendChild(row);
      });
      right.appendChild(gearBox);

      const active = p.setsActive;
      right.appendChild(el("h4", null, "Bonus actifs"));
      const actBox = el("div", "set-list");
      if (!active.length) {
        actBox.appendChild(el("div", "set-chip", "aucun"));
      } else {
        active.forEach((a) => actBox.appendChild(el("div", "set-chip",
          `<b style="color:${NEX.SETS[a.set].color}">${a.set} ${a.pieces}</b> — ${a.text}`)));
      }
      right.appendChild(actBox);

      box.appendChild(left);
      box.appendChild(right);
    }

    /* ---- autel ---- */

    openForge() {
      this.renderForge();
      this.open("ovForge");
    }

    renderForge() {
      const g = this.game;
      const grid = $("forgeGrid");
      grid.innerHTML = "";
      $("forgeGold").textContent = "tu as " + g.p.gold + " pièces";

      g.offers.forEach((offer, i) => {
        const item = offer.item;
        const poor = g.p.gold < offer.price;
        const card = el("div", "offer t" + item.tier + (poor ? " poor" : ""));
        card.innerHTML =
          `<span class="num">${i + 1}</span>` +
          `<div class="slotline">${NEX.SLOTS[item.slotIndex].label.toUpperCase()}</div>` +
          `<div class="gname">${escapeHtml(item.name)}</div>` +
          `<div class="gstat">${escapeHtml(item.effect)}</div>` +
          (item.setName ? `<span class="setbadge">ensemble ${escapeHtml(item.setName)}</span>` : "") +
          `<div class="price"><b>${offer.price}</b> or ${poor ? "— trop cher" : ""}</div>`;
        card.addEventListener("click", () => this.onBuy && this.onBuy(i));
        card.addEventListener("mouseenter", (e) => this.showTooltip(e, item.name, item.effect,
          item.setName ? "ensemble " + item.setName : null, NEX.tierName(item.tier)));
        card.addEventListener("mouseleave", () => this.hideTooltip());
        grid.appendChild(card);
      });
    }

    /* ---- fin ---- */

    showEnd(won) {
      const g = this.game;
      $("endGlyph").textContent = won ? "◈" : "☠";
      $("endGlyph").className = "end-glyph " + (won ? "win" : "dead");
      $("endTitle").textContent = won ? "L'AMULETTE EST À TOI" : "TU ES MORT";
      $("endSub").textContent = won
        ? "Tu remontes des cryptes le dos courbé sous le poids de Nex. Derrière toi, quarante étages s'effondrent en silence."
        : g.endReason;

      const box = $("endStats");
      box.innerHTML = "";
      g.finalStats().forEach(([k, v]) => {
        box.appendChild(el("div", "end-stat",
          `<span class="es-k">${k}</span><span class="es-v">${v}</span>`));
      });

      const ov = $("ovEnd");
      ov.querySelector(".ov-inner").classList.toggle("win", won);
      this.closeOverlay();
      ov.classList.remove("hidden");
      this.openOverlay = null;
    }

    /* -------------------------------------------------- aide */

    openHelp() { this.open("ovHelp"); }

    /* -------------------------------------------------- barre d'étage */

    renderMinimap() {
      this.game.renderer && this.game.renderer.renderMinimap(this.miniCtx, this.game);
    }
  }

  /* -------------------------------------------------- utilitaires */

  function glyphFor(item) {
    switch (item.kind) {
      case "potion": return "🧪";
      case "elixir": return "⚗";
      case "whetstone": return "🪨";
      case "plate": return "🛡";
      case "bomb": return "✹";
      case "teleport": return "🌀";
      case "map": return "🗺";
      default: return "◈";
    }
  }

  /**
   * Une pièce est « dépassée » si l'emplacement déjà équipé la dépasse.
   * Elle ne mérite aucune place dans le sac.
   */
  function isObsolete(item, player) {
    if (item.kind !== "gear" || !player) return false;
    return item.outclassedBy(player.gear[item.slotIndex]);
  }

  function escapeHtml(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  NEX.Ui = Ui;
  NEX.escapeHtml = escapeHtml;
})();
