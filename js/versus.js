"use strict";
/* Mehrspieler „Gemeinsame Karte“: zwei Herzkerne auf einer Karte.
   Der Rechner des Gastgebers rechnet das ganze Spiel. Der Gast bekommt laufend nur die Änderungen geschickt
   (Felder, Kreaturen, Werte) und schickt seine Befehle (graben, bauen, greifen …) zum Gastgeber. */
(function () {
  const T = TT.T, B = TT.BAL;

  /* ============================================================
     Karte: punktsymmetrisch, damit beide Seiten gleich gute Startbedingungen haben
     ============================================================ */
  TT.VERSUS_W = 72; TT.VERSUS_H = 44;

  TT.newVersus = function (seed) {
    const W = TT.VERSUS_W, H = TT.VERSUS_H, n = W * H, HW = W / 2;
    const rnd = TT.rng(seed);
    const ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
    const fill = function (v) { return new Array(n).fill(v); };
    const s = {
      v: 1, mode: "versus", seed: seed, W: W, H: H,
      tiles: fill(T.EARTH), room: fill(0), dig: fill(0), ore: fill(0), food: fill(0), obj: fill(0), own: fill(0),
      traps: [], ents: [], nextId: 1, prisoners: [], pickups: [], shafts: [], fx: [], msgN: 0,
      time: 0, growT: 0, waveN: 0, waveT: 1e12, warned: false, shaftPick: 0,
      levelId: null, seals: [], bossPhase: 0, bossT: 0,
      over: false, won: false, wonShown: false, winner: -1,
      pl: [], me: 0, view: 0,
    };
    for (let k = 0; k < 2; k++) {
      s.pl.push({
        gold: B.startGold, ess: 120, parts: 0, research: { done: {}, cur: null, pts: 0 },
        coreIdx: 0, coreHp: B.coreHp, coreHitT: -99, coreMsgT: -99, coreLow: B.coreHp,
        rift: { idx: 0, on: false }, rally: null, rallyN: 0, payT: B.payEvery, gateT: 10,
        stats: { kills: 0, lost: 0, mined: 0 }, seen: fill(0), mark: fill(0), msgs: [],
        _rc: null, _claimed: 0, _foes: 0, _alarm: false,
      });
    }
    TT.PF.forEach(function (f) { s[f] = s.pl[0][f]; });

    const cy = H >> 1, c0 = [11, cy];
    const inner = function (x, y) { return x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2; };
    const left = function (x, y) { return inner(x, y) && x < HW; };
    const dc = function (x, y) { return Math.hypot(x - c0[0], y - c0[1]); };
    function walk(x, y, len, fn) {
      for (let j = 0; j < len; j++) {
        if (left(x, y)) fn(x, y, y * W + x);
        const d = ri(0, 3);
        x += d === 0 ? 1 : d === 1 ? -1 : 0;
        y += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
    const gold = function (x, y, i) { if (dc(x, y) > 3.6) { s.tiles[i] = T.GOLD; s.ore[i] = B.oreGold; } };

    // Rand
    for (let x = 0; x < W; x++) { s.tiles[x] = T.ROCK; s.tiles[(H - 1) * W + x] = T.ROCK; }
    for (let y = 0; y < H; y++) { s.tiles[y * W] = T.ROCK; s.tiles[y * W + W - 1] = T.ROCK; }
    // Felsbrocken, Goldadern, eine umkämpfte Kristallader nahe der Mitte
    for (let k = 0; k < 22; k++) walk(ri(2, HW - 1), ri(2, H - 3), ri(3, 12), function (x, y, i) { if (dc(x, y) > 6) s.tiles[i] = T.ROCK; });
    const a0 = (rnd() - 0.5) * 2.2;
    walk(Math.round(c0[0] + Math.cos(a0) * 7), Math.round(cy + Math.sin(a0) * 6), 9, gold);
    for (let k = 0; k < 6; k++) {
      let x, y, g = 0;
      do { x = ri(3, HW - 2); y = ri(3, H - 4); } while (dc(x, y) < 9 && g++ < 50);
      walk(x, y, ri(4, 9), gold);
    }
    const gx = HW - ri(4, 7), gy = ri(6, H - 7);
    s.tiles[gy * W + gx] = T.GEM; gold(gx + 1, gy, gy * W + gx + 1); gold(gx, gy + 1, (gy + 1) * W + gx);

    // Riss und versteckte Truhen
    const rx = TT.clamp(c0[0] + ri(5, 8), 4, HW - 4), ry = TT.clamp(cy + (rnd() < 0.5 ? -1 : 1) * ri(6, 9), 4, H - 5);
    const chests = [];
    for (let k = 0; k < 2; k++) {
      let x, y, g = 0, ok = false;
      do {
        x = ri(5, HW - 4); y = ri(4, H - 5);
        ok = dc(x, y) >= 11 && Math.hypot(x - rx, y - ry) >= 7 && chests.every(function (p) { return Math.hypot(p[0] - x, p[1] - y) >= 7; });
      } while (!ok && g++ < 120);
      if (!ok) continue;
      chests.push([x, y]);
      walk(x, y, ri(7, 11), function (px, py, i) { s.tiles[i] = T.FLOOR; s.ore[i] = 0; });
    }
    // Gänge freihalten: vom Kern zum Riss und zur Kartenmitte gibt es keinen Urfels
    function corridor(x, y, tx, ty) {
      while (x !== tx || y !== ty) {
        if (x !== tx) x += x < tx ? 1 : -1; else y += y < ty ? 1 : -1;
        const i = y * W + x;
        if (s.tiles[i] === T.ROCK || s.tiles[i] === T.GEM) s.tiles[i] = T.EARTH;
      }
    }
    corridor(rx, ry, c0[0], cy);
    corridor(HW - 1, cy, c0[0], cy);
    corridor(HW - 1, cy - 1, c0[0], cy - 1);

    // Linke Hälfte gespiegelt auf die rechte übertragen
    const mir = function (i) { return n - 1 - i; };
    for (let y = 0; y < H; y++) for (let x = 0; x < HW; x++) {
      const i = y * W + x, j = mir(i);
      s.tiles[j] = s.tiles[i]; s.ore[j] = s.ore[i];
    }
    chests.forEach(function (p) {
      const i = p[1] * W + p[0], g = ri(10, 16) * 25;
      s.pickups.push({ idx: i, gold: g }, { idx: mir(i), gold: g });
    });

    // Herzkerne, Risse, Startboden, Wühler
    for (let k = 0; k < 2; k++) {
      TT.bind(s, k);
      const core = k === 0 ? cy * W + c0[0] : mir(cy * W + c0[0]), rift = k === 0 ? ry * W + rx : mir(ry * W + rx);
      const cxk = core % W, cyk = (core / W) | 0, rxk = rift % W, ryk = (rift / W) | 0;
      for (let y = cyk - 2; y <= cyk + 2; y++) for (let x = cxk - 2; x <= cxk + 2; x++) {
        const i = y * W + x; s.tiles[i] = T.CLAIMED; s.ore[i] = 0; s.own[i] = k + 1;
      }
      for (let y = ryk - 1; y <= ryk + 1; y++) for (let x = rxk - 1; x <= rxk + 1; x++) { const i = y * W + x; s.tiles[i] = T.FLOOR; s.ore[i] = 0; }
      s.coreIdx = core; s.rift.idx = rift;
      TT.reveal(s, core, 7);
      [1, -1, W, -W].forEach(function (d) { TT.spawn(s, "digger", core + d, false); });
      TT.msg(s, "Der Herzkern erwacht. Irgendwo jenseits des Gesteins erwacht ein zweiter – zerbrich ihn, bevor er dich zerbricht.", "good");
    }
    TT.bind(s, 0);
    TT.syncPl(s);
    return s;
  };

  /* ============================================================
     Spielablauf: jeder Abschnitt läuft einmal für jeden Spieler in dessen Kontext
     ============================================================ */
  TT.updateVersus = function (s, dt) {
    if (s.over) return;
    const view = s.me, X = TT.ticks;
    s.time += dt;
    X.grow(s, dt);
    for (let k = 0; k < 2; k++) {
      TT.bind(s, k);
      const rc = TT.countRooms(s);
      X.ess(s, dt);
      X.econ(s, dt, rc);
      if (s.rally) { s.rally.t -= dt; if (s.rally.t <= 0) s.rally = null; }
      X.alarm(s);
    }
    for (let k = 0; k < 2; k++) {
      TT.bind(s, k);
      for (let j = 0; j < s.ents.length; j++) { const e = s.ents[j]; if (!e.foe && e.pl === k) TT.updateEnt(s, e, dt); }
    }
    for (let k = 0; k < 2; k++) {
      TT.bind(s, k);
      X.traps(s, dt);
      X.pickups(s);
      X.coreHeal(s, dt);
    }
    X.cleanup(s, dt);
    TT.bind(s, view);
  };

  // Klänge aus dem Kontext des anderen Spielers gehören auf dessen Rechner
  const rawSfx = TT.sfx;
  TT.sfx = function (name) {
    const s = TT.state;
    if (s && s.pl && s.me !== s.view) {
      if (s._sfxOut && s._sfxOut.length < 40) s._sfxOut.push(name);
      return;
    }
    rawSfx(name);
  };

  /* ============================================================
     Befehle des Gastes (nur diese sind erlaubt)
     ============================================================ */
  const ACTS = { actMark: 6, actBuild: 6, actSell: 5, actTrap: 3, actSpell: 3, actGrab: 2, actDrop: 2 };
  TT.versusAct = function (s, k, name, args) {
    if (!Object.prototype.hasOwnProperty.call(ACTS, name) || !Array.isArray(args) || args.length !== ACTS[name] - 1) return null;
    for (const a of args) if (typeof a !== "number" && typeof a !== "string" && typeof a !== "boolean") return null;
    for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) return null;
    return TT.inCtx(s, k, function () { return TT[name].apply(null, [s].concat(args)); });
  };

  /* ============================================================
     Abgleich Gastgeber -> Gast
     ============================================================ */
  const ARR = ["tiles", "room", "ore", "food", "obj", "own"];
  const EK = ["type", "pl", "foe", "worker", "x", "y", "hp", "lvl", "hpx", "xp", "st", "act", "dir", "held", "hurt", "carry",
    "haste", "mood", "hunger", "home", "conv", "target", "cd", "nx", "stun", "ph", "job"];
  const PS = ["gold", "ess", "parts", "coreHp", "coreHitT", "coreLow", "payT", "gateT", "rallyN", "_claimed", "_foes", "_alarm"];
  const PO = ["research", "rift", "rally", "stats", "_rc"];
  const r2 = function (v) { return Math.round(v * 100) / 100; };
  const r1 = function (v) { return Math.round(v * 10) / 10; };

  function entVals(e) {
    const out = new Array(EK.length);
    for (let j = 0; j < EK.length; j++) {
      const k = EK[j];
      let v = e[k];
      if (k === "job") v = e.job ? e.job.kind + ":" + e.job.idx : "";
      else if (k === "x" || k === "y") v = r2(v);
      else if (k === "hp" || k === "cd" || k === "hurt" || k === "stun" || k === "xp") v = r1(v);
      else if (k === "mood" || k === "hunger" || k === "haste") v = Math.round(v);
      else if (v === undefined) v = null;
      out[j] = v;
    }
    return out;
  }

  function pget(s, k, f) { return k === s.me ? s[f] : s.pl[k][f]; }

  // Gastgeber: Merkzettel, was der Gast schon kennt
  TT.syncHost = function (s, guest) {
    const hs = { g: guest, last: {}, ents: new Map(), msgId: 0, fx: new WeakSet(), lists: {}, po: {} };
    ARR.forEach(function (a) { hs.last[a] = s[a].slice(); });
    hs.last.dig = s.dig.map(r1);
    hs.last.seen = pget(s, guest, "seen").slice();
    hs.last.mark = pget(s, guest, "mark").slice();
    for (const e of s.ents) hs.ents.set(e.id, entVals(e));
    for (const m of pget(s, guest, "msgs")) hs.msgId = Math.max(hs.msgId, m.id);
    for (const f of s.fx) hs.fx.add(f);
    s._sfxOut = [];
    return hs;
  };

  // Vollständiger Spielstand für den Start
  TT.syncFull = function (s) {
    TT.syncPl(s);
    return TT.serialize(s);
  };

  function diff(prev, cur, map) {
    const out = [];
    for (let i = 0; i < cur.length; i++) {
      const v = map ? map(cur[i]) : cur[i];
      if (prev[i] !== v) { prev[i] = v; out.push(i, v); }
    }
    return out;
  }

  TT.syncDelta = function (s, hs) {
    const g = hs.g, d = { t: "d", time: r2(s.time), over: s.over, winner: s.winner, a: {}, p: [] };
    ARR.forEach(function (a) { const x = diff(hs.last[a], s[a]); if (x.length) d.a[a] = x; });
    const dg = diff(hs.last.dig, s.dig, r1); if (dg.length) d.a.dig = dg;
    const se = diff(hs.last.seen, pget(s, g, "seen")); if (se.length) d.a.seen = se;
    const mk = diff(hs.last.mark, pget(s, g, "mark")); if (mk.length) d.a.mark = mk;

    // Kreaturen: neue ganz, bekannte nur mit geänderten Werten, verschwundene als Nummer
    const add = [], chg = [], seenIds = new Set();
    for (const e of s.ents) {
      seenIds.add(e.id);
      const v = entVals(e), old = hs.ents.get(e.id);
      if (!old) { add.push([e.id].concat(v)); hs.ents.set(e.id, v); continue; }
      let c = null;
      for (let j = 0; j < v.length; j++) if (old[j] !== v[j]) { (c = c || [e.id]).push(j, v[j]); old[j] = v[j]; }
      if (c) chg.push(c);
    }
    const rem = [];
    hs.ents.forEach(function (v, id) { if (!seenIds.has(id)) rem.push(id); });
    rem.forEach(function (id) { hs.ents.delete(id); });
    if (add.length || chg.length || rem.length) d.e = { a: add, c: chg, r: rem };

    // Werte beider Spieler (klein, daher immer)
    for (let k = 0; k < 2; k++) {
      const p = {};
      PS.forEach(function (f) { const v = pget(s, k, f); p[f] = typeof v === "number" ? r2(v) : v; });
      PO.forEach(function (f) {
        const j = JSON.stringify(pget(s, k, f) === undefined ? null : pget(s, k, f));
        if (hs.po[k + f] !== j) { hs.po[k + f] = j; p[f] = JSON.parse(j); }
      });
      d.p.push(p);
    }
    // Listen, die sich selten ändern
    ["traps", "pickups"].forEach(function (f) {
      const j = JSON.stringify(s[f]);
      if (hs.lists[f] !== j) { hs.lists[f] = j; d[f] = s[f]; }
    });
    // neue Meldungen für den Gast
    const msgs = pget(s, g, "msgs").filter(function (m) { return m.id > hs.msgId; });
    if (msgs.length) { d.m = msgs; hs.msgId = msgs[msgs.length - 1].id; }
    // neue Effekte und Klänge
    const fx = [];
    for (const f of s.fx) if (!hs.fx.has(f)) { hs.fx.add(f); fx.push(f); }
    if (fx.length) d.fx = fx;
    if (s._sfxOut && s._sfxOut.length) { d.sfx = s._sfxOut; s._sfxOut = []; }
    return d;
  };

  /* ============================================================
     Gast: Spielstand übernehmen und Änderungen einspielen
     ============================================================ */
  TT.guestState = function (text, me) {
    const s = TT.deserialize(text);
    s.view = me;
    TT.bind(s, me);
    s._sfxOut = null;
    for (const e of s.ents) { e._tx = e.x; e._ty = e.y; }
    return s;
  };

  TT.guestApply = function (s, d) {
    const me = s.me;
    s._time = d.time; s.over = d.over; s.winner = d.winner;
    for (const a in d.a) {
      const tgt = s[a], x = d.a[a];
      if (!tgt) continue;
      for (let j = 0; j < x.length; j += 2) tgt[x[j]] = x[j + 1];
    }
    if (d.e) {
      const byId = new Map();
      for (const e of s.ents) byId.set(e.id, e);
      for (const row of d.e.a) {
        const e = { id: row[0], path: [], dead: false };
        for (let j = 0; j < EK.length; j++) setKey(e, EK[j], row[j + 1], true);
        if (!byId.has(e.id)) { s.ents.push(e); byId.set(e.id, e); }
      }
      for (const row of d.e.c) {
        const e = byId.get(row[0]);
        if (!e) continue;
        for (let j = 1; j < row.length; j += 2) setKey(e, EK[row[j]], row[j + 1], false);
      }
      if (d.e.r.length) {
        const gone = new Set(d.e.r);
        s.ents = s.ents.filter(function (e) { return !gone.has(e.id); });
      }
    }
    for (let k = 0; k < 2; k++) {
      const p = d.p[k];
      if (!p) continue;
      for (const f in p) { if (k === me) s[f] = p[f]; else s.pl[k][f] = p[f]; }
    }
    if (d.traps) s.traps = d.traps;
    if (d.pickups) s.pickups = d.pickups;
    if (d.m) { for (const m of d.m) s.msgs.push(m); while (s.msgs.length > 40) s.msgs.shift(); s.msgN = Math.max(s.msgN, d.m[d.m.length - 1].id); }
    if (d.fx) for (const f of d.fx) s.fx.push(f);
    if (d.sfx) for (const n of d.sfx) TT.sfx(n);
  };

  function setKey(e, k, v, fresh) {
    if (k === "job") {
      if (!v) e.job = null;
      else { const p = String(v).split(":"); e.job = { kind: p[0], idx: Number(p[1]) }; }
      return;
    }
    if (k === "x" || k === "y") {
      const tk = k === "x" ? "_tx" : "_ty";
      e[tk] = v;
      if (fresh || Math.abs(e[k] - v) > 1.5) e[k] = v;   // neu oder abgesetzt: sofort dort
      return;
    }
    e[k] = v;
  }

  // Gast: zwischen zwei Lieferungen weich weiterbewegen und Effekte auslaufen lassen
  TT.guestTick = function (s, dt) {
    if (s._time !== undefined) {
      // eigene Uhr läuft weiter, wird aber sanft an die des Gastgebers gezogen
      s.time += dt;
      s.time += (s._time - s.time) * Math.min(1, dt * 2);
    }
    const f = Math.min(1, dt * 10);
    for (const e of s.ents) {
      if (e._tx === undefined) continue;
      e.mv = Math.abs(e._tx - e.x) + Math.abs(e._ty - e.y) > 0.01;
      e.x += (e._tx - e.x) * f; e.y += (e._ty - e.y) * f;
    }
    for (let k = s.fx.length - 1; k >= 0; k--) { s.fx[k].t -= dt; if (s.fx[k].t <= 0) s.fx.splice(k, 1); }
  };
})();
