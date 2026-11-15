"use strict";
/* Mehrspieler „Duell der Dungeons“: Jeder baut auf derselben Startkarte seinen eigenen Dungeon.
   Mit Gold schickt man dem Rivalen Angriffstrupps, die bei ihm durch einen Schacht herabsteigen.
   Wessen Herzkern zuerst zerbricht, verliert. Jeder Rechner rechnet nur sein eigenes Spiel;
   übers Netz gehen nur Angriffe, ein kurzer Lagebericht und das Ende. */
(function () {
  const C = TT.CREATURES;

  TT.DUEL_ATTACKS = [
    { key: "spaeher", name: "Spähtrupp", cost: 200, budget: 5, icon: "spark",
      desc: "Eine Handvoll leichter Eindringlinge. Billig – gut, um den Rivalen beim Aufbau zu stören." },
    { key: "trupp", name: "Kriegstrupp", cost: 550, budget: 14, icon: "drum",
      desc: "Ein ordentlicher Haufen Krieger, Schützen und Priester." },
    { key: "heer", name: "Heerzug", cost: 1200, budget: 32, icon: "training",
      desc: "Ein ganzes Heer der Oberwelt. Teuer, aber es kann einen Dungeon brechen." },
  ];
  TT.DUEL_COOLDOWN = 25;        // Sekunden zwischen zwei eigenen Angriffen
  TT.DUEL_WARN = 10;            // so lange sieht der Rivale den Fackelschein, bevor der Trupp herabsteigt

  TT.newDuel = function (seed) {
    const s = TT.newGame(seed, { firstWave: 360 });
    s.mode = "duel";
    s.duel = { cd: 0, incoming: [], opp: null, sent: 0, got: 0, won: false };
    return s;
  };

  // Stärke eines geschickten Angriffs: wächst mit der Spielzeit
  function tierOf(s) { return 1 + Math.floor(s.time / 150); }

  // Eigener Angriff: gibt die Nachricht für den Rivalen zurück
  TT.duelAttack = function (s, key) {
    const A = TT.DUEL_ATTACKS.find(function (a) { return a.key === key; });
    if (!A || !s.duel || s.over) return { ok: false, why: "" };
    if (s.duel.cd > 0) return { ok: false, why: "Deine Boten sind noch unterwegs – nächster Angriff in " + Math.ceil(s.duel.cd) + " s." };
    if (s.gold < A.cost) return { ok: false, why: "Nicht genug Gold für einen " + A.name + "." };
    const tier = tierOf(s);
    let budget = A.budget * (1 + s.time / 1500);
    const pool = Object.keys(C).filter(function (k) { return C[k].foe && !C[k].boss && (C[k].from || 1) <= tier; });
    const list = [];
    for (let g = 0; budget >= 1 && g < 120 && list.length < 40; g++) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      if (C[k].cost <= budget) { list.push(k); budget -= C[k].cost; }
    }
    if (!list.length) list.push(pool[0]);
    s.gold -= A.cost;
    s.duel.cd = TT.DUEL_COOLDOWN; s.duel.sent++;
    TT.msg(s, "Dein " + A.name + " bricht auf: " + list.length + " Söldner der Oberwelt ziehen zu deinem Rivalen.", "good");
    TT.sfx("spell");
    return { ok: true, msg: { t: "attack", key: key, list: list, lvl: Math.min(12, 1 + Math.floor(s.time / 300)) } };
  };

  // Angriff des Rivalen kommt an (Nachricht prüfen – sie kommt von außen)
  TT.duelIncoming = function (s, m) {
    if (!s.duel || s.over || !m || !Array.isArray(m.list) || m.list.length > 40) return;
    const list = m.list.filter(function (k) { return typeof k === "string" && C[k] && C[k].foe && !C[k].boss; });
    if (!list.length) return;
    const A = TT.DUEL_ATTACKS.find(function (a) { return a.key === m.key; }) || TT.DUEL_ATTACKS[0];
    const lvl = TT.clamp(Math.floor(Number(m.lvl) || 1), 1, 12);
    const shaft = s.shafts[Math.floor(Math.random() * s.shafts.length)];
    s.duel.incoming.push({ t: TT.DUEL_WARN, list: list, lvl: lvl, shaft: shaft, name: A.name });
    s.duel.got++;
    TT.msg(s, "Fackelschein im " + TT.compass(s, shaft) + " – dein Rivale schickt einen " + A.name + " (" + list.length + " Eindringlinge)!", "warn");
    TT.sfx("warn");
  };

  // läuft in TT.update mit
  TT.duelTick = function (s, dt) {
    const D = s.duel;
    if (D.cd > 0) D.cd = Math.max(0, D.cd - dt);
    for (let k = D.incoming.length - 1; k >= 0; k--) {
      const q = D.incoming[k];
      q.t -= dt;
      if (q.t > 0) continue;
      D.incoming.splice(k, 1);
      TT.dropFoes(s, q.shaft, q.list, q.lvl, 1);
      TT.msg(s, "Der " + q.name + " deines Rivalen steigt im " + TT.compass(s, q.shaft) + " herab!", "bad");
      TT.sfx("alarm");
    }
  };

  // Lagebericht für den Rivalen
  TT.duelStatus = function (s) {
    const c = TT.countOwn(s);
    return { t: "stat", hp: Math.round(s.coreHp), gold: Math.floor(s.gold), horde: c.fighters, workers: c.workers,
      claimed: s._claimed || 0, kills: s.stats.kills, wave: s.waveN, time: Math.round(s.time) };
  };
  TT.duelOpp = function (s, m) {
    if (!s.duel || !m) return;
    const num = function (v) { v = Number(v); return Number.isFinite(v) ? v : 0; };
    s.duel.opp = { hp: num(m.hp), gold: num(m.gold), horde: num(m.horde), workers: num(m.workers), claimed: num(m.claimed),
      kills: num(m.kills), wave: num(m.wave), time: num(m.time) };
  };
})();
