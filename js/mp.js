"use strict";
/* Mehrspieler-Ablauf: Raum eröffnen oder beitreten, Partie starten, Nachrichten verteilen, Herzschlag. */
(function () {
  const PROTO = 1;
  const Net = TT.Net;

  const MP = TT.MP = {
    on: false, role: null, mode: null, code: "", phase: "idle",
    lastRecv: 0, pingT: 0, syncT: 0, statT: 0, hs: null, lostSent: false, dropped: false,
    // Rückmeldungen an die Oberfläche (setzt ui.js)
    cb: { status: function () {}, waiting: function () {}, start: function () {}, deny: function () {}, dropped: function () {} },
  };

  MP.isGuestView = function () { return MP.on && MP.role === "guest" && MP.mode === "versus"; };
  MP.modeName = function (m) { return m === "duel" ? "Duell der Dungeons" : "Gemeinsame Karte"; };

  function reset() {
    MP.on = false; MP.role = null; MP.mode = null; MP.code = ""; MP.phase = "idle";
    MP.hs = null; MP.lostSent = false; MP.dropped = false; MP.syncT = 0; MP.statT = 0; MP.pingT = 0;
  }

  function wireNet() {
    Net.onMsg = receive;
    Net.onError = function (text) {
      if (MP.phase === "play") { lost(); return; }
      MP.phase = "idle"; Net.close(); MP.cb.status(text, true);
    };
    Net.onClose = function () { if (MP.phase === "play") lost(); };
  }

  // Spiel eröffnen
  MP.host = function (mode) {
    if (!Net.available()) { MP.cb.status("Dein Browser unterstützt keine direkten Verbindungen.", true); return; }
    reset(); wireNet();
    MP.role = "host"; MP.mode = mode; MP.phase = "wait";
    MP.cb.status("Raum wird eröffnet …");
    Net.onOpen = function () {
      MP.lastRecv = performance.now();
      Net.send({ t: "hi", v: PROTO, mode: mode });
      const seed = ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9)) >>> 0;
      if (mode === "duel") {
        Net.send({ t: "start", seed: seed });
        begin(TT.newDuel(seed));
      } else {
        const s = TT.newVersus(seed);
        s.view = 0;
        MP.hs = TT.syncHost(s, 1);
        Net.send({ t: "full", s: TT.syncFull(s) });
        begin(s);
      }
    };
    Net.host(function (code) { MP.code = code; MP.cb.waiting(code, mode); });
  };

  // Spiel beitreten
  MP.join = function (code) {
    code = Net.cleanCode(code);
    if (code.length !== 5) { MP.cb.status("Der Code hat fünf Zeichen.", true); return; }
    if (!Net.available()) { MP.cb.status("Dein Browser unterstützt keine direkten Verbindungen.", true); return; }
    reset(); wireNet();
    MP.role = "guest"; MP.code = code; MP.phase = "connecting";
    MP.cb.status("Verbinde mit " + code + " …");
    Net.onOpen = function () { MP.lastRecv = performance.now(); MP.cb.status("Verbunden – die Karte wird übertragen …"); };
    Net.join(code);
  };

  function begin(s) {
    TT.state = s;
    MP.on = true; MP.phase = "play"; MP.lastRecv = performance.now();
    MP.cb.start(MP.mode, MP.role);
  }

  function receive(m) {
    MP.lastRecv = performance.now();
    const s = TT.state;
    switch (m.t) {
      case "hi":
        if (MP.role !== "guest") return;
        if (m.v !== PROTO) { MP.cb.status("Dein Mitspieler hat eine andere Spielversion. Ladet beide die Seite neu.", true); MP.leave(true); return; }
        if (m.mode !== "duel" && m.mode !== "versus") return;
        MP.mode = m.mode;
        return;
      case "start":
        if (MP.role === "guest" && MP.mode === "duel" && MP.phase !== "play") begin(TT.newDuel(Number(m.seed) >>> 0));
        return;
      case "full":
        if (MP.role === "guest" && MP.mode === "versus" && MP.phase !== "play") {
          try { begin(TT.guestState(m.s, 1)); } catch (err) { MP.cb.status("Die Karte kam beschädigt an. Versucht es noch einmal.", true); MP.leave(true); }
        }
        return;
      case "d":
        if (MP.isGuestView() && MP.phase === "play") TT.guestApply(s, m);
        return;
      case "act":
        if (MP.role === "host" && MP.mode === "versus" && MP.phase === "play" && typeof m.n === "string") hostAct(s, m);
        return;
      case "deny":
        if (MP.isGuestView()) MP.cb.deny(typeof m.why === "string" ? m.why.slice(0, 200) : "");
        return;
      case "attack":
        if (MP.mode === "duel" && MP.phase === "play") TT.duelIncoming(s, m);
        return;
      case "stat":
        if (MP.mode === "duel") TT.duelOpp(s, m);
        return;
      case "lost":
        if (MP.mode === "duel" && s.duel && !s.over) { s.duel.won = true; TT.msg(s, "Der Herzkern deines Rivalen ist zerbrochen!", "good"); }
        return;
      case "bye":
        if (MP.phase === "play") lost();
        return;
    }
  }

  // Befehl des Gastes auf der gemeinsamen Karte ausführen und bei Bedarf zurückmelden, warum es nicht ging
  function hostAct(s, m) {
    const r = TT.versusAct(s, 1, m.n, m.a);
    if (r === null || r === undefined) return;
    let why = null;
    if (m.n === "actBuild" && !r.built) why = r.why;
    else if ((m.n === "actTrap" || m.n === "actSpell" || m.n === "actDrop") && !r.ok) why = r.why || "";
    else if (m.n === "actGrab" && !r) why = "Mehr passt nicht in deinen Griff.";
    else if (m.n === "actSell" && r.gold) TT.inCtx(s, 1, function () { TT.msg(s, "Abgerissen: " + r.gold + " Gold zurück.", "info"); });
    if (why !== null) Net.send({ t: "deny", why: why });
  }

  // Gast: Befehl an den Gastgeber schicken
  MP.act = function (name, args) { Net.send({ t: "act", n: name, a: args }); };

  // Duell: eigenen Angriff losschicken
  MP.attack = function (key) {
    const r = TT.duelAttack(TT.state, key);
    if (r.ok) Net.send(r.msg);
    return r;
  };

  function lost() {
    if (MP.dropped) return;
    MP.dropped = true; MP.phase = "dropped";
    Net.close();
    MP.cb.dropped();
  }

  // Partie verlassen (quiet: ohne Rückmeldung an die Oberfläche)
  MP.leave = function (quiet) {
    if (Net.open) Net.send({ t: "bye" });
    Net.close();
    const keep = quiet ? null : MP.phase;
    reset();
    void keep;
  };

  // Spieler spielt nach Verbindungsabbruch allein weiter (nur Duell)
  MP.solo = function () { reset(); };

  // einmal pro Bild
  MP.tick = function (dt) {
    if (!MP.on || MP.phase !== "play") return;
    const s = TT.state;
    MP.pingT -= dt;
    if (MP.pingT <= 0) { MP.pingT = 2; Net.send({ t: "ping" }); }
    if (performance.now() - MP.lastRecv > 15000) { lost(); return; }
    if (MP.role === "host" && MP.mode === "versus") {
      MP.syncT += dt;
      if (MP.syncT >= 0.1) { MP.syncT = 0; Net.send(TT.syncDelta(s, MP.hs)); }
    }
    if (MP.mode === "duel") {
      MP.statT -= dt;
      if (MP.statT <= 0) { MP.statT = 1.5; Net.send(TT.duelStatus(s)); }
      if (s.over && !MP.lostSent) { MP.lostSent = true; Net.send({ t: "lost" }); }
    }
  };
})();
