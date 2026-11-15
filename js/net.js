"use strict";
/* Verbindung zwischen zwei Browsern über einen Raumcode.
   Normalfall: PeerJS (vendor/peerjs.min.js). Der kostenlose PeerJS-Vermittlungsdienst stellt nur den Kontakt her,
   danach laufen die Daten direkt von Browser zu Browser (WebRTC). Es gibt keinen eigenen Server.
   Zum Testen auf einem Rechner: index.html?net=lokal verbindet zwei Tabs desselben Browsers ohne Internet. */
(function () {
  const PREFIX = "tiefenthron-v1-";
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // ohne 0/O und 1/I, die man leicht verwechselt

  const Net = TT.Net = {
    peer: null, conn: null, chan: null, local: /[?&]net=lokal/.test(location.search),
    onMsg: null, onOpen: null, onClose: null, onError: null, open: false, id: Math.random().toString(36).slice(2),
  };

  Net.makeCode = function () {
    let c = "";
    for (let k = 0; k < 5; k++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return c;
  };
  Net.cleanCode = function (c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); };
  Net.available = function () { return Net.local ? typeof BroadcastChannel === "function" : typeof window.Peer === "function"; };

  function fail(text) { if (Net.onError) Net.onError(text); }
  function opened() { Net.open = true; if (Net.onOpen) Net.onOpen(); }
  function closed() { if (!Net.open && !Net.conn && !Net.chan) return; const was = Net.open; Net.open = false; if (was && Net.onClose) Net.onClose(); }
  // Große Nachrichten (die Startkarte) passen nicht in ein einzelnes Paket der Direktverbindung:
  // sie werden in Stücke zerlegt und beim Empfänger wieder zusammengesetzt
  const PART = 12000, parts = {};
  let partId = 0;
  function received(m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "_part") {
      if (!(m.n > 0 && m.n <= 300 && m.i >= 0 && m.i < m.n && typeof m.d === "string")) return;
      const b = parts[m.id] || (parts[m.id] = { n: m.n, got: 0, d: [] });
      if (b.d[m.i] === undefined) { b.d[m.i] = m.d; b.got++; }
      if (b.got < b.n) return;
      delete parts[m.id];
      try { m = JSON.parse(b.d.join("")); } catch (err) { return; }
    }
    if (Net.onMsg) Net.onMsg(m);
  }

  function wire(c) {
    Net.conn = c;
    c.on("open", opened);
    c.on("data", received);
    c.on("close", closed);
    c.on("error", function () { closed(); });
  }

  const ERR = {
    "browser-incompatible": "Dein Browser unterstützt keine direkten Verbindungen (WebRTC).",
    "network": "Der Vermittlungsdienst ist nicht erreichbar. Bist du online?",
    "server-error": "Der Vermittlungsdienst ist gerade gestört. Versuch es gleich noch einmal.",
    "socket-error": "Der Vermittlungsdienst ist nicht erreichbar. Bist du online?",
    "peer-unavailable": "Unter diesem Code wartet gerade niemand. Stimmt der Code?",
    "ssl-unavailable": "Der Vermittlungsdienst ist nicht erreichbar.",
  };

  // Spiel eröffnen: cb(code) sobald der Raum bereitsteht
  Net.host = function (cb, tries) {
    Net.close();
    const code = Net.makeCode();
    if (Net.local) {
      const ch = Net.chan = new BroadcastChannel(PREFIX + code);
      ch.onmessage = function (ev) {
        const d = ev.data;
        if (!d || d.from === Net.id) return;
        if (d.hello && !Net.open) { ch.postMessage({ from: Net.id, welcome: true }); opened(); return; }
        if (d.bye) { closed(); return; }
        if (d.m) received(d.m);
      };
      cb(code);
      return;
    }
    const p = Net.peer = new window.Peer(PREFIX + code, { debug: 0 });
    p.on("open", function () { cb(code); });
    p.on("connection", function (c) {
      if (Net.conn) { c.on("open", function () { c.close(); }); return; }      // nur ein Mitspieler
      wire(c);
    });
    p.on("error", function (err) {
      if (err && err.type === "unavailable-id" && (tries || 0) < 4) { Net.host(cb, (tries || 0) + 1); return; }
      fail(ERR[err && err.type] || "Verbindungsfehler: " + (err && err.type || err));
    });
    // Draht zum Vermittlungsdienst gerissen (z. B. Tab lange im Hintergrund): neu verbinden, der Raumcode bleibt gültig
    p.on("disconnected", function () { if (Net.peer === p && !p.destroyed) { try { p.reconnect(); } catch (err) { /* nächster Versuch beim nächsten Abriss */ } } });
  };

  // Spiel beitreten
  Net.join = function (code) {
    Net.close();
    code = Net.cleanCode(code);
    if (Net.local) {
      const ch = Net.chan = new BroadcastChannel(PREFIX + code);
      ch.onmessage = function (ev) {
        const d = ev.data;
        if (!d || d.from === Net.id) return;
        if (d.welcome && !Net.open) { opened(); return; }
        if (d.bye) { closed(); return; }
        if (d.m) received(d.m);
      };
      ch.postMessage({ from: Net.id, hello: true });
      setTimeout(function () { if (!Net.open && Net.chan === ch) fail(ERR["peer-unavailable"]); }, 2500);
      return;
    }
    const p = Net.peer = new window.Peer({ debug: 0 });
    p.on("open", function () { wire(p.connect(PREFIX + code, { reliable: true, serialization: "json" })); });
    p.on("error", function (err) { fail(ERR[err && err.type] || "Verbindungsfehler: " + (err && err.type || err)); });
    setTimeout(function () { if (!Net.open && Net.peer === p) fail("Keine Verbindung zustande gekommen. Stimmt der Code, und ist dein Mitspieler noch im Wartebildschirm?"); }, 20000);
  };

  Net.send = function (m) {
    if (!Net.open) return;
    try {
      if (Net.chan) { Net.chan.postMessage({ from: Net.id, m: m }); return; }
      if (!Net.conn) return;
      const txt = JSON.stringify(m);
      if (txt.length <= PART) { Net.conn.send(m); return; }
      const id = ++partId, n = Math.ceil(txt.length / PART);
      for (let i = 0; i < n; i++) Net.conn.send({ t: "_part", id: id, i: i, n: n, d: txt.slice(i * PART, (i + 1) * PART) });
    } catch (err) { /* Verbindung bricht gerade ab – das merkt der Herzschlag */ }
  };

  Net.close = function () {
    const was = Net.open;
    Net.open = false;
    try { if (Net.chan) { if (was) Net.chan.postMessage({ from: Net.id, bye: true }); Net.chan.close(); } } catch (err) { /* egal */ }
    try { if (Net.conn) Net.conn.close(); } catch (err) { /* egal */ }
    try { if (Net.peer) Net.peer.destroy(); } catch (err) { /* egal */ }
    Net.chan = null; Net.conn = null; Net.peer = null;
  };
  window.addEventListener("beforeunload", function () { if (Net.open) { Net.send({ t: "bye" }); Net.close(); } });
})();
