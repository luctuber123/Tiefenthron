"use strict";
/* Oberfläche: Werkzeuge, Maus, Tastatur, Anzeigen und Menüs. */
(function () {
  const $ = (id) => document.getElementById(id);
  const T = TT.T, B = TT.BAL, SAVE_KEY = "tiefenthron.save.v1", VIEW_KEY = "tiefenthron.view";
  const cv = $("game"), mini = $("mini");
  const toolDefs = [];
  let mctx = null;

  const ui = TT.ui = {
    tool: { kind: "select" },
    hx: -1, hy: -1, hmx: 0, hmy: 0,       // Feld und Bildschirmpunkt unter dem Mauszeiger
    hp: { mx: 0, my: 0, wx: 0, wy: 0 },   // derselbe Punkt samt Weltkoordinaten
    drag: null, pan: null, sel: 0, keys: {},
    // cx/cy = Blickziel, zoom = Vergrößerung; yaw/pitch = Drehung und Neigung der 3D-Kamera
    view: { cx: TT.W / 2, cy: TT.H / 2, zoom: 36, w: 800, h: 600, yaw: 0, pitch: 1.0 },
    mode3d: false, title: false,
    dpr: 1, paused: false, speed: 1, started: false, overlayOpen: false, endShown: false,
    lastMsg: 0, hudT: 0, miniT: 0, saveT: 0, infoText: "", hintText: "",
  };

  // Symbol aus js/icons.js als kleine Vektorgrafik (leer, falls es das Symbol nicht gibt)
  function iconSvg(key) {
    const d = TT.ICONS && TT.ICONS[key];
    return d ? '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="' + d + '"/></svg>' : "";
  }

  function deny(why) {
    if (why) TT.msg(TT.state, why, "warn");
    TT.sfx("deny");
  }

  function setTool(tool) {
    ui.tool = tool; ui.drag = null;
    refreshTools();
  }

  // Was die linke Maustaste gerade tun würde ("Auswählen" gräbt, wenn man auf Gestein zeigt)
  ui.kindNow = function () {
    if (ui.tool.kind !== "select") return ui.tool.kind;
    if (ui.drag) return ui.drag.dig ? "dig" : "select";
    const s = TT.state;
    if (ui.hx < 0) return "select";
    const i = ui.hy * s.W + ui.hx, t = s.tiles[i];
    if (s.seen[i] && t === T.ROCK) return "select";
    return (t < T.FLOOR || s.mark[i]) && !pick(ui.hp, false) ? "dig" : "select";
  };

  // Zwischen 2D- und 3D-Ansicht umschalten
  ui.setMode = function (on) {
    on = !!on && !!(TT.V3 && TT.V3.ok);
    ui.mode3d = on;
    $("game3d").style.display = on ? "block" : "none";
    $("b-view").textContent = on ? "Ansicht: 3D" : "Ansicht: 2D";
    $("b-view").style.display = TT.V3 && TT.V3.ok ? "" : "none";
    $("t-view").textContent = $("b-view").textContent;
    $("t-view").style.display = $("b-view").style.display;
    const z = ui.view.zoom / ui.dpr;                 // Zoomgrenzen der beiden Ansichten unterscheiden sich leicht
    ui.view.zoom = TT.clamp(z, on ? 16 : 14, on ? 90 : 80) * ui.dpr;
  };

  /* ---------- Werkzeugleiste ---------- */
  function buildTools() {
    const box = $("tools");
    const head = (t) => { const h = document.createElement("h3"); h.textContent = t; box.appendChild(h); };
    const add = (o) => {
      const b = document.createElement("button");
      b.className = "tool" + (o.cls ? " " + o.cls : "");
      b.innerHTML = '<i class="sw"></i><span class="nm"></span><span class="ct"></span><kbd></kbd>';
      const ic = iconSvg(o.icon);
      if (ic) { b.children[0].innerHTML = ic; b.children[0].style.color = o.color; }
      else b.children[0].style.background = o.color;      // ohne Symboldatei: farbiges Quadrat
      b.children[1].textContent = o.name;
      b.children[3].textContent = o.hot || "";
      b.addEventListener("click", () => {
        TT.audioOn = true;
        if (o.locked && o.locked()) { deny("Noch nicht erforscht – das Archiv arbeitet daran."); return; }
        o.pick();
        b.blur();
      });
      b.addEventListener("mouseenter", () => showTip(b, o));
      b.addEventListener("mouseleave", () => { $("tip").style.display = "none"; });
      box.appendChild(b);
      o.el = b; toolDefs.push(o);
    };

    head("Befehle");
    add({ name: "Auswählen", hot: "Esc", color: "#e9e4f5", icon: "select",
      desc: "Kreaturen und Felder ansehen. Klick oder Ziehen auf Gestein markiert es gleich zum Graben.",
      active: (t) => t.kind === "select", pick: () => setTool({ kind: "select" }) });
    add({ name: "Graben", hot: "G", color: "#37e0c8", icon: "dig",
      desc: "Bereich aufziehen: Wühler tragen markiertes Erdreich, Gold und Kristall ab. Auf einem markierten Feld beginnen löscht Markierungen.",
      active: (t) => t.kind === "dig", pick: () => setTool({ kind: "dig" }) });
    add({ name: "Greifen", hot: "H", color: "#ffe36e", icon: "hand",
      desc: "Linksklick auf eine Kreatur hebt sie auf (bis zu " + B.maxHeld + "). Rechtsklick auf eigenen Boden setzt eine wieder ab – ideal, um Kämpfer an die Front zu werfen.",
      cost: () => { const n = TT.heldCount(TT.state); return n ? n + "/" + B.maxHeld : ""; },
      active: (t) => t.kind === "hand", pick: () => setTool({ kind: "hand" }) });
    add({ name: "Abreißen", hot: "X", color: "#ff6a55", icon: "sell", desc: "Entfernt Räume, Türen und Fallen. Die Hälfte der Kosten kommt zurück.",
      active: (t) => t.kind === "sell", pick: () => setTool({ kind: "sell" }) });

    head("Räume");
    TT.ROOMS.forEach((r) => {
      if (!r) return;
      add({ name: r.name, hot: r.hot, color: r.color, icon: r.key, desc: r.desc, unit: "Gold pro Feld",
        cost: () => r.cost, locked: () => !TT.unlocked(TT.state, r), poor: () => TT.state.gold < r.cost,
        active: (t) => t.kind === "room" && t.id === r.id, pick: () => setTool({ kind: "room", id: r.id }) });
    });

    head("Türen & Fallen");
    TT.TRAPS.forEach((tr) => {
      add({ name: tr.name, color: "#c3ccd6", icon: tr.key, desc: tr.desc, unit: "Bauteile", cls: "parts",
        cost: () => tr.parts, locked: () => !TT.unlocked(TT.state, tr), poor: () => TT.state.parts < tr.parts,
        active: (t) => t.kind === "trap" && t.key === tr.key, pick: () => setTool({ kind: "trap", key: tr.key }) });
    });

    head("Zauber");
    TT.SPELLS.forEach((sp) => {
      add({ name: sp.name, color: "#c690ff", icon: sp.key, desc: sp.desc, unit: "Essenz", cls: "ess",
        cost: () => TT.spellCost(TT.state, sp), locked: () => !TT.unlocked(TT.state, sp),
        poor: () => TT.state.ess < TT.spellCost(TT.state, sp),
        active: (t) => t.kind === "spell" && t.key === sp.key,
        pick: () => {
          if (!sp.instant) { setTool({ kind: "spell", key: sp.key, def: sp }); return; }
          const r = TT.actSpell(TT.state, sp.key, TT.state.coreIdx);
          if (!r.ok) deny(r.why);
        } });
    });
  }

  function showTip(b, o) {
    const tip = $("tip");
    let h = "<b>" + o.name + "</b>";
    const locked = o.locked && o.locked();
    if (o.cost && o.unit && !locked) h += ' &nbsp;<span class="c">' + o.cost() + " " + o.unit + "</span>";
    h += "<br>" + o.desc;
    if (locked) h += '<br><span class="l">Muss erst im Archiv erforscht werden.</span>';
    tip.innerHTML = h;
    tip.style.display = "block";
    tip.style.top = Math.max(50, Math.min(window.innerHeight - tip.offsetHeight - 8, b.getBoundingClientRect().top)) + "px";
  }

  function refreshTools() {
    for (const o of toolDefs) {
      const locked = !!(o.locked && o.locked());
      o.el.classList.toggle("active", o.active(ui.tool));
      o.el.classList.toggle("locked", locked);
      o.el.classList.toggle("poor", !locked && !!(o.poor && o.poor()));
      const txt = locked ? "–" : o.cost ? String(o.cost()) : "";
      if (o.el.children[2].textContent !== txt) o.el.children[2].textContent = txt;
    }
  }

  /* ---------- Anzeigen ---------- */
  function setText(id, txt) { const el = $(id); if (el.textContent !== txt) el.textContent = txt; }

  function hud(s) {
    const c = TT.countOwn(s), cap = TT.goldCap(s);
    setText("v-gold", String(Math.floor(s.gold)));
    setText("v-goldcap", "/ " + cap);
    $("st-gold").classList.toggle("full", s.gold >= cap);
    setText("v-ess", String(Math.floor(s.ess)));
    setText("v-esscap", "/ " + TT.essCap(s));
    setText("v-parts", String(Math.floor(s.parts)));
    setText("v-horde", c.fighters + " / " + TT.roomCount(s, "lair"));
    setText("v-workers", "· " + c.workers + " Wühler");

    let wages = 0;
    for (const e of s.ents) wages += TT.wageOf(e);
    setText("v-pay", "Zahltag " + TT.fmtTime(s.payT) + (wages ? " · " + wages + " Gold" : ""));

    const R = s.research, item = R.cur && TT.RESEARCH.find((r) => r.key === R.cur);
    setText("v-research", item ? item.name : "Alles erforscht");
    $("v-researchbar").style.width = (item ? Math.min(100, R.pts / item.cost * 100) : 100) + "%";

    setText("v-wave", c.foes ? c.foes + " Eindringlinge im Dungeon!" : "Überfall " + (s.waveN + 1) + " in " + TT.fmtTime(s.waveT));
    $("st-wave").classList.toggle("alert", c.foes > 0 || s.waveT < 25);
    $("b-call").style.display = s.waveT > 5 && !c.foes ? "" : "none";
    setText("b-pause", ui.paused ? "Weiter" : "Pause");
  }

  // Gibt es Markierungen, aber keine einzige grenzt an begehbaren Boden?
  function unreachableMarks(s) {
    if (s.mark.indexOf(1) < 0) return false;
    const W = s.W, d = TT.flood(s, s.coreIdx + 1, false).dist;
    for (let i = W + 1; i < s.mark.length - W - 1; i++) {
      if (s.mark[i] && (d[i + 1] >= 0 || d[i - 1] >= 0 || d[i + W] >= 0 || d[i - W] >= 0)) return false;
    }
    return true;
  }

  // Der Einflüsterer: sagt dir, was als Nächstes sinnvoll wäre
  function hintFor(s) {
    if (!ui.started || s.over) return "";
    const rc = (k) => TT.roomCount(s, k);
    if (ui.paused) return "Pause – du kannst trotzdem in Ruhe markieren und bauen. Leertaste setzt fort.";
    if (unreachableMarks(s)) return "Deine Markierungen grenzen an keinen Gang – die Wühler kommen nicht heran. Markiere durchgehend von deinem Dungeon aus.";
    if ((s._claimed || 25) <= 25 && s.mark.indexOf(1) < 0) return "Klicke auf das Erdreich oder ziehe mit gedrückter linker Maustaste darüber, um es zum Graben zu markieren. Deine Wühler erledigen den Rest.";
    if (!s.rift.on) return "Im " + TT.compass(s, s.rift.idx) + " pulsiert ein Riss (violett auf der Übersichtskarte). Grabe einen Gang dorthin – die Wühler nehmen ihn in Besitz.";
    if (!rc("lair")) return "Der Riss gehört dir. Baue eine Schlafhöhle (2) auf beanspruchtem Boden – ein Feld pro Kreatur.";
    if (!rc("garden")) return "Hungrige Kreaturen werden wütend und gehen. Baue einen Pilzgarten (3).";
    if (!rc("treasury")) return "Markiere die glitzernden Goldadern zum Abbau und baue eine Schatzkammer (1), damit das Gold Platz hat.";
    if (s.gold >= TT.goldCap(s)) return "Deine Lager sind voll. Mehr Schatzkammern – oder gib das Gold aus.";
    if (!rc("training")) return "Eine Übungshalle (4) macht aus Raufbolden Kämpfer.";
    if (!rc("archive")) return "Ein Archiv (5) lockt Flüsterer an. Sie erforschen Zauber, Schmiede und Kerker.";
    if (s.research.done.forge && !rc("forge")) return "Die Schmiede (6) ist erforscht. Ab 4 Feldern kommen Eisenwänste und fertigen Bauteile für Türen und Fallen.";
    if (s.research.done.prison && !rc("prison")) return "Der Kerker (7) ist erforscht: Besiegte Eindringlinge laufen dort mit der Zeit zu dir über.";
    if (s.waveN === 0 && s.waveT < 120) return "Die Oberwelt hat dich bemerkt. Halte Kämpfer in der Nähe des Herzkerns – der Zähler oben läuft.";
    if (s.waveN === 9 && !s.won) return "Der Lichtvogt selbst führt den zehnten Überfall an. Bezwinge ihn, und die Tiefe gehört dir.";
    return "";
  }

  // Kreatur unter dem Mauszeiger (p = Punkt aus toWorld)
  function pick(p, ownOnly) {
    if (ui.mode3d) return TT.V3.pickEnt(TT.state, ui.view, ui, p.mx, p.my, ownOnly);
    let best = null, bd = 0.75;
    for (const e of TT.state.ents) {
      if (e.held || e.dead || (ownOnly && e.foe)) continue;
      const d = Math.hypot(e.x - p.wx, e.y - p.wy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function creatureInfo(s, e) {
    const def = TT.CREATURES[e.type];
    let h = "<b>" + def.name + "</b> · Stufe " + e.lvl + (e.conv ? " · Überläufer" : e.foe ? " · Eindringling" : "");
    h += "<br>Leben " + Math.max(0, Math.ceil(e.hp)) + " / " + TT.maxHp(s, e);
    if (!e.foe && !e.worker) {
      h += "<br>Laune " + Math.round(Math.max(0, e.mood)) + " % · Hunger " + Math.round(e.hunger) + " %";
      h += "<br>Sold " + TT.wageOf(e) + " Gold" + (e.home < 0 ? ' · <span style="color:#ffb347">kein Schlafplatz</span>' : "");
    } else if (e.worker && e.carry > 0) h += "<br>trägt " + e.carry + " Gold";
    return h + "<br><i>" + TT.describe(s, e) + "</i>";
  }

  function infoFor(s) {
    if (ui.sel) {
      const e = TT.byId(s, ui.sel);
      if (e && !e.dead) return creatureInfo(s, e);
      ui.sel = 0;
    }
    if (ui.hx < 0 || ui.overlayOpen) return "";
    const e = pick(ui.hp, false);
    if (e) return creatureInfo(s, e);
    const i = ui.hy * s.W + ui.hx, t = s.tiles[i];
    if (!s.seen[i]) return "<b>Unerforscht</b><br><i>Niemand weiß, was hier liegt.</i>";
    if (i === s.coreIdx) return "<b>Herzkern</b><br>Leben " + Math.ceil(s.coreHp) + " / " + B.coreHp + "<br><i>Zerbricht er, ist alles verloren.</i>";
    if (i === s.rift.idx) return "<b>Riss</b><br><i>" + (s.rift.on ? "Durch ihn kommen neue Kreaturen." : "Noch herrenlos – lass ihn beanspruchen.") + "</i>";
    if (s.shafts.indexOf(i) >= 0) return "<b>Schacht zur Oberwelt</b><br><i>Hier steigen die Überfälle herab.</i>";
    if (s.obj[i]) {
      const tr = TT.trapAt(s, i), def = TT.TRAP_BY_OBJ[s.obj[i]];
      return "<b>" + def.name + "</b><br>" + (def.hp ? "Haltbarkeit " + Math.ceil(tr.hp) + " / " + def.hp : "noch " + tr.ch + " Auslösungen");
    }
    for (const p of s.pickups) if (p.idx === i) return "<b>Vergessene Truhe</b><br><i>Schick jemanden hin.</i>";
    if (t === T.ROCK) return "<b>Urfels</b><br><i>Unzerstörbar.</i>";
    if (t === T.EARTH) return "<b>Erdreich</b>" + (s.mark[i] ? "<br><i>Zum Graben markiert.</i>" : "");
    if (t === T.GOLD) return "<b>Goldader</b><br>noch " + s.ore[i] + " Gold";
    if (t === T.GEM) return "<b>Kristallader</b><br><i>Unerschöpflich, aber zäh.</i>";
    if (t === T.FLOOR) return "<b>Gang</b><br><i>Noch nicht beansprucht.</i>";
    if (s.room[i]) {
      const r = TT.ROOMS[s.room[i]];
      return "<b>" + r.name + "</b> · " + TT.roomCount(s, r.key) + " Felder<br><i>" + r.desc + "</i>";
    }
    return "<b>Dein Boden</b><br><i>Hier kannst du Räume bauen.</i>";
  }

  function pumpLog(s) {
    const box = $("log");
    for (const m of s.msgs) {
      if (m.id <= ui.lastMsg) continue;
      ui.lastMsg = m.id;
      const d = document.createElement("div");
      d.className = m.kind; d.textContent = m.text;
      box.appendChild(d);
      setTimeout(() => d.remove(), 10000);
    }
    while (box.children.length > 5) box.firstChild.remove();
  }

  /* ---------- Maus ---------- */
  function toWorld(ev) {
    const r = cv.getBoundingClientRect(), v = ui.view;
    const mx = (ev.clientX - r.left) * ui.dpr, my = (ev.clientY - r.top) * ui.dpr;
    if (ui.mode3d) {
      const p = TT.V3.pick(TT.state, v, ui, mx, my);
      return { mx: mx, my: my, wx: p.wx, wy: p.wy };
    }
    return { mx: mx, my: my, wx: (mx - v.w / 2) / v.zoom + v.cx, wy: (my - v.h / 2) / v.zoom + v.cy };
  }

  function commit(d, p) {
    const s = TT.state, W = s.W, tool = ui.tool;
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    const inb = d.x1 >= 0 && d.y1 >= 0 && d.x1 < W && d.y1 < s.H, i = d.y1 * W + d.x1;
    switch (tool.kind === "select" && d.dig ? "dig" : tool.kind) {
      case "select": { const e = pick(p, false); ui.sel = e ? e.id : 0; break; }
      case "dig": if (TT.actMark(s, x0, y0, x1, y1, d.on)) TT.sfx("mark"); break;
      case "room": { const r = TT.actBuild(s, tool.id, x0, y0, x1, y1); if (!r.built) deny(r.why); break; }
      case "sell": { const r = TT.actSell(s, x0, y0, x1, y1); if (r.gold) TT.msg(s, "Abgerissen: " + r.gold + " Gold zurück.", "info"); break; }
      case "trap": if (inb) { const r = TT.actTrap(s, tool.key, i); if (!r.ok) deny(r.why); } break;
      case "spell": if (inb) { const r = TT.actSpell(s, tool.key, i); if (!r.ok) deny(r.why); } break;
      case "hand": {
        const e = pick(p, true);
        if (e) { if (!TT.actGrab(s, e.id)) deny("Mehr passt nicht in deinen Griff."); }
        else if (inb) { const r = TT.actDrop(s, i); if (!r.ok) deny(r.why); }
        break;
      }
    }
    refreshTools();
  }

  function bindMouse() {
    cv.addEventListener("contextmenu", (ev) => ev.preventDefault());
    mini.addEventListener("contextmenu", (ev) => ev.preventDefault());

    cv.addEventListener("mousedown", (ev) => {
      TT.audioOn = true;
      if (ui.overlayOpen) return;
      const p = toWorld(ev), tx = Math.floor(p.wx), ty = Math.floor(p.wy), s = TT.state;
      if (ev.button === 0) {
        const inb = tx >= 0 && ty >= 0 && tx < s.W && ty < s.H, i = ty * s.W + tx;
        ui.drag = { x0: tx, y0: ty, x1: tx, y1: ty, on: true, dig: false };
        if (ui.tool.kind === "dig") { if (inb) ui.drag.on = !s.mark[i]; }
        else if (ui.tool.kind === "select" && inb && (s.tiles[i] < T.FLOOR || s.mark[i]) && !pick(p, false)) {
          // Ohne besonderes Werkzeug gilt: Gestein anklicken oder überziehen = graben lassen
          ui.drag.dig = true; ui.drag.on = !s.mark[i];
        }
      } else {
        // Rechte Taste: Karte schieben. In 3D dreht die mittlere Taste (oder Umschalt + rechte Taste) die Kamera.
        ui.pan = { mx: ev.clientX, my: ev.clientY, cx: ui.view.cx, cy: ui.view.cy, yaw: ui.view.yaw, pitch: ui.view.pitch,
          rot: ui.mode3d && (ev.button === 1 || ev.shiftKey), moved: false };
        ev.preventDefault();
      }
    });

    window.addEventListener("mousemove", (ev) => {
      const s = TT.state, v = ui.view;
      if (ui.pan) {
        const dx = (ev.clientX - ui.pan.mx) * ui.dpr, dy = (ev.clientY - ui.pan.my) * ui.dpr;
        if (Math.abs(dx) + Math.abs(dy) > 5) ui.pan.moved = true;
        if (ui.pan.moved) {
          if (ui.pan.rot) {
            v.yaw = ui.pan.yaw - dx * 0.006;
            v.pitch = TT.clamp(ui.pan.pitch + dy * 0.005, 0.55, 1.45);
          } else if (ui.mode3d) {
            // Pixel in Bodenstrecke umrechnen; "vorne" und "rechts" hängen von der Kameradrehung ab
            const k = 2 * (760 * ui.dpr / v.zoom) * Math.tan(19 * Math.PI / 180) / v.h, f = dy * k / Math.sin(v.pitch), r = dx * k;
            v.cx = ui.pan.cx - Math.cos(v.yaw) * r - Math.sin(v.yaw) * f;
            v.cy = ui.pan.cy + Math.sin(v.yaw) * r - Math.cos(v.yaw) * f;
          } else { v.cx = ui.pan.cx - dx / v.zoom; v.cy = ui.pan.cy - dy / v.zoom; }
        }
      }
      if (ev.target !== cv && !ui.drag) { ui.hx = -1; return; }
      const p = toWorld(ev), tx = Math.floor(p.wx), ty = Math.floor(p.wy);
      ui.hp = p; ui.hmx = p.mx; ui.hmy = p.my;
      if (tx < 0 || ty < 0 || tx >= s.W || ty >= s.H) { ui.hx = -1; } else { ui.hx = tx; ui.hy = ty; }
      if (ui.drag) { ui.drag.x1 = TT.clamp(tx, 0, s.W - 1); ui.drag.y1 = TT.clamp(ty, 0, s.H - 1); }
    });

    window.addEventListener("mouseup", (ev) => {
      if (ev.button === 0 && ui.drag) {
        const d = ui.drag;
        ui.drag = null;
        if (!ui.overlayOpen) commit(d, toWorld(ev));
      } else if (ev.button !== 0 && ui.pan) {
        if (!ui.pan.moved && ev.button === 2 && !ui.overlayOpen) {
          const s = TT.state;
          if (ui.tool.kind === "hand" && TT.heldCount(s) > 0) {
            // Rechtsklick mit vollem Griff: eine Kreatur absetzen
            const p = toWorld(ev), tx = Math.floor(p.wx), ty = Math.floor(p.wy);
            const r = tx >= 0 && ty >= 0 && tx < s.W && ty < s.H ? TT.actDrop(s, ty * s.W + tx) : { ok: false, why: "" };
            if (!r.ok) deny(r.why);
            refreshTools();
          } else { ui.sel = 0; setTool({ kind: "select" }); }
        }
        ui.pan = null;
      }
    });

    cv.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      if (ui.overlayOpen) return;
      const v = ui.view, p = toWorld(ev), f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      // Der Punkt unter dem Mauszeiger bleibt, wo er ist
      if (ui.mode3d) {
        const g0 = TT.V3.groundAt(v, ui, p.mx, p.my);
        v.zoom = TT.clamp(v.zoom * f, 16 * ui.dpr, 90 * ui.dpr);
        const g1 = TT.V3.groundAt(v, ui, p.mx, p.my);
        v.cx += g0[0] - g1[0]; v.cy += g0[1] - g1[1];
      } else {
        const z = TT.clamp(v.zoom * f, 14 * ui.dpr, 80 * ui.dpr);
        v.cx = p.wx - (p.mx - v.w / 2) / z; v.cy = p.wy - (p.my - v.h / 2) / z;
        v.zoom = z;
      }
    }, { passive: false });

    const jump = (ev) => {
      const r = mini.getBoundingClientRect(), s = TT.state;
      ui.view.cx = (ev.clientX - r.left) / r.width * s.W; ui.view.cy = (ev.clientY - r.top) / r.height * s.H;
    };
    mini.addEventListener("mousedown", (ev) => { ui.miniDrag = true; jump(ev); });
    mini.addEventListener("mousemove", (ev) => { if (ui.miniDrag && ev.buttons) jump(ev); });
    window.addEventListener("mouseup", () => { ui.miniDrag = false; });
  }

  /* ---------- Tastatur ---------- */
  function bindKeys() {
    window.addEventListener("keydown", (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      ui.keys[ev.code] = true;
      if (ev.repeat) return;
      if (ui.overlayOpen) {
        if ((ev.code === "Escape" || ev.code === "KeyM") && ui.started && ui.overlayKind === "menu") closeOverlay();
        else if (ev.code === "Escape" && ui.overlayKind === "help") closeOverlay();
        return;
      }
      if (ui.title) {                                   // im Hauptmenü: Eingabetaste = oberster Knopf
        if (ev.code === "Enter" || ev.code === "NumpadEnter") {
          ev.preventDefault();
          ($("t-continue").hidden ? $("t-new") : $("t-continue")).click();
        }
        return;
      }
      switch (ev.code) {
        case "Space": ui.paused = !ui.paused; ev.preventDefault(); break;
        case "Escape": ui.sel = 0; setTool({ kind: "select" }); break;
        case "KeyV": ui.setMode(!ui.mode3d); savePref(); break;
        case "KeyG": setTool({ kind: "dig" }); break;
        case "KeyH": setTool({ kind: "hand" }); break;
        case "KeyX": setTool({ kind: "sell" }); break;
        case "KeyF": cycleSpeed(); break;
        case "KeyM": openOverlay("menu"); break;
        default:
          if (/^Digit[1-9]$/.test(ev.code)) {
            const r = TT.ROOMS[Number(ev.code.slice(5))];
            if (r) { if (TT.unlocked(TT.state, r)) setTool({ kind: "room", id: r.id }); else deny("Noch nicht erforscht."); }
          }
      }
      if (ev.code.indexOf("Arrow") === 0) ev.preventDefault();
    });
    window.addEventListener("keyup", (ev) => { ui.keys[ev.code] = false; });
    window.addEventListener("blur", () => { ui.keys = {}; ui.drag = null; ui.pan = null; });
  }

  function cycleSpeed() {
    ui.speed = ui.speed >= 3 ? 1 : ui.speed + 1;
    $("b-speed").textContent = ui.speed + "×";
  }

  // Gewählte Ansicht merken
  function savePref() { try { localStorage.setItem(VIEW_KEY, ui.mode3d ? "3d" : "2d"); } catch (err) { /* egal */ } }
  function readPref() { try { return localStorage.getItem(VIEW_KEY); } catch (err) { return null; } }

  /* ---------- Speichern / Laden ---------- */
  function readSave() { try { return localStorage.getItem(SAVE_KEY); } catch (err) { return null; } }

  function saveGame(loud) {
    try {
      TT.state.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, TT.serialize(TT.state));
      if (loud) TT.msg(TT.state, "Spiel gespeichert.", "info");
      return true;
    } catch (err) {
      if (loud) TT.msg(TT.state, "Speichern nicht möglich – der Browser gibt keinen Speicher frei.", "warn");
      return false;
    }
  }

  function begin(fresh) {
    hideTitle();
    const s = TT.state;
    ui.view.cx = (s.coreIdx % s.W) + 0.5; ui.view.cy = ((s.coreIdx / s.W) | 0) + 0.5;
    ui.sel = 0; ui.started = true; ui.paused = false; ui.endShown = false; ui.saveT = 0;
    ui.lastMsg = fresh ? 0 : s.msgN;
    $("log").innerHTML = "";
    setTool({ kind: "select" });
  }

  function newGame() {
    TT.state = TT.newGame(((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9)) >>> 0);
    begin(true);
  }

  function loadGame() {
    const txt = readSave();
    if (!txt) return false;
    try { TT.state = TT.deserialize(txt); } catch (err) { return false; }
    begin(false);
    TT.msg(TT.state, "Spielstand geladen.", "info");
    return true;
  }

  /* ---------- Hauptmenü ----------
     Hinter dem Menü läuft ein fertig eingerichteter Beispiel-Dungeon, die Kamera kreist langsam. */
  let demo = null, confirmNew = 0;

  function makeDemo() {
    const s = TT.newGame(7), W = s.W, cx = s.coreIdx % W, cy = (s.coreIdx / W) | 0, ID = TT.ROOM_ID, r = TT.rng(5);
    TT.RESEARCH.forEach((q) => { s.research.done[q.key] = true; });
    s.research.cur = null;
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 10; x <= cx + 10; x++) {
      if (x < 1 || y < 1 || x > W - 2 || y > s.H - 2) continue;
      const i = y * W + x;
      s.tiles[i] = T.CLAIMED; s.ore[i] = 0; s.mark[i] = 0; s.dig[i] = 0;
    }
    TT.reveal(s, s.coreIdx, 15);
    [["treasury", -9, -5, -7, -3], ["lair", -5, -5, -2, -3], ["garden", 2, -5, 4, -3], ["training", 6, -5, 9, -3],
     ["archive", -9, 3, -6, 5], ["forge", -4, 3, -2, 5], ["prison", 5, 3, 8, 5]].forEach((q) => {
      for (let y = cy + q[2]; y <= cy + q[4]; y++) for (let x = cx + q[1]; x <= cx + q[3]; x++) {
        const i = y * W + x;
        if (TT.isSpecial(s, i)) continue;
        s.room[i] = ID[q[0]];
        if (q[0] === "garden") s.food[i] = 3;
      }
    });
    TT.countRooms(s);
    s.gold = Math.round(TT.goldCap(s) * 0.75);
    s.parts = 40;
    [["door", 0, 4], ["spike", 1, 4], ["flame", -1, 4]].forEach((q) => TT.actTrap(s, q[0], (cy + q[2]) * W + cx + q[1]));
    // Kreaturen in den Gängen rund um den Herzkern verteilen
    const free = [];
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 8; x <= cx + 8; x++) {
      const i = y * W + x;
      if (Math.abs(x - cx) > 2 && !s.room[i] && !s.obj[i] && !TT.isSpecial(s, i)) free.push(i);
    }
    ["schrat", "schrat", "schrat", "spucker", "spucker", "fluesterer", "fluesterer", "eisenwanst", "klinge", "klinge", "nachtmahr"].forEach((t) => {
      const e = TT.spawn(s, t, free[(r() * free.length) | 0], false);
      e.lvl = 1 + ((r() * 4) | 0); e.hp = TT.maxHp(s, e); e.hunger = r() * 40;
    });
    // zwei gefangene Helden, die nie überlaufen
    const cells = [];
    for (let i = 0; i < s.room.length; i++) if (s.room[i] === ID.prison) cells.push(i);
    s.prisoners.push({ type: "ritter", idx: cells[1], t: -1e9, lvl: 3 }, { type: "priester", idx: cells[cells.length - 2], t: -1e9, lvl: 2 });
    TT.actMark(s, cx + 11, cy - 3, cx + 14, cy + 2, true);          // die Wühler haben etwas zu tun
    s.waveT = 1e12; s.payT = 1e12; s.msgs = [];
    return s;
  }

  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return "gerade eben";
    if (m < 60) return "vor " + m + " Min.";
    const hh = Math.round(m / 60);
    if (hh < 48) return "vor " + hh + (hh === 1 ? " Stunde" : " Stunden");
    return "vor " + Math.round(hh / 24) + " Tagen";
  }

  function resetNewButton() {
    confirmNew = 0;
    $("t-new").classList.remove("confirm");
    $("t-new-label").textContent = "Neues Spiel";
    $("t-new-hint").textContent = readSave() ? "Beginnt auf einer neuen Karte" : "Eine neue Karte, ein neuer Herzkern";
  }

  function refreshTitle() {
    const txt = readSave();
    let info = "";
    if (txt) {
      try {
        const s = TT.deserialize(txt), c = TT.countOwn(s);
        info = (s.over ? "Herzkern zerbrochen" : "Überfall " + (s.waveN + 1) + " steht bevor") + " · " +
          c.fighters + " Kreaturen · " + TT.fmtTime(s.time) + " gespielt" + (s.savedAt ? " · " + ago(s.savedAt) : "");
      } catch (err) { info = ""; }
    }
    $("t-continue").hidden = !info;
    $("t-save").textContent = info;
    resetNewButton();
  }

  function showTitle() {
    closeOverlay();
    ui.title = true; ui.started = false; ui.paused = false; ui.sel = 0; ui.hx = -1;
    TT.state = demo || (demo = makeDemo());
    TT.quiet = true;                                       // der Beispiel-Dungeon macht keine Geräusche
    ui.view.zoom = 40 * ui.dpr; ui.view.pitch = 0.8;
    document.body.classList.add("title-mode");
    setTool({ kind: "select" });
    refreshTitle();
  }

  function hideTitle() {
    ui.title = false; TT.quiet = false;
    clearTimeout(confirmNew);
    document.body.classList.remove("title-mode");
  }

  function bindTitle() {
    $("t-credits").innerHTML = CREDITS.replace(/<\/?p[^>]*>/g, "");
    $("t-continue").addEventListener("click", () => {
      TT.audioOn = true;
      if (!loadGame()) $("t-save").textContent = "Der Spielstand ließ sich nicht laden.";
    });
    $("t-new").addEventListener("click", () => {
      TT.audioOn = true;
      // Gibt es einen Spielstand, muss der Neustart bestätigt werden – das automatische Speichern überschreibt ihn sonst
      if (readSave() && !confirmNew) {
        confirmNew = setTimeout(resetNewButton, 5000);
        $("t-new").classList.add("confirm");
        $("t-new-label").textContent = "Wirklich neu beginnen?";
        $("t-new-hint").textContent = "Nochmal klicken – dein gespeichertes Spiel wird dann überschrieben";
        return;
      }
      newGame();
    });
    $("t-help").addEventListener("click", () => { TT.audioOn = true; openOverlay("help"); });
    $("t-view").addEventListener("click", (ev) => { ui.setMode(!ui.mode3d); savePref(); ev.currentTarget.blur(); });
    $("t-sound").addEventListener("click", (ev) => { $("b-sound").click(); ev.currentTarget.blur(); });
  }

  /* ---------- Menüs ---------- */
  const HELP =
    "<ul>" +
    "<li><kbd>Linke Maustaste</kbd> Gestein anklicken oder überziehen: graben lassen · sonst: gewähltes Werkzeug benutzen</li>" +
    "<li><kbd>Rechte Maustaste</kbd> ziehen: Karte schieben · klicken: Werkzeug ablegen (beim Greifen: Kreatur absetzen)</li>" +
    "<li><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder Pfeiltasten: Karte schieben · <kbd>Mausrad</kbd> Zoom</li>" +
    "<li><kbd>Q</kbd> <kbd>E</kbd> Kamera drehen · <kbd>Umschalt</kbd> + rechte Maustaste ziehen: drehen und neigen · <kbd>V</kbd> 2D/3D</li>" +
    "<li><kbd>G</kbd> Graben · <kbd>H</kbd> Greifen · <kbd>X</kbd> Abreißen · <kbd>1</kbd>–<kbd>7</kbd> Räume</li>" +
    "<li><kbd>Leertaste</kbd> Pause · <kbd>F</kbd> Tempo · <kbd>M</kbd> Menü</li>" +
    "</ul>";

  // Namensnennung der verwendeten Grafikpakete (Einzelheiten: assets/QUELLEN.md)
  const CREDITS = '<p class="credits">Figuren und Umgebung: Kay Lousberg (KayKit) und Quaternius · Rahmen und Partikel: Kenney · ' +
    'Symbole: Lorc, Delapouite und Sbed, game-icons.net, CC BY 3.0 · Schrift: Cinzel · 3D-Technik: Three.js</p>';

  function openOverlay(kind) {
    const s = TT.state, hasSave = !!readSave();
    const loadBtn = hasSave ? '<button data-a="load">Spielstand laden</button>' : "";
    const stats = '<p class="stats">Überstandene Überfälle: ' + Math.max(0, s.waveN - (TT.countOwn(s).foes ? 1 : 0)) +
      " · Besiegte Eindringlinge: " + s.stats.kills + " · Gefallene Kreaturen: " + s.stats.lost +
      " · Gefördertes Gold: " + s.stats.mined + "</p>";
    let h;
    if (kind === "help") {
      h = "<h2>Anleitung</h2>" +
        "<p>Du bist der Geist im Herzkern. Lass graben, baue Räume, locke Kreaturen durch den Riss – und halte die " +
        "Helden der Oberwelt von deinem Kern fern. Wer zehn Überfälle übersteht und den Lichtvogt bezwingt, dem gehört die Tiefe.</p>" +
        HELP + '<div class="row"><button class="main" data-a="back">Zurück</button></div>' + CREDITS;
    } else if (kind === "menu") {
      h = "<h2>Pause</h2>" + HELP + '<div class="row"><button class="main" data-a="resume">Weiter</button>' +
        '<button data-a="save">Speichern</button><button data-a="title">Hauptmenü</button></div>' + CREDITS;
    } else if (kind === "over") {
      h = '<h2 class="bad">Der Herzkern ist zerbrochen</h2><p>Das Licht der Oberwelt flutet deine Gänge. Die Horde zerstreut sich, ' +
        "der Riss fällt in sich zusammen.</p>" + stats +
        '<div class="row"><button class="main" data-a="new">Neues Spiel</button>' + loadBtn + '<button data-a="title">Hauptmenü</button></div>';
    } else {
      h = "<h2>Die Tiefe gehört dir</h2><p>Der Lichtvogt ist gefallen, seine Fackeln sind erloschen. Kein Held wagt sich " +
        "mehr freiwillig in deine Gänge – fürs Erste.</p>" + stats +
        '<div class="row"><button class="main" data-a="resume">Weiterspielen (Endlos)</button><button data-a="title">Hauptmenü</button></div>';
    }
    const card = $("card");
    card.innerHTML = h;
    card.querySelectorAll("button[data-a]").forEach((b) => b.addEventListener("click", () => {
      TT.audioOn = true;
      const a = b.dataset.a;
      if (a === "new") { newGame(); closeOverlay(); }
      else if (a === "load") { if (loadGame()) closeOverlay(); }
      else if (a === "save") { saveGame(true); closeOverlay(); }
      else if (a === "title") { if (!TT.state.over) saveGame(false); showTitle(); }
      else closeOverlay();
    }));
    ui.overlayOpen = true; ui.overlayKind = kind; ui.drag = null; ui.pan = null;
    $("overlay").classList.add("open");
  }

  function closeOverlay() {
    ui.overlayOpen = false;
    $("overlay").classList.remove("open");
  }

  /* ---------- Start und Bild-für-Bild-Arbeit ---------- */
  ui.init = function () {
    mctx = mini.getContext("2d");
    buildTools();
    document.querySelectorAll("[data-ic]").forEach((el) => { el.innerHTML = iconSvg(el.dataset.ic); });
    bindMouse();
    bindKeys();
    $("b-pause").addEventListener("click", (ev) => { ui.paused = !ui.paused; ev.currentTarget.blur(); });
    $("b-speed").addEventListener("click", (ev) => { cycleSpeed(); ev.currentTarget.blur(); });
    $("b-sound").addEventListener("click", (ev) => {
      TT.muted = !TT.muted; TT.audioOn = true;
      ev.currentTarget.textContent = TT.muted ? "Ton aus" : "Ton an";
      $("t-sound").textContent = ev.currentTarget.textContent;
      ev.currentTarget.blur();
    });
    $("b-menu").addEventListener("click", (ev) => { openOverlay("menu"); ev.currentTarget.blur(); });
    $("b-call").addEventListener("click", (ev) => { TT.callWave(TT.state); ev.currentTarget.blur(); });
    $("b-view").addEventListener("click", (ev) => { ui.setMode(!ui.mode3d); savePref(); ev.currentTarget.blur(); });
    ui.setMode(readPref() !== "2d");          // 3D ist Standard, sofern der Browser es kann
    bindTitle();
    showTitle();
  };

  ui.frame = function (dt) {
    const s = TT.state, v = ui.view, k = ui.keys;
    if (ui.title) {
      // langsam um den Herzkern kreisen; Blickziel versetzt, damit der Dungeon rechts neben dem Menü liegt
      v.yaw += dt * 0.05;
      const off = window.innerWidth > 760 ? 6 : 0;
      v.cx = (s.coreIdx % s.W) + 0.5 - Math.cos(v.yaw) * off;
      v.cy = ((s.coreIdx / s.W) | 0) + 0.5 + Math.sin(v.yaw) * off;
    } else if (!ui.overlayOpen) {
      const sp = 20 * dt * (36 * ui.dpr / v.zoom);
      const right = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const yaw = ui.mode3d ? v.yaw : 0;               // in 3D zählt die Blickrichtung der Kamera
      v.cx += (Math.cos(yaw) * right - Math.sin(yaw) * fwd) * sp;
      v.cy += (-Math.sin(yaw) * right - Math.cos(yaw) * fwd) * sp;
      if (ui.mode3d) v.yaw += ((k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0)) * 1.8 * dt;
    }
    v.cx = TT.clamp(v.cx, 0, s.W); v.cy = TT.clamp(v.cy, 0, s.H);

    ui.hudT -= dt;
    if (ui.hudT <= 0) {
      ui.hudT = 0.15;
      hud(s); refreshTools(); pumpLog(s);
      const info = infoFor(s);
      if (info !== ui.infoText) { ui.infoText = info; $("info").innerHTML = info; }
      const hint = hintFor(s);
      if (hint !== ui.hintText) { ui.hintText = hint; $("hint").textContent = hint; }
    }
    ui.miniT -= dt;
    if (ui.miniT <= 0) { ui.miniT = 0.2; TT.drawMini(s, v, mctx, performance.now() / 1000, ui.mode3d ? TT.V3.viewPoly(v, ui) : null); }

    if (ui.started && !ui.overlayOpen) {
      if (s.over && !ui.endShown) { ui.endShown = true; openOverlay("over"); }
      else if (s.won && !s.wonShown) { s.wonShown = true; TT.sfx("win"); openOverlay("won"); }
      ui.saveT += dt;
      if (ui.saveT > 60 && !s.over) { ui.saveT = 0; saveGame(false); }
    }
  };
})();
