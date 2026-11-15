"use strict";
/* Karte: Erzeugung, Sichtbarkeit und Wegfindung. */
(function () {
  const T = TT.T;

  /* ---------- Mehrspieler: Spielerkontext, Besitz und Feindschaft ----------
     Auf der gemeinsamen Karte hat jeder Spieler eigenes Gold, eigene Forschung, eigenen Herzkern,
     eigenes Sichtfeld und eigene Grabmarkierungen. Sie liegen in s.pl[0] und s.pl[1].
     Der Spieler, für den gerade gerechnet wird (s.me), steht zusätzlich oben in s – so bleibt
     der übrige Code unverändert: s.gold ist immer das Gold des Spielers, der gerade dran ist.
     Im Einzelspiel gibt es s.pl nicht; dann ändert sich nichts. */
  TT.PF = ["gold", "ess", "parts", "research", "coreIdx", "coreHp", "coreHitT", "coreMsgT", "coreLow", "rift", "rally", "rallyN",
    "payT", "gateT", "stats", "seen", "mark", "msgs", "_rc", "_claimed", "_foes", "_alarm"];
  TT.bind = function (s, k) {
    const prev = s.me;
    if (!s.pl || prev === k) return prev;
    const P = s.pl[prev], Q = s.pl[k], F = TT.PF;
    for (let j = 0; j < F.length; j++) P[F[j]] = s[F[j]];
    for (let j = 0; j < F.length; j++) s[F[j]] = Q[F[j]];
    s.me = k;
    return prev;
  };
  // Den gerade aktiven Spieler nach s.pl zurückschreiben (vor dem Speichern oder Senden)
  TT.syncPl = function (s) {
    if (!s.pl) return;
    const P = s.pl[s.me], F = TT.PF;
    for (let j = 0; j < F.length; j++) P[F[j]] = s[F[j]];
  };
  // fn im Kontext von Spieler k ausführen
  TT.inCtx = function (s, k, fn) {
    if (!s.pl || k === s.me) return fn();
    const prev = TT.bind(s, k);
    try { return fn(); } finally { TT.bind(s, prev); }
  };
  // Gehört das Feld dem Spieler, der gerade dran ist?
  TT.mine = function (s, i) { return s.tiles[i] === T.CLAIMED && (!s.own || s.own[i] === s.me + 1); };
  // Gehört das Feld dem Gegenspieler?
  TT.theirs = function (s, i) { return !!s.own && s.tiles[i] === T.CLAIMED && s.own[i] !== 0 && s.own[i] !== s.me + 1; };
  TT.isCore = function (s, i) {
    if (i === s.coreIdx) return true;
    if (s.pl) for (let k = 0; k < s.pl.length; k++) if (s.pl[k].coreIdx === i) return true;
    return false;
  };
  // Stehen a und b auf verschiedenen Seiten?
  TT.enemies = function (a, b) { return a.foe !== b.foe || (!a.foe && a.pl !== b.pl); };
  // Ist e ein Feind des Spielers, der gerade dran ist (bzw. des Betrachters)?
  TT.hostile = function (s, e) { return e.foe || (!!s.pl && e.pl !== s.me); };
  // Gehört e dem Spieler, der gerade dran ist?
  TT.ownEnt = function (s, e) { return !e.foe && (!s.pl || e.pl === s.me); };

  /* ---------- Neues Spiel ---------- */
  /* opts (alle freiwillig): W, H, gold, shafts, firstWave, levelId,
       seals = Anzahl Siegelsteine, guards = Wachen je Siegelstein, guardLvl = deren Stufe */
  TT.newGame = function (seed, opts) {
    opts = opts || {};
    const W = opts.W || TT.W, H = opts.H || TT.H, n = W * H, B = TT.BAL;
    const sz = (W * H) / (TT.W * TT.H), sf = Math.sqrt(sz);     // Größe im Vergleich zum freien Spiel
    const rnd = TT.rng(seed);
    const ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
    const fill = function (v) { return new Array(n).fill(v); };

    const s = {
      v: 1, seed: seed, W: W, H: H,
      tiles: fill(T.EARTH), room: fill(0), mark: fill(0), seen: fill(0),
      dig: fill(0), ore: fill(0), food: fill(0), obj: fill(0),
      traps: [], ents: [], nextId: 1, prisoners: [], pickups: [], shafts: [], fx: [],
      msgs: [], msgN: 0,
      gold: opts.gold || B.startGold, ess: 120, parts: 0,
      research: { done: {}, cur: null, pts: 0 },
      time: 0, payT: B.payEvery, gateT: 10, growT: 0,
      waveN: 0, waveT: opts.firstWave || B.firstWave, warned: false, shaftPick: 0,
      levelId: opts.levelId === undefined ? null : opts.levelId, seals: [], bossPhase: 0, bossT: 0, coreLow: B.coreHp,
      rally: null, rallyN: 0,
      coreIdx: 0, coreHp: B.coreHp, coreHitT: -99, coreMsgT: -99,
      rift: { idx: 0, on: false },
      stats: { kills: 0, lost: 0, mined: 0 },
      over: false, won: false, wonShown: false,
    };

    const cx = W >> 1, cy = H >> 1;
    const inner = function (x, y) { return x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2; };
    const dc = function (x, y) { return Math.hypot(x - cx, y - cy); };

    // Unzerstörbarer Rand
    for (let x = 0; x < W; x++) { s.tiles[x] = T.ROCK; s.tiles[(H - 1) * W + x] = T.ROCK; }
    for (let y = 0; y < H; y++) { s.tiles[y * W] = T.ROCK; s.tiles[y * W + W - 1] = T.ROCK; }

    // Zufallsspaziergang: ruft fn für jedes besuchte Innenfeld auf
    function walk(x, y, len, fn) {
      for (let j = 0; j < len; j++) {
        if (inner(x, y)) fn(x, y, y * W + x);
        const d = ri(0, 3);
        x += d === 0 ? 1 : d === 1 ? -1 : 0;
        y += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
    function area(x, y, r, t) {
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
        if (inner(xx, yy)) { const i = yy * W + xx; s.tiles[i] = t; s.ore[i] = 0; }
      }
    }

    // Felsbrocken
    for (let k = 0; k < Math.round(36 * sz); k++) {
      walk(ri(2, W - 3), ri(2, H - 3), ri(3, 12), function (x, y, i) { if (dc(x, y) > 6) s.tiles[i] = T.ROCK; });
    }

    // Goldadern – eine garantiert in Kernnähe
    const gold = function (x, y, i) { if (dc(x, y) > 3.6) { s.tiles[i] = T.GOLD; s.ore[i] = B.oreGold; } };
    const a0 = rnd() * Math.PI * 2;
    walk(Math.round(cx + Math.cos(a0) * 7), Math.round(cy + Math.sin(a0) * 6), 8, gold);
    for (let k = 0; k < Math.round(11 * sz); k++) {
      let x, y, g = 0;
      do { x = ri(3, W - 4); y = ri(3, H - 4); } while (dc(x, y) < 9 && g++ < 50);
      walk(x, y, ri(4, 9), gold);
    }

    // Kristalladern: unerschöpflich, aber weit draußen
    for (let k = 0; k < Math.max(2, Math.round(3 * sz)); k++) {
      let x, y, g = 0;
      do { x = ri(4, W - 5); y = ri(4, H - 5); } while (dc(x, y) < 15 * sf && g++ < 80);
      gold(x + 1, y, y * W + x + 1); gold(x, y + 1, (y + 1) * W + x);
      s.tiles[y * W + x] = T.GEM; s.ore[y * W + x] = 0;
    }

    // Besondere Orte festlegen: Riss (Portal) und Schächte (Eingänge der Oberwelt)
    const a1 = a0 + Math.PI * (0.7 + rnd() * 0.6);
    const rx = TT.clamp(Math.round(cx + Math.cos(a1) * 10), 4, W - 5);
    const ry = TT.clamp(Math.round(cy + Math.sin(a1) * 8), 4, H - 5);
    const special = [[rx, ry]];
    const cand = [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5], [cx, 3], [cx, H - 4]];
    if (W > 70) cand.push([3, cy], [W - 4, cy]);
    for (let k = cand.length - 1; k > 0; k--) { const j = ri(0, k), tmp = cand[k]; cand[k] = cand[j]; cand[j] = tmp; }
    const shafts = cand.slice(0, opts.shafts || 3);
    shafts.forEach(function (p) { special.push(p); });

    // Siegelsteine: rundum verteilt in eigenen Höhlen, weit weg vom Herzkern und von den Schächten
    const seals = [];
    if (opts.seals) {
      const base = rnd() * Math.PI * 2, rxS = W / 2 - 6, ryS = H / 2 - 5;
      for (let k = 0; k < opts.seals; k++) {
        let x = 0, y = 0, ok = false;
        for (let g = 0; g < 160 && !ok; g++) {
          const relax = g < 60 ? 1 : g < 110 ? 0.85 : 0.7;      // findet sich kein Platz, Abstände schrittweise lockern
          const a = base + k * Math.PI * 2 / opts.seals + (rnd() - 0.5) * 0.7, f = 0.72 + rnd() * 0.26;
          x = TT.clamp(Math.round(cx + Math.cos(a) * rxS * f), 5, W - 6);
          y = TT.clamp(Math.round(cy + Math.sin(a) * ryS * f), 5, H - 6);
          ok = dc(x, y) >= Math.max(12, 0.42 * Math.min(W, H) * relax) && special.concat(seals).every(function (p) { return Math.hypot(p[0] - x, p[1] - y) >= 8 * relax; });
        }
        if (!ok) continue;
        seals.push([x, y]); special.push([x, y]);
      }
    }

    // Verborgene Höhlen mit Truhen
    for (let k = 0; k < Math.round(4 * sz); k++) {
      let x, y, g = 0, ok = false;
      do {
        x = ri(4, W - 5); y = ri(4, H - 5);
        ok = dc(x, y) >= 11 && special.every(function (p) { return Math.hypot(p[0] - x, p[1] - y) >= 7; });
      } while (!ok && g++ < 120);
      if (!ok) continue;
      special.push([x, y]);
      walk(x, y, ri(7, 11), function (px, py, i) { s.tiles[i] = T.FLOOR; s.ore[i] = 0; });
      s.pickups.push({ idx: y * W + x, gold: ri(8, 16) * 25 });
    }

    // Herzkern, Riss, Schächte ausheben
    area(cx, cy, 2, T.CLAIMED);
    s.coreIdx = cy * W + cx;
    area(rx, ry, 1, T.FLOOR);
    s.rift.idx = ry * W + rx;
    shafts.forEach(function (p) { area(p[0], p[1], 1, T.FLOOR); s.shafts.push(p[1] * W + p[0]); });
    seals.forEach(function (p) {
      walk(p[0], p[1], 12, function (px, py, i) { s.tiles[i] = T.FLOOR; s.ore[i] = 0; });
      area(p[0], p[1], 1, T.FLOOR);
      s.seals.push({ idx: p[1] * W + p[0], taken: false });
    });

    // Sicherstellen, dass kein Fels den Weg zum Kern völlig versperrt
    function corridor(x, y) {
      while (x !== cx || y !== cy) {
        if (x !== cx) x += x < cx ? 1 : -1; else y += y < cy ? 1 : -1;
        const i = y * W + x;
        if (s.tiles[i] === T.ROCK || s.tiles[i] === T.GEM) s.tiles[i] = T.EARTH;
      }
    }
    corridor(rx, ry);
    shafts.forEach(function (p) { corridor(p[0], p[1]); });
    seals.forEach(function (p) { corridor(p[0], p[1]); });

    TT.reveal(s, s.coreIdx, 7);
    [1, -1, W, -W].forEach(function (d) { TT.spawn(s, "digger", s.coreIdx + d, false); });
    // Siegelsteine schimmern durch den Nebel; ihre Wachen stehen bereit
    const offs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    s.seals.forEach(function (seal) {
      TT.reveal(s, seal.idx, 1);
      (opts.guards || []).forEach(function (type, j) {
        const o = offs[j % offs.length], e = TT.spawn(s, type, seal.idx + o[0] + o[1] * W, true);
        e.guard = true; e.post = seal.idx; e.lvl = opts.guardLvl || 1; e.hp = TT.maxHp(s, e);
      });
    });
    TT.msg(s, "Der Herzkern erwacht. Markiere Erdreich zum Graben.", "good");
    return s;
  };

  /* ---------- Feldabfragen ---------- */
  TT.walkable = function (s, i) { return s.tiles[i] >= T.FLOOR && !TT.isCore(s, i); };
  TT.tileOf = function (s, e) { return (e.y | 0) * s.W + (e.x | 0); };

  // Nebel lüften
  TT.reveal = function (s, idx, r) {
    const W = s.W, H = s.H, cx = idx % W, cy = (idx / W) | 0, r2 = r * r + 0.5;
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) s.seen[y * W + x] = 1;
      }
    }
  };

  // Ein Feld wurde abgetragen
  TT.openTile = function (s, i) {
    s.tiles[i] = T.FLOOR; s.mark[i] = 0; s.dig[i] = 0; s.ore[i] = 0;
    TT.reveal(s, i, 3);
  };

  // Ein Feld gehört jetzt dir
  TT.claimTile = function (s, i) {
    if (s.own) {
      if (s.own[i] && s.own[i] !== s.me + 1) {             // feindlicher Boden wird übernommen: Fallen und Türen zerbrechen
        if (s.obj[i]) TT.removeTrap(s, i);
        const other = s.me === 0 ? 1 : 0;
        if (s.room[i]) TT.inCtx(s, other, function () { TT.msg(s, "Dein Rivale hat dir ein Feld deiner " + TT.ROOMS[s.room[i]].name + " entrissen!", "bad"); });
      }
      s.own[i] = s.me + 1;
    }
    s.tiles[i] = T.CLAIMED;
    TT.reveal(s, i, 3);
    for (const seal of s.seals || []) if (seal.idx === i && !seal.taken) TT.sealTaken(s, seal);
    if (i === s.rift.idx && !s.rift.on) {
      s.rift.on = true;
      s.gateT = Math.min(s.gateT, 6);
      TT.msg(s, "Der Riss gehört dir! Baue Schlafhöhlen, dann kriechen Kreaturen hindurch.", "good");
      TT.sfx("spell");
    }
  };

  /* ---------- Wegfindung ----------
     flood(): Breitensuche über begehbare Felder ab einem Startfeld.
     Liefert Entfernungen (-1 = unerreichbar) und Vorgänger zum Zurückverfolgen. */
  // foe = true: alle Türen sperren (Eindringlinge). noEnemyDoors: Türen des Gegenspielers sperren (Wühler auf der gemeinsamen Karte).
  TT.flood = function (s, start, foe, noEnemyDoors) {
    const n = s.tiles.length, W = s.W;
    const dist = new Int16Array(n).fill(-1), prev = new Int32Array(n).fill(-1), q = new Int32Array(n);
    const tiles = s.tiles, obj = s.obj, core = s.coreIdx;
    const core2 = s.pl ? s.pl[s.me === 0 ? 1 : 0].coreIdx : -1, own = noEnemyDoors && s.own ? s.own : null, me1 = s.me + 1;
    let h = 0, t = 0;
    dist[start] = 0; q[t++] = start;
    while (h < t) {
      const c = q[h++], d = dist[c] + 1;
      for (let k = 0; k < 4; k++) {
        const a = c + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? W : -W);
        if (a < 0 || a >= n || dist[a] !== -1 || tiles[a] < 4 || a === core || a === core2) continue;
        if (foe && obj[a] === 1) continue;           // Türen halten Eindringlinge auf
        if (own && obj[a] === 1 && own[a] !== me1) continue;
        dist[a] = d; prev[a] = c; q[t++] = a;
      }
    }
    return { dist: dist, prev: prev, start: start };
  };

  TT.pathTo = function (fl, goal) {
    const p = [];
    let c = goal;
    while (c !== fl.start && c >= 0) { p.push(c); c = fl.prev[c]; }
    p.reverse();
    return p;
  };

  // Freie Sichtlinie zwischen zwei Punkten (für Fernkämpfer)
  TT.los = function (s, x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
    for (let k = 1; k < n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      if (s.tiles[(y | 0) * s.W + (x | 0)] < T.FLOOR) return false;
    }
    return true;
  };

  /* Kostenfeld für Eindringlinge: wie "teuer" ist der Weg von jedem Feld zum Herzkern?
     Erde kann durchgraben werden (teuer), Türen müssen eingeschlagen werden (teuer),
     Fels ist unpassierbar. Eindringlinge laufen einfach immer "bergab". */
  TT.foeField = function (s) {
    if (s._ff && s.time - s._ffT < 0.4 && s.time >= s._ffT) return s._ff;
    const n = s.tiles.length, W = s.W, K = 65536;
    const f = new Float32Array(n).fill(Infinity);
    const heap = [];
    function push(v) {
      let i = heap.length; heap.push(v);
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p] <= v) break; heap[i] = heap[p]; i = p; }
      heap[i] = v;
    }
    function pop() {
      const top = heap[0], v = heap.pop(), len = heap.length;
      if (len) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= len) break;
          if (c + 1 < len && heap[c + 1] < heap[c]) c++;
          if (heap[c] >= v) break;
          heap[i] = heap[c]; i = c;
        }
        heap[i] = v;
      }
      return top;
    }
    f[s.coreIdx] = 0; push(s.coreIdx);
    while (heap.length) {
      const v = pop(), c = v % K, d = (v - c) / K;
      if (d > f[c]) continue;
      for (let k = 0; k < 4; k++) {
        const a = c + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? W : -W);
        if (a < 0 || a >= n) continue;
        const t = s.tiles[a];
        let w;
        if (t >= T.FLOOR) w = 1 + (s.obj[a] === 1 ? 25 : 0);
        else if (t === T.EARTH || t === T.GOLD) w = 14;
        else continue;
        const nd = d + w;
        if (nd < f[a]) { f[a] = nd; push(nd * K + a); }
      }
    }
    s._ff = f; s._ffT = s.time;
    return f;
  };
})();
