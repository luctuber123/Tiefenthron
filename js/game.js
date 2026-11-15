"use strict";
/* Spielregeln: Wirtschaft, Forschung, Überfälle, Zauber und Spieleraktionen. */
(function () {
  const T = TT.T, B = TT.BAL, ID = TT.ROOM_ID, OBJ = TT.OBJ;

  /* ---------- Meldungen ---------- */
  TT.msg = function (s, text, kind) {
    s.msgs.push({ id: ++s.msgN, text: text, kind: kind || "info" });
    if (s.msgs.length > 40) s.msgs.shift();
  };

  /* ---------- Wirtschaft ---------- */
  TT.countRooms = function (s) {
    const rc = new Array(TT.ROOMS.length).fill(0), own = s.own, me1 = s.me + 1;
    let claimed = 0;
    for (let i = 0; i < s.tiles.length; i++) {
      if (s.tiles[i] === T.CLAIMED && (!own || own[i] === me1)) { claimed++; if (s.room[i]) rc[s.room[i]]++; }
    }
    s._rc = rc; s._claimed = claimed;
    return rc;
  };
  TT.roomCount = function (s, key) { return (s._rc || TT.countRooms(s))[ID[key]]; };
  TT.goldCap = function (s) { return B.coreCap + B.treasuryCap * (s._rc || TT.countRooms(s))[ID.treasury]; };
  TT.essCap = function (s) { return Math.min(600, 200 + (s._claimed || 0)); };

  // Fügt Gold hinzu, soweit Platz ist; gibt die tatsächlich gelagerte Menge zurück
  TT.addGold = function (s, n) {
    const put = Math.max(0, Math.min(n, TT.goldCap(s) - s.gold));
    s.gold += put;
    return put;
  };

  // Verfügbar ist, was das Gebiet erlaubt (Kampagne) und was schon erforscht ist
  TT.unlocked = function (s, item) {
    const L = TT.levelOf(s);
    if (L && item.key && L.allow.indexOf(item.key) < 0) return false;
    return !item.research || !!s.research.done[item.research];
  };
  TT.lockReason = function (s, item) {
    const L = TT.levelOf(s);
    if (L && item.key && L.allow.indexOf(item.key) < 0) return "In diesem Gebiet noch nicht verfügbar.";
    if (L && item.research && L.research.indexOf(item.research) < 0 && !s.research.done[item.research]) return "In diesem Gebiet nicht erforschbar.";
    return "Muss erst im Archiv erforscht werden.";
  };

  TT.countOwn = function (s) {
    let workers = 0, fighters = 0, foes = 0, guards = 0;
    for (const e of s.ents) {
      if (e.dead) continue;
      if (e.foe) { if (e.guard) guards++; else foes++; } else if (s.pl && e.pl !== s.me) foes++; else if (e.worker) workers++; else fighters++;
    }
    return { workers: workers, fighters: fighters, foes: foes, guards: guards };
  };

  /* ---------- Fallen ---------- */
  TT.trapAt = function (s, idx) {
    for (const tr of s.traps) if (tr.idx === idx) return tr;
    return null;
  };
  TT.removeTrap = function (s, idx) {
    s.obj[idx] = 0;
    s.traps = s.traps.filter(function (tr) { return tr.idx !== idx; });
  };

  /* ---------- Herzkern ---------- */
  TT.hitCore = function (s, dmg) {
    if (s.over) return;
    s.coreHp -= dmg; s.coreHitT = s.time;
    s.coreLow = Math.min(s.coreLow === undefined ? TT.BAL.coreHp : s.coreLow, Math.max(0, s.coreHp));
    TT.sfx("core");
    if (s.time - s.coreMsgT > 12) {
      s.coreMsgT = s.time;
      TT.msg(s, "Der Herzkern wird angegriffen!", "bad");
    }
    if (s.coreHp <= 0 && !s.over) {
      s.coreHp = 0; s.over = true;
      TT.msg(s, "Der Herzkern ist zerbrochen. Dein Reich zerfällt zu Staub.", "bad");
      TT.sfx("lose");
      if (s.pl) {                                         // gemeinsame Karte: der andere hat gewonnen
        s.winner = s.me === 0 ? 1 : 0;
        TT.inCtx(s, s.winner, function () { TT.msg(s, "Der Herzkern deines Rivalen zerspringt!", "good"); TT.sfx("win"); });
      }
    }
  };

  /* ---------- Überfälle ---------- */
  function spawnWave(s) {
    const L = TT.levelOf(s);
    if (L) { spawnLevelWave(s, L); return; }
    const n = ++s.waveN, C = TT.CREATURES, W = s.W;
    const shaft = s.shafts[s.shaftPick % s.shafts.length];
    const boss = !s.duel && (n === 10 || (n > 10 && n % 5 === 0));
    let budget = 3 + n * 2.05 + n * n * 0.065;     // Überfälle wachsen erst gemächlich, dann spürbar
    const list = [];
    if (boss) { list.push("vogt"); budget *= 0.7; }
    const pool = Object.keys(C).filter(function (k) { return C[k].foe && !C[k].boss && (C[k].from || 1) <= n; });
    for (let guard = 0; budget >= 1 && guard < 80; guard++) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      if (C[k].cost <= budget) { list.push(k); budget -= C[k].cost; }
    }
    const lvl = 1 + Math.floor((n - 1) / 3), hpx = n > 10 ? 1 + (n - 10) * 0.12 : 1;
    list.forEach(function (k, j) {
      const idx = shaft + ((j % 3) - 1) + ((((j / 3) | 0) % 3) - 1) * W;
      const e = TT.spawn(s, k, TT.walkable(s, idx) ? idx : shaft, true);
      e.lvl = C[k].boss ? Math.max(1, lvl - 1) : lvl; e.hpx = hpx; e.hp = TT.maxHp(s, e);
      e.think = Math.random();
    });
    TT.msg(s, "Überfall " + n + ": " + list.length + " Eindringlinge steigen im " + TT.compass(s, shaft) +
      " herab" + (boss ? " – angeführt vom Lichtvogt!" : "!"), "bad");
    TT.sfx("alarm");
    s.waveT = Math.max(95, B.waveEvery - n * 4);
    s.warned = false;
  }

  // Eindringlinge um einen Schacht herum absetzen
  TT.dropFoes = function (s, shaft, list, lvl, hpx) { return drop(s, shaft, list, lvl, hpx); };
  function drop(s, shaft, list, lvl, hpx) {
    const C = TT.CREATURES, W = s.W, out = [];
    list.forEach(function (k, j) {
      const idx = shaft + ((j % 3) - 1) + ((((j / 3) | 0) % 3) - 1) * W;
      const e = TT.spawn(s, k, TT.walkable(s, idx) ? idx : shaft, true);
      e.lvl = lvl; e.hpx = hpx; e.hp = TT.maxHp(s, e); e.think = Math.random();
      out.push(e);
      void C;
    });
    return out;
  }

  // Überfälle in der Kampagne: Gegnerarten und Stärke legt das Gebiet fest
  function spawnLevelWave(s, L) {
    const n = ++s.waveN, C = TT.CREATURES;
    const shaft = s.shafts[s.shaftPick % s.shafts.length];
    let budget = L.budget[0] + n * L.budget[1] + n * n * 0.06;
    let pool = L.foes.filter(function (k) { return (C[k].from || 1) <= n + Math.max(0, L.index); });
    if (!pool.length) pool = [L.foes[0]];
    const list = [];
    for (let guard = 0; budget >= 1 && guard < 120; guard++) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      if (C[k].cost <= budget) { list.push(k); budget -= C[k].cost; }
    }
    drop(s, shaft, list, 1 + L.heroLvl + Math.floor((n - 1) / 3), 1 + (n - 1) * 0.05);
    TT.msg(s, "Überfall " + n + ": " + list.length + " Eindringlinge steigen im " + TT.compass(s, shaft) + " herab!", "bad");
    TT.sfx("alarm");
    s.waveT = Math.max(L.waveEvery * 0.55, L.waveEvery - n * 4);
    s.warned = false;
  }

  /* ---------- Siegelsteine und Endboss ---------- */
  TT.sealTaken = function (s, seal) {
    seal.taken = true;
    const left = s.seals.filter(function (q) { return !q.taken; }).length;
    s.fx.push({ k: "ring", x: (seal.idx % s.W) + 0.5, y: ((seal.idx / s.W) | 0) + 0.5, r: 2.5, color: "#b06cff", t: 0.9, d: 0.9 });
    TT.msg(s, left ? "Ein Siegelstein ist gebrochen! Noch " + left + "." : "Der letzte Siegelstein ist gebrochen!", "good");
    TT.sfx("spell");
  };

  function spawnBoss(s, L) {
    // aus dem Schacht, der am weitesten vom Herzkern entfernt liegt
    const f = TT.foeField(s);
    let shaft = s.shafts[0];
    for (const sh of s.shafts) if (f[sh] < Infinity && (f[shaft] === Infinity || f[sh] > f[shaft])) shaft = sh;
    const b = L.boss;
    const boss = drop(s, shaft, [b.type], b.lvl, b.hp)[0];
    boss.boss = true; boss.name = b.name;
    drop(s, shaft, b.escort, b.lvl - 1, 1.2);
    s.bossId = boss.id;
    TT.msg(s, b.name + " steigt im " + TT.compass(s, shaft) + " herab: " + b.taunt, "bad");
    TT.sfx("alarm");
  }

  // Spieler ruft den nächsten Überfall vorzeitig herbei und kassiert Bonusgold
  TT.callWave = function (s) {
    if (s.over || s.waveT <= 5) return false;
    const bonus = 50 + Math.round(s.waveT);
    const put = TT.addGold(s, bonus);
    if (!s.warned) { s.shaftPick = Math.floor(Math.random() * s.shafts.length); s.warned = true; }
    s.waveT = 3;
    TT.msg(s, "Du forderst die Oberwelt heraus. Kopfgeld im Voraus: +" + put + " Gold.", "info");
    return true;
  };

  /* ---------- Neuankömmlinge durch den Riss ---------- */
  function gateSpawn(s) {
    const rc = s._rc, C = TT.CREATURES, cnt = {};
    let fighters = 0;
    for (const e of s.ents) if (TT.ownEnt(s, e) && !e.worker && !e.dead) { fighters++; cnt[e.type] = (cnt[e.type] || 0) + 1; }
    if (fighters >= Math.min(rc[ID.lair], B.maxCreatures)) return;
    // Arten, die noch ganz fehlen, kommen bevorzugt – so lohnt sich jeder neue Raum sofort
    const wt = function (k) { return C[k].weight * (cnt[k] ? 1 : 4); };
    const pool = [];
    let total = 0;
    const L = TT.levelOf(s);
    for (const k in C) {
      const d = C[k];
      if (d.foe || d.worker || !d.need) continue;
      if (L && L.creatures.indexOf(k) < 0) continue;
      if (d.max && (cnt[k] || 0) >= d.max) continue;
      let ok = true;
      for (const r in d.need) if (rc[ID[r]] < d.need[r]) ok = false;
      if (ok) { pool.push(k); total += wt(k); }
    }
    if (!pool.length) return;
    let r = Math.random() * total, pick = pool[0];
    for (const k of pool) { r -= wt(k); if (r <= 0) { pick = k; break; } }
    TT.spawn(s, pick, s.rift.idx, false);
    s.fx.push({ k: "ring", x: (s.rift.idx % s.W) + 0.5, y: ((s.rift.idx / s.W) | 0) + 0.5, r: 1.4, color: "#b06cff", t: 0.6, d: 0.6 });
    TT.msg(s, "Ein " + C[pick].name + " kriecht aus dem Riss.", "good");
    TT.sfx("arrive");
  }

  /* ============================================================
     HAUPT-UPDATE (wird viele Male pro Sekunde aufgerufen)
     ============================================================ */
  TT.update = function (s, dt) {
    if (s.pl) { TT.updateVersus(s, dt); return; }
    if (s.over) return;
    s.time += dt;
    const rc = TT.countRooms(s);
    essTick(s, dt);
    growTick(s, dt);
    econTick(s, dt, rc);
    waveTick(s, dt);
    if (s.duel && TT.duelTick) TT.duelTick(s, dt);
    // Kriegstrommel läuft aus
    if (s.rally) { s.rally.t -= dt; if (s.rally.t <= 0) s.rally = null; }
    alarmTick(s);
    // Kreaturen
    for (let k = 0; k < s.ents.length; k++) TT.updateEnt(s, s.ents[k], dt);
    trapTick(s, dt);
    prisonTick(s, dt, rc);
    pickupTick(s);
    coreHealTick(s, dt);
    cleanupTick(s, dt);
  };

  // Essenz fließt aus beanspruchtem Boden
  function essTick(s, dt) { s.ess = Math.min(TT.essCap(s), s.ess + dt * (0.8 + s._claimed * 0.015)); }

  // Pilze wachsen
  function growTick(s, dt) {
    s.growT += dt;
    if (s.growT >= 2) {
      s.growT = 0;
      for (let i = 0; i < s.room.length; i++) {
        if (s.room[i] === ID.garden && s.food[i] < 3 && Math.random() < 0.1) s.food[i]++;
      }
    }
  }

  // Forschung, Zahltag und Riss des Spielers, der gerade dran ist
  function econTick(s, dt, rc) {
    const R = s.research;
    if (!R.cur) {
      const L = TT.levelOf(s);
      for (const r of TT.RESEARCH) if (!R.done[r.key] && (!L || L.research.indexOf(r.key) >= 0)) { R.cur = r.key; break; }
    }
    if (R.cur) {
      if (rc[ID.archive] > 0) R.pts += dt * 0.12;         // Staub liest sich fast von selbst
      const item = TT.RESEARCH.find(function (r) { return r.key === R.cur; });
      if (R.pts >= item.cost) {
        R.pts -= item.cost; R.done[item.key] = true; R.cur = null;
        TT.msg(s, "Erforscht: " + item.name, "good");
        TT.sfx("level");
        if (item.key === "deep") for (const e of s.ents) if (!e.foe) e.hp = Math.round(e.hp * 1.25);
      }
    } else R.pts = 0;

    // Zahltag
    s.payT -= dt;
    if (s.payT <= 0) {
      s.payT = B.payEvery;
      let paid = 0, unpaid = 0;
      for (const e of s.ents) {
        const w = TT.wageOf(e);
        if (!w || e.dead || (s.pl && e.pl !== s.me)) continue;
        if (s.gold >= w) { s.gold -= w; paid += w; e.mood = Math.min(100, e.mood + 4); }
        else { unpaid++; e.mood -= 35; }
      }
      if (unpaid) TT.msg(s, "Zahltag: " + unpaid + " Kreaturen gingen leer aus und murren!", "bad");
      else if (paid) TT.msg(s, "Zahltag: " + paid + " Gold Sold ausgezahlt.", "info");
      if (paid) TT.sfx("coin");
    }

    // Riss
    if (s.rift.on) {
      s.gateT -= dt;
      if (s.gateT <= 0) { s.gateT = B.gateEvery; gateSpawn(s); }
    }
  }

  function waveTick(s, dt) {
    // Überfälle
    s.waveT -= dt;
    if (s.waveT <= 25 && !s.warned) {
      s.warned = true;
      s.shaftPick = Math.floor(Math.random() * s.shafts.length);
      TT.msg(s, "Fackelschein im " + TT.compass(s, s.shafts[s.shaftPick]) + " – ein Überfall naht!", "warn");
      TT.sfx("warn");
    }
    if (s.waveT <= 0) spawnWave(s);

    // Kampagne: Sind alle Siegelsteine gebrochen, kommt der Endboss
    const LV = TT.levelOf(s);
    if (LV && !s.won) {
      if (!s.bossPhase && s.seals.length && s.seals.every(function (q) { return q.taken; })) {
        s.bossPhase = 1; s.bossT = 20; s.waveT = 1e9;      // keine normalen Überfälle mehr
        TT.msg(s, "Der Fels bebt. Oben sammelt sich das Licht – " + LV.boss.name + " kommt!", "warn");
        TT.sfx("warn");
      } else if (s.bossPhase === 1) {
        s.bossT -= dt;
        if (s.bossT <= 0) { s.bossPhase = 2; spawnBoss(s, LV); }
      }
    }
  }

  // Alarm: Feinde auf deinem Boden oder Kern unter Beschuss
  function alarmTick(s) {
    let foes = 0, alarm = s.time - s.coreHitT < 6;
    for (const e of s.ents) {
      if (!TT.hostile(s, e) || e.dead || e.held) continue;
      foes++;
      if (!e.worker && TT.mine(s, TT.tileOf(s, e))) alarm = true;
    }
    if (alarm && !s._alarm) TT.sfx("alarm");
    s._foes = foes; s._alarm = alarm;
  }

  // Fallen auf dem Boden des Spielers, der gerade dran ist
  function trapTick(s, dt) {
    for (let k = s.traps.length - 1; k >= 0; k--) {
      const tr = s.traps[k];
      if (tr.k === OBJ.DOOR) continue;
      if (s.own && s.own[tr.idx] !== s.me + 1) continue;
      if (tr.cd > 0) { tr.cd -= dt; continue; }
      if (!s._foes) continue;
      const def = TT.TRAP_BY_OBJ[tr.k], tx = (tr.idx % s.W) + 0.5, ty = ((tr.idx / s.W) | 0) + 0.5;
      let hit = false;
      for (const e of s.ents) {
        if (!TT.hostile(s, e) || e.dead || e.held || Math.hypot(e.x - tx, e.y - ty) > def.radius) continue;
        TT.damage(s, e, def.dmg, null); hit = true;
        if (!def.area) break;
      }
      if (hit) {
        tr.cd = def.cd; tr.ch--;
        s.fx.push({ k: "ring", x: tx, y: ty, r: def.radius, color: tr.k === OBJ.FLAME ? "#ff7a2c" : "#d8e0ea", t: 0.35, d: 0.35 });
        TT.sfx(tr.k === OBJ.FLAME ? "flame" : "hit");
        if (tr.ch <= 0) { s.obj[tr.idx] = 0; s.traps.splice(k, 1); }
      }
    }
  }

  function prisonTick(s, dt, rc) {
    // Gefangene laufen über
    for (let k = s.prisoners.length - 1; k >= 0; k--) {
      const p = s.prisoners[k];
      if (s.room[p.idx] !== ID.prison) {                 // Zelle abgerissen -> Ausbruch
        TT.spawn(s, p.type, p.idx, true).lvl = p.lvl;
        s.prisoners.splice(k, 1);
        TT.msg(s, "Ein Gefangener ist ausgebrochen!", "bad");
        continue;
      }
      p.t = Math.min(B.convertTime, p.t + dt);
      // Überlaufen kann nur, wer danach auch einen Schlafplatz findet
      if (p.t >= B.convertTime && TT.countOwn(s).fighters < Math.min(rc[ID.lair], B.maxCreatures)) {
        const c = TT.spawn(s, p.type, p.idx, false);
        c.conv = true; c.lvl = p.lvl; c.hp = TT.maxHp(s, c);
        s.prisoners.splice(k, 1);
        TT.msg(s, "Ein " + TT.CREATURES[p.type].name + " schwört dem Licht ab und dient nun dir.", "good");
        TT.sfx("arrive");
      }
    }
  }

  // Truhen einsammeln (nur Kreaturen des Spielers, der gerade dran ist)
  function pickupTick(s) {
    for (let k = s.pickups.length - 1; k >= 0; k--) {
      const p = s.pickups[k];
      for (const e of s.ents) {
        if (!TT.ownEnt(s, e) || e.dead || e.held || TT.tileOf(s, e) !== p.idx) continue;
        const put = TT.addGold(s, p.gold);
        s.fx.push({ k: "text", x: e.x, y: e.y - 0.5, text: "Truhe! +" + put, color: "#ffd75e", t: 1.6, d: 1.6 });
        TT.msg(s, "Eine vergessene Truhe: +" + put + " Gold.", "good");
        TT.sfx("coin");
        s.pickups.splice(k, 1);
        break;
      }
    }
  }

  // Kern heilt sich außerhalb von Kämpfen
  function coreHealTick(s, dt) {
    if (s.time - s.coreHitT > 15 && s.coreHp < B.coreHp) s.coreHp = Math.min(B.coreHp, s.coreHp + dt * 3);
  }

  // Aufräumen
  function cleanupTick(s, dt) {
    let anyDead = false;
    for (const e of s.ents) if (e.dead) { anyDead = true; break; }
    if (anyDead) s.ents = s.ents.filter(function (e) { return !e.dead; });
    for (let k = s.fx.length - 1; k >= 0; k--) { s.fx[k].t -= dt; if (s.fx[k].t <= 0) s.fx.splice(k, 1); }
  }

  // Für die gemeinsame Karte (js/versus.js)
  TT.ticks = { ess: essTick, grow: growTick, econ: econTick, alarm: alarmTick, traps: trapTick, pickups: pickupTick,
    coreHeal: coreHealTick, cleanup: cleanupTick };

  /* ============================================================
     SPIELERAKTIONEN (werden von der Oberfläche aufgerufen)
     ============================================================ */

  // Felder zum Graben markieren (on=true) oder Markierung löschen
  TT.actMark = function (s, x0, y0, x1, y1, on) {
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 1 || y < 1 || x > s.W - 2 || y > s.H - 2) continue;
      const i = y * s.W + x, t = s.tiles[i];
      if (!on) { if (s.mark[i]) { s.mark[i] = 0; n++; } continue; }
      if (t >= T.FLOOR || s.mark[i]) continue;
      if (s.seen[i] && t === T.ROCK) continue;
      s.mark[i] = 1; n++;
    }
    return n;
  };

  TT.isSpecial = function (s, i) {
    if (i === s.coreIdx || i === s.rift.idx || s.shafts.indexOf(i) >= 0) return true;
    if (s.pl) for (const P of s.pl) if (i === P.coreIdx || i === P.rift.idx) return true;
    for (const p of s.pickups) if (p.idx === i) return true;
    return false;
  };

  TT.canBuildAt = function (s, i) {
    return TT.mine(s, i) && !s.room[i] && !s.obj[i] && !TT.isSpecial(s, i);
  };

  TT.actBuild = function (s, roomId, x0, y0, x1, y1) {
    const def = TT.ROOMS[roomId];
    if (!def || !TT.unlocked(s, def)) return { built: 0, why: "Noch nicht erforscht." };
    let built = 0, poor = false;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 1 || y < 1 || x > s.W - 2 || y > s.H - 2) continue;
      const i = y * s.W + x;
      if (!TT.canBuildAt(s, i)) continue;
      if (s.gold < def.cost) { poor = true; continue; }
      s.gold -= def.cost; s.room[i] = roomId; s.food[i] = 0; built++;
    }
    TT.countRooms(s);
    if (built) TT.sfx("build");
    return { built: built, why: built ? "" : poor ? "Nicht genug Gold." : "Räume brauchen freien, beanspruchten Boden." };
  };

  // Räume und Fallen abreißen (halbe Kosten zurück)
  TT.actSell = function (s, x0, y0, x1, y1) {
    let n = 0, gold = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 1 || y < 1 || x > s.W - 2 || y > s.H - 2) continue;
      const i = y * s.W + x;
      if (s.own && s.own[i] !== s.me + 1) continue;
      if (s.room[i]) { gold += Math.floor(TT.ROOMS[s.room[i]].cost / 2); s.room[i] = 0; s.food[i] = 0; n++; }
      if (s.obj[i]) {
        s.parts = Math.min(B.partsCap, s.parts + Math.floor(TT.TRAP_BY_OBJ[s.obj[i]].parts / 2));
        TT.removeTrap(s, i); n++;
      }
    }
    TT.countRooms(s);
    if (gold) TT.addGold(s, gold);
    if (n) TT.sfx("build");
    return { n: n, gold: gold };
  };

  TT.actTrap = function (s, key, i) {
    const def = TT.TRAPS.find(function (t) { return t.key === key; });
    if (!def || !TT.unlocked(s, def)) return { ok: false, why: "Noch nicht erforscht." };
    if (s.parts < def.parts) return { ok: false, why: "Nicht genug Bauteile – Eisenwänste müssen in der Schmiede arbeiten." };
    if (!TT.canBuildAt(s, i)) return { ok: false, why: "Fallen brauchen freien, beanspruchten Boden." };
    s.parts -= def.parts;
    s.obj[i] = def.obj;
    s.traps.push({ idx: i, k: def.obj, hp: def.hp || 0, cd: 0, ch: def.charges || 0 });
    TT.sfx("build");
    return { ok: true };
  };

  TT.spellCost = function (s, sp) {
    if (sp.key !== "worker") return sp.cost;
    return sp.cost + 20 * Math.max(0, TT.countOwn(s).workers - 4);
  };

  TT.actSpell = function (s, key, i) {
    const sp = TT.SPELLS.find(function (x) { return x.key === key; });
    if (!sp || !TT.unlocked(s, sp)) return { ok: false, why: "Noch nicht erforscht." };
    const cost = TT.spellCost(s, sp);
    if (s.ess < cost) return { ok: false, why: "Nicht genug Essenz." };
    const W = s.W, x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
    const near = function (e) { return Math.hypot(e.x - x, e.y - y) <= sp.radius + 0.3; };

    switch (key) {
      case "worker": {
        if (TT.countOwn(s).workers >= B.maxWorkers) return { ok: false, why: "Mehr Wühler verträgt der Herzkern nicht." };
        const nb = [1, -1, W, -W];
        const e = TT.spawn(s, "digger", s.coreIdx + nb[Math.floor(Math.random() * 4)], false);
        s.fx.push({ k: "ring", x: e.x, y: e.y, r: 0.9, color: "#37e0c8", t: 0.5, d: 0.5 });
        break;
      }
      case "eye":
        TT.reveal(s, i, sp.radius);
        s.fx.push({ k: "ring", x: x, y: y, r: sp.radius, color: "#8fe8ff", t: 0.7, d: 0.7 });
        break;
      case "heal": {
        let n = 0;
        for (const e of s.ents) if (TT.ownEnt(s, e) && !e.held && near(e)) { const m = TT.maxHp(s, e); e.hp = Math.min(m, e.hp + m * 0.5); n++; }
        if (!n) return { ok: false, why: "Dort ist niemand, den du heilen könntest." };
        s.fx.push({ k: "ring", x: x, y: y, r: sp.radius, color: "#7dffb0", t: 0.7, d: 0.7 });
        break;
      }
      case "spark": {
        if (!s.seen[i]) return { ok: false, why: "Du kannst nur treffen, was du siehst." };
        s.fx.push({ k: "bolt", x: x, y: y, t: 0.3, d: 0.3 });
        s.fx.push({ k: "ring", x: x, y: y, r: sp.radius, color: "#fff7c0", t: 0.3, d: 0.3 });
        for (const e of s.ents) if (TT.hostile(s, e) && !e.dead && !e.held && near(e)) TT.damage(s, e, 70, null);
        break;
      }
      case "drum":
        if (!TT.walkable(s, i) || !s.seen[i]) return { ok: false, why: "Die Trommel braucht ein begehbares, sichtbares Feld." };
        s.rally = { idx: i, t: 25, id: ++s.rallyN };
        s.fx.push({ k: "ring", x: x, y: y, r: 2.5, color: "#ff9a5c", t: 0.8, d: 0.8 });
        break;
      case "haste": {
        let n = 0;
        for (const e of s.ents) if (TT.ownEnt(s, e) && !e.held && near(e)) { e.haste = 15; n++; }
        if (!n) return { ok: false, why: "Dort ist niemand, den du hetzen könntest." };
        s.fx.push({ k: "ring", x: x, y: y, r: sp.radius, color: "#ffe36e", t: 0.6, d: 0.6 });
        break;
      }
    }
    s.ess -= cost;
    TT.sfx(key === "spark" ? "bolt" : "spell");
    return { ok: true };
  };

  // Kreatur aufheben und woanders absetzen
  TT.heldCount = function (s) {
    let n = 0;
    for (const e of s.ents) if (e.held && (!s.pl || e.pl === s.me)) n++;
    return n;
  };
  TT.actGrab = function (s, id) {
    const e = TT.byId(s, id);
    if (!e || !TT.ownEnt(s, e) || e.held || e.dead) return false;
    if (TT.heldCount(s) >= B.maxHeld) return false;
    e.held = true; e.job = null; e.path = []; e.target = 0; e.st = "idle";
    TT.sfx("grab");
    return true;
  };
  TT.actDrop = function (s, i) {
    if (!TT.mine(s, i) || TT.isCore(s, i)) return { ok: false, why: "Absetzen geht nur auf deinem eigenen Boden." };
    if (s.tut) s.tut.dropped = true;                      // fürs Tutorial: hat schon einmal abgesetzt
    for (let k = s.ents.length - 1; k >= 0; k--) {
      const e = s.ents[k];
      if (!e.held || (s.pl && e.pl !== s.me)) continue;
      e.held = false; e.x = (i % s.W) + 0.5; e.y = ((i / s.W) | 0) + 0.5;
      e.stun = 0.5; e.think = 0; e.lt = -1; e.st = "idle";
      s.fx.push({ k: "puff", x: e.x, y: e.y, t: 0.3, d: 0.3, color: "#c9c2d6" });
      TT.sfx("drop");
      return { ok: true };
    }
    return { ok: false, why: "" };
  };

  /* ---------- Speichern / Laden ---------- */
  TT.serialize = function (s) {
    return JSON.stringify(s, function (k, v) { return k[0] === "_" || k === "fx" ? undefined : v; });
  };
  TT.deserialize = function (text) {
    const s = JSON.parse(text);
    if (!s || s.v !== 1 || !Array.isArray(s.tiles)) throw new Error("Unbekannter Spielstand");
    s.fx = [];
    TT.countRooms(s);
    return s;
  };
})();
