"use strict";
/* ============================================================
   TIEFENTHRON – Tutorial „Das Erwachen“
   Ein kleines Gebiet vor der Kampagne. Orm, der Steinflüsterer, führt Schritt für Schritt durch das Spiel.
   Jeder Schritt hat einen Text, optional einen hervorgehobenen Knopf (hl) und ein Ziel auf der Karte (target),
   auf das ein Pfeil zeigt. Ist die Bedingung (done) erfüllt, geht es weiter – auch mehrere Schritte auf einmal,
   wenn man schon vorgegriffen hat.
   ============================================================ */
(function () {
  const T = TT.T;

  TT.TUTORIAL = {
    id: "tutorial", name: "Das Erwachen", index: -1, x: 76, y: 96,
    W: 40, H: 30, seed: 4242, gold: 1500, shafts: 1,
    allow: ["treasury", "lair", "garden", "training", "worker", "eye"], known: [], research: [],
    creatures: ["schrat"], foes: ["miliz"],
    seals: 1, guards: ["miliz"],
    firstWave: 1e9, waveEvery: 1e9, budget: [2, 0], heroLvl: 0, par: 1500,
    boss: { type: "ritter", name: "Späherführer Wim", hp: 1.6, lvl: 1, escort: ["miliz"],
      taunt: "„Hier unten ist doch nichts. … Oder?“" },
    intro: [
      "Ein Riss geht durch den Kristall, in dem du tausend Jahre geschlafen hast. Etwas in dir regt sich – Hunger, Wut, Erinnerung.",
      "Eine alte Stimme spricht aus dem Fels: „Ich bin Orm. Ich zeige dir, wie man ein Reich aus Stein und Dunkelheit baut. Hör gut zu – oben warten sie schon.“",
    ],
    outro: "Der Späherführer liegt im Staub. Orm brummt zufrieden: „Du lernst schnell. Die Wachen der Kalten Wiege werden das bald merken.“",
  };

  // Hilfen für die Ziele
  function nearest(s, test) {
    const W = s.W, cx = s.coreIdx % W, cy = (s.coreIdx / W) | 0;
    let best = -1, bd = 1e9;
    for (let i = 0; i < s.tiles.length; i++) {
      if (!test(i)) continue;
      const d = Math.hypot((i % W) - cx, ((i / W) | 0) - cy);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // erstes Erdfeld auf dem Weg vom Herzkern zum Riss
  function digStart(s) {
    const W = s.W, cx = s.coreIdx % W, cy = (s.coreIdx / W) | 0, rx = s.rift.idx % W, ry = (s.rift.idx / W) | 0;
    for (let k = 1; k < 40; k++) {
      const f = k / 40, x = Math.round(cx + (rx - cx) * f), y = Math.round(cy + (ry - cy) * f), i = y * W + x;
      if (s.tiles[i] < T.FLOOR) return i;
    }
    return s.rift.idx;
  }
  const rc = (s, k) => TT.roomCount(s, k);

  TT.TUT_STEPS = [
    { title: "Umsehen",
      text: "Ich bin Orm, die Stimme im Fels. Sieh dich zuerst um: <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> oder die rechte Maustaste ziehen bewegt die Ansicht, das <kbd>Mausrad</kbd> zoomt, <kbd>Q</kbd> und <kbd>E</kbd> drehen die Kamera.",
      enter: function (s, t, ui) { t.cam = { cx: ui.view.cx, cy: ui.view.cy, zoom: ui.view.zoom, yaw: ui.view.yaw }; },
      done: function (s, t, ui) {
        const c = t.cam, v = ui.view;
        return !!c && (Math.hypot(v.cx - c.cx, v.cy - c.cy) > 2.5 || Math.abs(v.zoom / c.zoom - 1) > 0.18 || Math.abs(v.yaw - c.yaw) > 0.35);
      } },
    { title: "Graben",
      text: "Deine Wühler warten auf Befehle. Klicke auf das Erdreich neben dem Herzkern – oder zieh mit gedrückter linker Maustaste darüber. Markierte Felder graben sie ab.",
      target: digStart,
      done: function (s) { return s.mark.indexOf(1) >= 0 || s._claimed > 25; } },
    { title: "Der Riss",
      text: "Dort pulsiert der Riss – der Pfeil zeigt ihn. Grab einen Gang bis zu ihm. Was die Wühler freilegen, nehmen sie in Besitz, auch den Riss. Durch ihn kommen deine Kreaturen.",
      target: function (s) { return s.rift.idx; },
      done: function (s) { return s.rift.on; } },
    { title: "Schlafhöhle", hl: "lair",
      text: "Kreaturen kommen nur, wenn sie schlafen können. Wähle die Schlafhöhle (Taste <kbd>2</kbd>) und zieh sie über mindestens 4 Felder deines Bodens – ein Feld pro Kreatur.",
      done: function (s) { return rc(s, "lair") >= 4; } },
    { title: "Pilzgarten", hl: "garden",
      text: "Hunger macht Kreaturen wütend, und wütende Kreaturen gehen. Baue einen Pilzgarten (Taste <kbd>3</kbd>) mit mindestens 4 Feldern.",
      done: function (s) { return rc(s, "garden") >= 4; } },
    { title: "Gold", hl: "treasury",
      text: "Gold bezahlt Räume und den Sold deiner Horde. Markiere die glitzernde Goldader (Pfeil) zum Abbau und baue eine Schatzkammer (Taste <kbd>1</kbd>) mit 2 Feldern – dort lagern die Wühler das Gold.",
      target: function (s) { return nearest(s, function (i) { return s.tiles[i] === T.GOLD; }); },
      done: function (s) { return rc(s, "treasury") >= 2 && s.stats.mined > 0; } },
    { title: "Die erste Kreatur",
      text: "Jetzt heißt es kurz warten: Durch den Riss kriecht gleich ein Schrat. Denk daran – jede Kreatur will beim Zahltag ihren Sold.",
      enter: function (s) { s.gateT = Math.min(s.gateT, 4); },
      done: function (s) { return TT.countOwn(s).fighters >= 1; } },
    { title: "Der Griff", hl: "hand",
      text: "Du kannst deine Kreaturen tragen. Wähle den Griff (Taste <kbd>H</kbd>), klicke auf den Schrat und setz ihn mit einem <kbd>Rechtsklick</kbd> irgendwo auf deinem Boden wieder ab.",
      enter: function (s, t) { t.dropped = false; },
      done: function (s, t) { return !!t.dropped; } },
    { title: "Spähtrupp",
      text: "Fackelschein im Schacht! Ein Spähtrupp der Oberwelt steigt herab. Deine Kreaturen verteidigen den Herzkern von selbst – wirf sie mit dem Griff dorthin, wo es brennt.",
      enter: function (s) { s.waveT = 30; },
      done: function (s) { return s.waveN >= 1 && TT.countOwn(s).foes === 0; } },
    { title: "Der Siegelstein",
      text: "Siehst du den goldenen Obelisken (Pfeil)? Ein Siegelstein des Ordens – er hält deinen Bann. Grab einen Gang hin und wirf deine Kämpfer mit dem Griff zur Wache. Fällt sie, nehmen die Wühler den Stein ein.",
      target: function (s) { const q = s.seals.find(function (x) { return !x.taken; }); return q ? q.idx : -1; },
      done: function (s) { return s.seals.length > 0 && s.seals.every(function (q) { return q.taken; }); } },
    { title: "Der Späherführer",
      text: "Der Fels bebt – der Anführer des Spähtrupps steigt herab. Bezwinge ihn, und dein erstes Gebiet ist erobert.",
      target: function (s) { const b = s.bossId && TT.byId(s, s.bossId); return b && !b.dead ? TT.tileOf(s, b) : -1; },
      done: function (s) { return s.won; } },
  ];

  // Einmal pro Anzeige-Takt aufgerufen; liefert den aktuellen Schritt (oder null, wenn alles geschafft ist)
  TT.tutTick = function (s, ui) {
    if (!s || s.levelId !== "tut") return null;
    const t = s.tut || (s.tut = { step: 0, entered: -1, dropped: false });
    const steps = TT.TUT_STEPS;
    for (let guard = 0; guard < steps.length; guard++) {
      const st = steps[t.step];
      if (!st) break;
      if (t.entered !== t.step) { t.entered = t.step; if (st.enter) st.enter(s, t, ui); }
      if (!st.done(s, t, ui)) break;
      t.step++;
      TT.sfx("level");
    }
    const cur = steps[t.step] || null;
    s._tutTarget = cur && cur.target ? cur.target(s) : -1;
    return cur;
  };
})();
