"use strict";
/* Test der Kampagne ohne Browser:  node tools/campaigntest.js [--bot] [gebiete, z. B. 1,4,8]
   Prüft für jedes Gebiet die Karte (Siegelsteine, Wachen, Wege) und den Ablauf Siegel -> Endboss -> Sieg.
   Mit --bot spielt zusätzlich ein einfacher Bot jedes Gebiet im Zeitraffer, um die Schwierigkeit abzuschätzen. */
const path = require("path");
["config", "util", "map", "entities", "game", "campaign", "tutorial"].forEach(function (f) { require(path.join(__dirname, "..", "js", f + ".js")); });
const TT = globalThis.TT, T = TT.T, ID = TT.ROOM_ID;
const args = process.argv.slice(2), bot = args.indexOf("--bot") >= 0;
const only = (args.find(function (a) { return /^[\d,]+$/.test(a); }) || "").split(",").filter(Boolean).map(Number);

let failures = 0;
function check(c, t) { if (!c) { failures++; console.log("  FEHLER: " + t); } }
function run(s, sec) { for (let t = 0; t < sec && !s.over && !s.won; t += 0.05) TT.update(s, 0.05); }

// Erreichbar durch Graben = verbunden über alles außer Urfels
function diggable(s, from) {
  const seen = new Uint8Array(s.tiles.length), q = [from];
  seen[from] = 1;
  while (q.length) {
    const c = q.pop();
    for (const d of [1, -1, s.W, -s.W]) {
      const a = c + d;
      if (a < 0 || a >= s.tiles.length || seen[a] || s.tiles[a] === T.ROCK) continue;
      seen[a] = 1; q.push(a);
    }
  }
  return seen;
}

TT.CAMPAIGN.forEach(function (L, li) {
  if (only.length && only.indexOf(li + 1) < 0) return;
  console.log("Gebiet " + (li + 1) + ": " + L.name + " (" + L.W + " x " + L.H + ")");
  const s = TT.startLevel(li);
  check(s.W === L.W && s.H === L.H, "Kartengröße");
  check(s.seals.length === L.seals, "Siegelsteine " + s.seals.length + " statt " + L.seals);
  const guards = s.ents.filter(function (e) { return e.guard; });
  check(guards.length === L.seals * L.guards.length, "Wachen " + guards.length);
  guards.forEach(function (e) { check(s.tiles[TT.tileOf(s, e)] >= T.FLOOR, "Wache im Fels"); });
  const reach = diggable(s, s.coreIdx + 1);
  s.seals.forEach(function (q) { check(reach[q.idx], "Siegelstein nicht erreichbar"); });
  check(reach[s.rift.idx], "Riss nicht erreichbar");
  const f = TT.foeField(s);
  s.shafts.forEach(function (sh) { check(f[sh] < Infinity, "Schacht ohne Weg zum Kern"); });
  check(s.shafts.length === L.shafts, "Schächte " + s.shafts.length);
  // Freigaben
  check(TT.unlocked(s, TT.ROOMS[ID.lair]), "Schlafhöhle gesperrt");
  check(TT.unlocked(s, TT.ROOMS[ID.archive]) === (L.allow.indexOf("archive") >= 0), "Archiv-Freigabe");

  // Ablauf: alle Siegel erzwingen -> Boss kommt -> Boss besiegen -> Sieg
  const t = TT.deserialize(TT.serialize(s));
  t.seals.forEach(function (q) { TT.claimTile(t, q.idx); });
  t.ents = t.ents.filter(function (e) { return !e.guard; });
  t.waveT = 1e9;
  run(t, 1);
  check(t.bossPhase === 1, "Bossphase startet nicht");
  run(t, 21);
  const boss = t.ents.find(function (e) { return e.boss; });
  check(!!boss && boss.name === L.boss.name, "Boss erscheint nicht");
  if (boss) {
    check(t.ents.filter(function (e) { return e.foe && !e.boss; }).length === L.boss.escort.length, "Begleiter");
    console.log("  Boss: " + boss.name + ", " + Math.round(boss.hp) + " Leben, Stufe " + boss.lvl);
    TT.damage(t, boss, 1e9, null);
    check(t.won, "Sieg nach Bosstod");
    const st = TT.starsFor(t);
    check(st.n >= 1, "Sterne");
  }

  if (!bot) return;
  /* ---- Bot: gräbt, baut, stößt zu den Siegelsteinen vor ---- */
  const W = s.W, cx = s.coreIdx % W, cy = (s.coreIdx / W) | 0, rx = s.rift.idx % W, ry = (s.rift.idx / W) | 0;
  TT.actMark(s, cx - 8, cy - 6, cx + 8, cy + 6, true);
  TT.actMark(s, Math.min(cx, rx) - 1, Math.min(cy, ry) - 1, Math.max(cx, rx) + 1, Math.max(cy, ry) + 1, true);
  const want = { lair: 16, garden: 9, treasury: 9, training: 12, archive: 9, forge: 6, prison: 6 };
  const have = {};
  let sealsMarked = false, log = [];
  function build(key, count) {
    let n = 0;
    for (let i = 0; i < s.tiles.length && n < count; i++) {
      if (!TT.canBuildAt(s, i)) continue;
      const x = i % W, y = (i / W) | 0;
      if (Math.abs(x - cx) < 3 && Math.abs(y - cy) < 3) continue;
      n += TT.actBuild(s, ID[key], x, y, x, y).built;
    }
    return n;
  }
  let last = -1;
  while (!s.over && !s.won && s.time < 3 * 3600) {
    run(s, 10);
    for (const k of ["lair", "garden", "treasury", "training", "archive", "forge", "prison"]) {
      if (!TT.unlocked(s, TT.ROOMS[ID[k]])) continue;
      const need = want[k] - (have[k] || 0);
      if (need > 0 && s.gold > TT.ROOMS[ID[k]].cost * 3 + 150) have[k] = (have[k] || 0) + build(k, Math.min(3, need));
    }
    if (Math.floor(s.time / 60) % 2 === 0) for (let i = 0; i < s.tiles.length; i++) if (s.seen[i] && s.tiles[i] === T.GOLD) s.mark[i] = 1;
    // Sobald die Horde steht: Gänge zu allen Siegelsteinen graben (L-förmig)
    const c = TT.countOwn(s);
    if (!sealsMarked && c.fighters >= 10) {
      sealsMarked = true;
      s.seals.forEach(function (q) {
        const x = q.idx % W, y = (q.idx / W) | 0;
        // dieselbe Strecke, die der Kartengenerator frei von Urfels hält: erst waagerecht auf Höhe des Steins, dann senkrecht
        TT.actMark(s, Math.min(cx, x), y, Math.max(cx, x), y, true);
        TT.actMark(s, cx, Math.min(cy, y), cx, Math.max(cy, y), true);
      });
      log.push("Vorstoß zu den Siegeln ab " + Math.round(s.time / 60) + " min");
    }
    // Gefallene Wühler ersetzen
    if (c.workers < 5) TT.actSpell(s, "worker", s.coreIdx);
    // Wie ein Spieler: gesunde Kämpfer greifen und neben dem nächsten Siegelstein absetzen
    if (sealsMarked && Math.floor(s.time / 10) % 3 === 0) {
      const target = s.seals.find(function (q) { return !q.taken; });
      if (target) {
        const sx = target.idx % W, sy = (target.idx / W) | 0;
        let best = -1, bd = 11;
        for (let i = 0; i < s.tiles.length; i++) {
          if (s.tiles[i] !== T.CLAIMED) continue;
          const d = Math.hypot((i % W) - sx, ((i / W) | 0) - sy);
          if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) {
          const ready = s.ents.filter(function (e) { return !e.foe && !e.worker && !e.held && !e.dead && e.hp > TT.maxHp(s, e) * 0.7 && e.st !== "fight"; }).slice(0, 6);
          ready.forEach(function (e) { TT.actGrab(s, e.id); });
          ready.forEach(function () { TT.actDrop(s, best); });
        }
      }
    }
    const taken = s.seals.filter(function (q) { return q.taken; }).length;
    if (taken !== last) { last = taken; log.push(taken + "/" + s.seals.length + " Siegel @" + Math.round(s.time / 60) + " min, Kämpfer " + c.fighters + ", Überfall " + s.waveN); }
  }
  const st = TT.starsFor(s);
  console.log("  BOT: " + (s.won ? "GEWONNEN nach " + Math.round(s.time / 60) + " min, " + st.n + " Sterne" : s.over ? "VERLOREN nach " + Math.round(s.time / 60) + " min" : "nach 3 h nicht fertig") +
    " | Kern min " + Math.round(s.coreLow) + ", verloren " + s.stats.lost + ", besiegt " + s.stats.kills + ", Überfälle " + s.waveN);
  log.forEach(function (l) { console.log("     " + l); });
  // Zustand jedes Siegelsteins am Ende – zeigt, woran der Vorstoß gescheitert ist
  s.seals.forEach(function (q, k) {
    const x = q.idx % W, y = (q.idx / W) | 0;
    let near = 99, marks = 0;
    for (let i = 0; i < s.tiles.length; i++) {
      const d = Math.hypot((i % W) - x, ((i / W) | 0) - y);
      if (s.tiles[i] === T.CLAIMED) near = Math.min(near, d);
      if (s.mark[i] && d < 40) marks++;
    }
    const g = s.ents.filter(function (e) { return e.guard && e.post === q.idx && !e.dead; }).length;
    console.log("     Siegel " + (k + 1) + " @" + x + "," + y + ": " + (q.taken ? "gebrochen" : "offen") + ", Wachen " + g +
      ", nächster eigener Boden " + near.toFixed(1) + " Felder, offene Markierungen " + marks);
  });
});

console.log(failures ? "\n" + failures + " Fehler gefunden." : "\nAlle Kampagnen-Prüfungen bestanden.");
process.exit(failures ? 1 : 0);
