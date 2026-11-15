"use strict";
/* Kreaturen: Wühler (Arbeiter), Kämpfer deiner Horde und Eindringlinge. */
(function () {
  const T = TT.T, B = TT.BAL, ID = TT.ROOM_ID;

  /* ---------- Erzeugen ---------- */
  TT.spawn = function (s, type, idx, foe) {
    const def = TT.CREATURES[type];
    const e = {
      id: s.nextId++, type: type, foe: !!foe, worker: !!def.worker, conv: false,
      x: (idx % s.W) + 0.5, y: ((idx / s.W) | 0) + 0.5,
      hp: 1, lvl: 1, xp: 0, hpx: 1,
      st: "idle", act: "", path: [], t: 0, cd: 0, hcd: 2, think: Math.random() * 0.5, rep: 0,
      target: 0, nx: -1, job: null, carry: 0, home: -1, rallyId: 0,
      hunger: Math.random() * 30, mood: 70,
      haste: 0, stun: 0, hurt: 0, held: false, dead: false, gone: false,
      dir: 1, lt: -1, mv: false, ph: Math.random() * 6.28,
    };
    e.hp = TT.maxHp(s, e);
    s.ents.push(e);
    return e;
  };

  TT.byId = function (s, id) {
    for (let k = 0; k < s.ents.length; k++) if (s.ents[k].id === id) return s.ents[k];
    return null;
  };

  TT.maxHp = function (s, e) {
    const def = TT.CREATURES[e.type];
    return Math.round(def.hp * (1 + 0.15 * (e.lvl - 1)) * (e.hpx || 1) * (!e.foe && s.research.done.deep ? 1.25 : 1));
  };

  TT.wageOf = function (e) {
    if (e.foe || e.worker) return 0;
    const def = TT.CREATURES[e.type];
    return def.wage !== undefined ? def.wage : 20;   // Überläufer bekommen 20
  };

  /* ---------- Bewegung ---------- */
  function speedOf(e, def) { return def.speed * (e.haste > 0 ? 1.8 : 1); }

  function moveToward(e, tx, ty, step) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.02) e.dir = dx > 0 ? 1 : -1;
    if (d <= step) { e.x = tx; e.y = ty; return true; }
    e.x += dx / d * step; e.y += dy / d * step;
    return false;
  }

  // Folgt e.path; true, sobald das Ziel erreicht ist
  function followPath(s, e, dt, def) {
    if (!e.path.length) return true;
    const i = e.path[0];
    if (moveToward(e, (i % s.W) + 0.5, ((i / s.W) | 0) + 0.5, speedOf(e, def) * dt)) e.path.shift();
    return e.path.length === 0;
  }

  /* ---------- Kampf ---------- */
  function gainXp(s, e, x) {
    if (e.lvl >= B.levelCap) return;
    e.xp += x;
    const need = 14 * e.lvl;
    if (e.xp >= need) {
      e.xp -= need; e.lvl++;
      const m = TT.maxHp(s, e);
      e.hp = Math.min(m, e.hp + m * 0.3);
      s.fx.push({ k: "text", x: e.x, y: e.y - 0.5, text: "Stufe " + e.lvl, color: "#b9fff2", t: 1.2, d: 1.2 });
      TT.sfx("level");
    }
  }

  TT.damage = function (s, t, dmg, by) {
    if (t.dead) return;
    t.hp -= dmg; t.hurt = 0.2;
    if (t.hp <= 0) TT.kill(s, t, by);
  };

  function attack(s, a, t, def) {
    const dmg = def.dmg * (1 + 0.12 * (a.lvl - 1)) * (0.85 + Math.random() * 0.3);
    if (def.ranged) s.fx.push({ k: "shot", x: a.x, y: a.y - 0.2, x2: t.x, y2: t.y - 0.1, color: def.shot || "#fff", t: 0.16, d: 0.16 });
    else s.fx.push({ k: "hit", x: t.x, y: t.y - 0.1, t: 0.18, d: 0.18 });
    TT.sfx(def.ranged ? "shot" : "hit");
    if (def.cleave) {
      // Rundumschlag: trifft alle Gegner in Reichweite
      for (const o of s.ents) {
        if (o !== t && o.foe !== a.foe && !o.dead && !o.held && Math.hypot(o.x - a.x, o.y - a.y) <= def.range + 0.3) TT.damage(s, o, dmg * 0.5, a);
      }
    }
    TT.damage(s, t, dmg, a);
    if (!a.foe) gainXp(s, a, 1.5);
  }

  TT.kill = function (s, e, by) {
    if (e.dead) return;
    e.dead = true;
    const def = TT.CREATURES[e.type];
    s.fx.push({ k: "puff", x: e.x, y: e.y, t: 0.5, d: 0.5, color: e.foe ? "#ffe0a0" : "#9a7ad8" });
    if (e.foe) {
      s.stats.kills++;
      const loot = def.loot || 0;
      if (loot) {
        const put = TT.addGold(s, loot);
        if (put > 0) s.fx.push({ k: "text", x: e.x, y: e.y - 0.4, text: "+" + put, color: "#ffd75e", t: 1.1, d: 1.1 });
      }
      if (def.boss) {
        TT.msg(s, "Der Lichtvogt ist gefallen! Die Oberwelt erzittert.", "good");
        if (!s.won) s.won = true;
        return;
      }
      // Gefangennahme, falls eine Kerkerzelle frei ist (nicht jeder überlebt seine Niederlage)
      if (Math.random() > B.captureChance) return;
      const used = {};
      for (const p of s.prisoners) used[p.idx] = 1;
      for (let i = 0; i < s.room.length; i++) {
        if (s.room[i] === ID.prison && !used[i]) {
          s.prisoners.push({ type: e.type, idx: i, t: 0, lvl: e.lvl });
          TT.msg(s, def.name + " wurde in den Kerker geworfen.", "info");
          break;
        }
      }
    } else {
      s.stats.lost++;
      TT.msg(s, def.name + (e.worker ? " wurde erschlagen." : " ist gefallen."), "bad");
      TT.sfx("death");
    }
  };

  // Gemeinsame Kampflogik für beide Seiten
  function fightStep(s, e, dt, def) {
    const tg = TT.byId(s, e.target);
    if (!tg || tg.dead || tg.held) { e.st = "idle"; e.target = 0; e.path = []; e.think = 0; e.nx = -1; return; }
    const d = Math.hypot(tg.x - e.x, tg.y - e.y);
    if (d <= def.range && (!def.ranged || d < 1.3 || TT.los(s, e.x, e.y, tg.x, tg.y))) {
      e.dir = tg.x >= e.x ? 1 : -1;
      if (e.cd <= 0) { e.cd = def.cd; attack(s, e, tg, def); }
      return;
    }
    e.rep -= dt;
    if (e.rep <= 0 || !e.path.length) {
      e.rep = 0.4;
      const fl = TT.flood(s, TT.tileOf(s, e), e.foe);
      const g = TT.tileOf(s, tg), dd = fl.dist[g];
      const far = e.foe ? 10 : (s._alarm ? 999 : 16);
      if (dd < 0 || dd > far) { e.st = "idle"; e.target = 0; e.path = []; e.think = 0.3; e.nx = -1; return; }
      e.path = TT.pathTo(fl, g);
    }
    followPath(s, e, dt, def);
  }

  /* ============================================================
     WÜHLER
     ============================================================ */
  function endJob(e) { e.job = null; e.st = "idle"; e.t = 0; e.think = 0.05; }

  function goDeliver(s, e, fl) {
    const W = s.W;
    let best = -1, bd = 1e9;
    for (let i = 0; i < s.room.length; i++) {
      if (s.room[i] === ID.treasury && fl.dist[i] >= 0 && fl.dist[i] < bd) { bd = fl.dist[i]; best = i; }
    }
    const nb = [1, -1, W, -W];
    for (let k = 0; k < 4; k++) {
      const a = s.coreIdx + nb[k];
      if (fl.dist[a] >= 0 && fl.dist[a] < bd) { bd = fl.dist[a]; best = a; }
    }
    if (best < 0) return false;
    e.job = { kind: "deliver", idx: -1 - e.id, at: best };
    e.path = TT.pathTo(fl, best); e.st = "goto";
    return true;
  }

  function findJob(s, e) {
    const W = s.W, tiles = s.tiles, mark = s.mark;
    const fl = TT.flood(s, TT.tileOf(s, e), false), dist = fl.dist;
    const full = s.gold >= TT.goldCap(s);
    if (e.carry >= B.carryMax && !full && goDeliver(s, e, fl)) return;

    // Was erledigen die anderen Wühler schon?
    const resv = {};
    for (const o of s.ents) if (o.worker && o !== e && o.job && !o.dead) resv[o.job.idx] = (resv[o.job.idx] || 0) + 1;

    let best = null, bc = 1e9;
    for (let i = W + 1, n = tiles.length - W - 1; i < n; i++) {
      const t = tiles[i];
      if (mark[i]) {
        if (t >= T.FLOOR) { mark[i] = 0; continue; }
        if (t === T.ROCK) { if (s.seen[i]) mark[i] = 0; continue; }
        const ore = t === T.GOLD || t === T.GEM;
        if (ore && (full || e.carry >= B.carryMax)) continue;
        if ((resv[i] || 0) >= 2) continue;
        for (let k = 0; k < 4; k++) {
          const a = i + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? W : -W), d = dist[a];
          if (d >= 0 && d < bc) { bc = d; best = { kind: "dig", idx: i, at: a }; }
        }
      } else if (t === T.FLOOR && dist[i] >= 0 && !resv[i]) {
        if (tiles[i + 1] === T.CLAIMED || tiles[i - 1] === T.CLAIMED || tiles[i + W] === T.CLAIMED || tiles[i - W] === T.CLAIMED) {
          const d = dist[i] + 2;
          if (d < bc) { bc = d; best = { kind: "claim", idx: i, at: i }; }
        }
      }
    }
    if (best) { e.job = best; e.path = TT.pathTo(fl, best.at); e.st = "goto"; return; }
    if (e.carry > 0 && !full && goDeliver(s, e, fl)) return;

    // Nichts zu tun: ein bisschen herumwuseln
    if (Math.random() < 0.2) {
      const me = TT.tileOf(s, e);
      const g = me + Math.round((Math.random() - 0.5) * 6) + Math.round((Math.random() - 0.5) * 6) * W;
      if (g > 0 && g < tiles.length && dist[g] >= 0 && tiles[g] === T.CLAIMED) { e.path = TT.pathTo(fl, g); e.st = "wander"; }
    }
  }

  function doWork(s, e, dt) {
    const j = e.job;
    if (!j) { endJob(e); return; }
    const i = j.idx;
    if (j.kind === "dig") {
      const t = s.tiles[i];
      if (!s.mark[i] || t >= T.FLOOR || t === T.ROCK) { endJob(e); return; }
      e.dir = (i % s.W) + 0.5 >= e.x ? 1 : -1;
      e.t += dt;
      if (t === T.EARTH) {
        s.dig[i] += dt;
        if (e.t >= 0.32) { e.t = 0; TT.sfx("dig"); }
        if (s.dig[i] >= B.digTime) { TT.openTile(s, i); endJob(e); }
      } else if (e.t >= B.swingT * (t === T.GEM ? 2 : 1)) {
        e.t = 0;
        TT.sfx("ore");
        if (t === T.GOLD) {
          const take = Math.min(B.goldSwing, s.ore[i]);
          s.ore[i] -= take; e.carry += take; s.stats.mined += take;
          if (s.ore[i] <= 0) TT.openTile(s, i);
        } else {
          e.carry += B.gemSwing; s.stats.mined += B.gemSwing;
        }
        if (e.carry >= B.carryMax || s.tiles[i] >= T.FLOOR) endJob(e);
      }
    } else if (j.kind === "claim") {
      if (s.tiles[i] !== T.FLOOR) { endJob(e); return; }
      e.t += dt;
      if (e.t >= B.claimTime) { TT.claimTile(s, i); TT.sfx("claim"); endJob(e); }
    } else {
      // Gold abliefern
      const put = TT.addGold(s, e.carry);
      if (put > 0) {
        e.carry -= put;
        s.fx.push({ k: "text", x: e.x, y: e.y - 0.4, text: "+" + put, color: "#ffd75e", t: 0.9, d: 0.9 });
        TT.sfx("coin");
      }
      endJob(e);
      if (e.carry > 0) e.think = 1.5;
    }
  }

  function updWorker(s, e, dt, def) {
    // Wühler schlafen nie – ihre Wunden heilen langsam von selbst
    if (e.hp < TT.maxHp(s, e)) e.hp = Math.min(TT.maxHp(s, e), e.hp + dt * 0.8);
    // Vor Eindringlingen davonlaufen
    e.rep -= dt;
    if (e.rep <= 0) {
      e.rep = 0.3;
      if (s._foes > 0) {
        let near = 99;
        for (const o of s.ents) if (o.foe && !o.dead) near = Math.min(near, Math.hypot(o.x - e.x, o.y - e.y));
        if (near < 3.5 && (e.st !== "flee" || !e.path.length)) {
          // Ein paar erreichbare Felder ausprobieren und das nehmen, das am weitesten von allen Feinden weg ist
          const me = TT.tileOf(s, e), fl = TT.flood(s, me, false);
          let best = -1, bs = -1;
          for (let k = 0; k < 14; k++) {
            const g = me + Math.round((Math.random() - 0.5) * 16) + Math.round((Math.random() - 0.5) * 16) * s.W;
            if (g <= 0 || g >= s.tiles.length || fl.dist[g] < 0) continue;
            const gx = (g % s.W) + 0.5, gy = ((g / s.W) | 0) + 0.5;
            let dn = 99;
            for (const o of s.ents) if (o.foe && !o.dead) dn = Math.min(dn, Math.hypot(o.x - gx, o.y - gy));
            if (dn > bs) { bs = dn; best = g; }
          }
          e.job = null; e.st = "flee"; e.path = best >= 0 ? TT.pathTo(fl, best) : [];
        } else if (e.st === "flee" && near > 6) endJob(e);
      } else if (e.st === "flee") endJob(e);
    }
    e.think -= dt;
    switch (e.st) {
      case "idle": if (e.think <= 0) { e.think = 0.35 + Math.random() * 0.25; findJob(s, e); } break;
      case "goto": if (followPath(s, e, dt, def)) { e.st = "work"; e.t = 0; } break;
      case "work": doWork(s, e, dt); break;
      case "wander": if (followPath(s, e, dt, def)) e.st = "idle"; break;
      case "flee": followPath(s, e, dt, def); break;
      default: e.st = "idle";
    }
  }

  /* ============================================================
     KÄMPFER DEINER HORDE
     ============================================================ */
  function assignHome(s, e) {
    const used = {};
    for (const o of s.ents) if (!o.foe && o.home >= 0 && !o.dead) used[o.home] = 1;
    for (let i = 0; i < s.room.length; i++) if (s.room[i] === ID.lair && !used[i]) { e.home = i; return; }
  }

  function go(s, e, fl, goal, act) {
    e.path = TT.pathTo(fl, goal); e.st = "walk"; e.act = act;
  }

  function pickRoomTile(s, fl, room) {
    let pick = -1, n = 0;
    for (let i = 0; i < s.room.length; i++) {
      if (s.room[i] === room && fl.dist[i] >= 0) { n++; if (Math.random() * n < 1) pick = i; }
    }
    return pick;
  }

  // Entscheidet, was ein Kämpfer als Nächstes tut. true = geht in den Kampf.
  function fighterThink(s, e, def) {
    const me = TT.tileOf(s, e);
    let fl = null;
    if (s._foes > 0) {
      fl = TT.flood(s, me, false);
      // Wer sich schwer verletzt zurückzieht, wehrt sich nur noch gegen Feinde direkt vor der Nase
      const resting = e.act === "sleep" && (e.st === "walk" || e.st === "act") && e.hp < TT.maxHp(s, e) * 0.6;
      let best = null, bd = (resting ? 2 : s._alarm ? 999 : 12) + 1;
      for (const o of s.ents) {
        if (!o.foe || o.dead) continue;
        const d = fl.dist[TT.tileOf(s, o)];
        if (d >= 0 && d < bd) { bd = d; best = o; }
      }
      if (best) { e.st = "fight"; e.target = best.id; e.path = []; e.rep = 0; return true; }
    }
    if (e.st === "leave") return false;

    // Kriegstrommel
    if (s.rally) {
      if (e.st !== "rally" || e.rallyId !== s.rally.id) {
        fl = fl || TT.flood(s, me, false);
        if (fl.dist[s.rally.idx] >= 0) { e.path = TT.pathTo(fl, s.rally.idx); e.st = "rally"; e.rallyId = s.rally.id; }
      }
      if (e.st === "rally") return false;
    } else if (e.st === "rally") e.st = "idle";

    if (e.st !== "idle") return false;
    fl = fl || TT.flood(s, me, false);
    if (e.home < 0) assignHome(s, e);

    // 1. Verletzt? Schlafen gehen (in ruhigen Zeiten schon bei leichten Wunden).
    if (e.hp < TT.maxHp(s, e) * (s._foes > 0 ? 0.45 : 0.8) && e.home >= 0 && fl.dist[e.home] >= 0) { go(s, e, fl, e.home, "sleep"); return false; }

    // 2. Hungrig? Zum nächsten Pilz.
    if (e.hunger > 60) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < s.room.length; i++) {
        if (s.room[i] === ID.garden && s.food[i] > 0 && fl.dist[i] >= 0 && fl.dist[i] < bd) { bd = fl.dist[i]; best = i; }
      }
      if (best >= 0) { go(s, e, fl, best, "eat"); return false; }
    }

    // 3. Arbeit je nach Kreaturenart
    const job = def.job || "train";
    let room = 0, act = "";
    if (job === "research" && s.research.cur) { room = ID.archive; act = "research"; }
    else if (job === "forge" && s.parts < B.partsCap && TT.unlocked(s, TT.ROOMS[ID.forge])) { room = ID.forge; act = "forge"; }
    if (room) {
      const i = pickRoomTile(s, fl, room);
      if (i >= 0) { go(s, e, fl, i, act); return false; }
    }
    if (e.lvl < B.trainCap) {
      const i = pickRoomTile(s, fl, ID.training);
      if (i >= 0) { go(s, e, fl, i, "train"); return false; }
    }

    // 4. Sonst: durchs Revier streifen
    const base = e.home >= 0 && Math.random() < 0.5 ? e.home : s.coreIdx;
    for (let tries = 0; tries < 6; tries++) {
      const g = base + Math.round((Math.random() - 0.5) * 10) + Math.round((Math.random() - 0.5) * 10) * s.W;
      if (g > 0 && g < s.tiles.length && fl.dist[g] > 0 && s.tiles[g] === T.CLAIMED) { go(s, e, fl, g, "wander"); break; }
    }
    return false;
  }

  function doAct(s, e, dt) {
    e.t -= dt;
    const i = TT.tileOf(s, e);
    switch (e.act) {
      case "sleep": {
        const mx = TT.maxHp(s, e);
        e.hp = Math.min(mx, e.hp + mx * 0.05 * dt);
        e.mood = Math.min(100, e.mood + dt * 0.4);
        if (e.hp >= mx) e.st = "idle";
        return;
      }
      case "eat":
        if (e.t <= 0) {
          if (s.food[i] > 0) { s.food[i]--; e.hunger = 0; e.mood = Math.min(100, e.mood + 6); TT.sfx("eat"); }
          e.st = "idle";
        }
        return;
      case "train":
        if (s.room[i] === ID.training && e.lvl < B.trainCap) gainXp(s, e, dt * 0.5); else e.t = 0;
        break;
      case "research":
        if (s.room[i] === ID.archive && s.research.cur) s.research.pts += dt * (0.8 + 0.2 * e.lvl); else e.t = 0;
        break;
      case "forge":
        if (s.room[i] === ID.forge) s.parts = Math.min(B.partsCap, s.parts + dt / 5 * (0.8 + 0.2 * e.lvl)); else e.t = 0;
        break;
    }
    if (e.t <= 0) e.st = "idle";
  }

  function updFighter(s, e, dt, def) {
    // Bedürfnisse
    e.hunger = Math.min(100, e.hunger + dt * 0.5);
    if (e.hunger >= 100) e.mood -= dt * 0.7;
    if (e.home >= 0 && s.room[e.home] !== ID.lair) e.home = -1;
    if (e.home < 0) e.mood -= dt * 0.25;
    else if (e.hunger < 100) e.mood = Math.min(100, e.mood + dt * 0.2);

    if (e.mood <= 0 && e.st !== "leave" && e.st !== "fight") {
      const fl = TT.flood(s, TT.tileOf(s, e), false), g = s.rift.idx;
      e.st = "leave"; e.path = fl.dist[g] >= 0 ? TT.pathTo(fl, g) : [];
      TT.msg(s, def.name + " hat genug und verlässt deinen Dungeon!", "bad");
    }
    if (e.st === "fight") {
      // Rückzug: schwer Verletzte schleppen sich in ihre Schlafhöhle, statt bis zum Tod zu kämpfen
      if (e.hp < TT.maxHp(s, e) * 0.25 && e.home >= 0 && TT.tileOf(s, e) !== e.home) {
        const fl = TT.flood(s, TT.tileOf(s, e), false);
        if (fl.dist[e.home] >= 0) { e.target = 0; go(s, e, fl, e.home, "sleep"); e.think = 0.6; return; }
      }
      fightStep(s, e, dt, def);
      return;
    }

    e.think -= dt;
    if (e.think <= 0) {
      e.think = 0.5 + Math.random() * 0.2;
      if (fighterThink(s, e, def)) return;
    }
    switch (e.st) {
      case "walk":
        if (followPath(s, e, dt, def)) {
          e.st = "act";
          e.t = e.act === "eat" ? 1.5 : e.act === "wander" ? 2 + Math.random() * 3 : 10 + Math.random() * 6;
        }
        break;
      case "act": doAct(s, e, dt); break;
      case "rally": followPath(s, e, dt, def); break;
      case "leave": if (followPath(s, e, dt, def)) { e.dead = true; e.gone = true; } break;
    }
  }

  /* ============================================================
     EINDRINGLINGE
     ============================================================ */
  function advance(s, e, dt, def) {
    const W = s.W;
    if (e.nx < 0) {
      const me = TT.tileOf(s, e), f = TT.foeField(s);
      let best = -1, bv = f[me];
      if (!(bv < Infinity)) bv = 1e9;
      for (let k = 0; k < 4; k++) {
        const a = me + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? W : -W);
        const v = f[a] + Math.random() * 0.3;
        if (v < bv) { bv = v; best = a; }
      }
      if (best < 0) return;
      e.nx = best; e.t = 0;
    }
    const a = e.nx, t = s.tiles[a];
    e.dir = (a % W) + 0.5 >= e.x ? 1 : -1;

    if (a === s.coreIdx) {                      // Herzkern angreifen
      if (e.cd <= 0) {
        e.cd = def.cd;
        TT.hitCore(s, def.dmg * (1 + 0.12 * (e.lvl - 1)));
        s.fx.push({ k: "hit", x: (a % W) + 0.5, y: ((a / W) | 0) + 0.5, t: 0.18, d: 0.18 });
      }
      return;
    }
    if (t === T.EARTH || t === T.GOLD) {        // sich durchgraben
      e.t += dt;
      s.dig[a] = Math.min(B.digTime * 0.95, B.digTime * e.t / (def.dig || 2.6));
      if (e.t >= (def.dig || 2.6)) { TT.openTile(s, a); s.seen[a] = 1; e.t = 0; TT.sfx("dig"); }
      return;
    }
    if (t < T.FLOOR) { e.nx = -1; return; }
    if (s.obj[a] === TT.OBJ.DOOR) {             // Tür einschlagen
      if (e.cd <= 0) {
        e.cd = def.cd;
        const tr = TT.trapAt(s, a);
        s.fx.push({ k: "hit", x: (a % W) + 0.5, y: ((a / W) | 0) + 0.5, t: 0.18, d: 0.18 });
        TT.sfx("hit");
        if (tr) {
          tr.hp -= def.dmg * (1 + 0.12 * (e.lvl - 1));
          if (tr.hp <= 0) { TT.removeTrap(s, a); TT.msg(s, "Eine Tür wurde eingeschlagen!", "bad"); }
        } else s.obj[a] = 0;
      }
      return;
    }
    if (moveToward(e, (a % W) + 0.5, ((a / W) | 0) + 0.5, speedOf(e, def) * dt)) e.nx = -1;
  }

  function updFoe(s, e, dt, def) {
    // Lichtpriester heilen Verbündete
    if (def.healer) {
      e.hcd -= dt;
      if (e.hcd <= 0) {
        e.hcd = 1;
        let best = null, br = 0.7;
        for (const o of s.ents) {
          if (!o.foe || o.dead || o === e) continue;
          const r = o.hp / TT.maxHp(s, o);
          if (r < br && Math.hypot(o.x - e.x, o.y - e.y) < 4.5) { br = r; best = o; }
        }
        if (best) {
          best.hp = Math.min(TT.maxHp(s, best), best.hp + 25);
          s.fx.push({ k: "ring", x: best.x, y: best.y, r: 0.7, color: "#fff3b0", t: 0.4, d: 0.4 });
          e.hcd = 4;
        }
      }
    }
    if (e.st === "fight") { fightStep(s, e, dt, def); return; }

    e.think -= dt;
    if (e.think <= 0) {
      e.think = 0.5 + Math.random() * 0.2;
      const fl = TT.flood(s, TT.tileOf(s, e), true);
      let best = null, bd = 9;
      for (const o of s.ents) {
        if (o.foe || o.dead || o.held) continue;
        if (Math.abs(o.x - e.x) > 8 || Math.abs(o.y - e.y) > 8) continue;
        const d = fl.dist[TT.tileOf(s, o)];
        if (d >= 0 && d < bd) { bd = d; best = o; }
      }
      if (best) { e.st = "fight"; e.target = best.id; e.path = []; e.rep = 0; e.nx = -1; return; }
    }
    advance(s, e, dt, def);
  }

  /* ---------- Haupt-Update pro Kreatur ---------- */
  TT.updateEnt = function (s, e, dt) {
    if (e.held || e.dead) return;
    if (e.cd > 0) e.cd -= dt;
    if (e.hurt > 0) e.hurt -= dt;
    if (e.haste > 0) e.haste -= dt;
    if (e.stun > 0) { e.stun -= dt; e.mv = false; return; }
    const def = TT.CREATURES[e.type], px = e.x, py = e.y;
    if (e.foe) updFoe(s, e, dt, def);
    else if (e.worker) updWorker(s, e, dt, def);
    else updFighter(s, e, dt, def);
    e.mv = e.x !== px || e.y !== py;
    const i = TT.tileOf(s, e);
    if (i !== e.lt) { e.lt = i; TT.reveal(s, i, e.foe ? 1 : 3); }
  };

  // Kurzbeschreibung für die Info-Anzeige
  TT.describe = function (s, e) {
    if (e.held) return "zappelt in deinem Griff";
    if (e.foe) return e.st === "fight" ? "kämpft" : "marschiert auf den Herzkern zu";
    if (e.worker) {
      if (e.st === "flee") return "flieht";
      if (e.job) return e.job.kind === "dig" ? "gräbt" : e.job.kind === "claim" ? "beansprucht Boden" : "trägt Gold heim";
      return e.carry > 0 ? "wartet auf Platz in der Schatzkammer" : "wartet auf Arbeit";
    }
    switch (e.st) {
      case "fight": return "kämpft";
      case "rally": return "folgt der Kriegstrommel";
      case "leave": return "verlässt den Dungeon";
      case "walk": case "act":
        return { sleep: "schläft sich gesund", eat: "frisst Pilze", train: "trainiert", research: "forscht",
          forge: "schmiedet", wander: "streift umher" }[e.act] || "unterwegs";
    }
    return "überlegt";
  };
})();
