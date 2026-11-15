"use strict";
/* Test der gemeinsamen Karte ohne Browser:  node tools/versustest.js
   Zwei Bots spielen gegeneinander. Nebenher läuft der Abgleich zum Gast genau so,
   wie er übers Netz liefe (inklusive JSON), und am Ende muss der Gast dasselbe sehen wie der Gastgeber. */
const path = require("path");
["config", "util", "map", "entities", "game", "campaign", "tutorial", "versus"].forEach(function (f) {
  require(path.join(__dirname, "..", "js", f + ".js"));
});
const TT = globalThis.TT, T = TT.T, ID = TT.ROOM_ID;
const quick = process.argv.indexOf("--kurz") >= 0;

let failures = 0;
function check(cond, text) { if (!cond) { failures++; console.log("  FEHLER: " + text); } }

function buildSome(s, key, count) {
  let n = 0;
  for (let i = 0; i < s.tiles.length && n < count; i++) {
    if (!TT.canBuildAt(s, i)) continue;
    const x = i % s.W, y = (i / s.W) | 0;
    n += TT.actBuild(s, ID[key], x, y, x, y).built;
  }
  return n;
}

function sane(s, label) {
  for (const e of s.ents) {
    check(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp), label + ": ungültige Werte bei " + e.type);
    check(e.held || s.tiles[TT.tileOf(s, e)] >= T.FLOOR, label + ": " + e.type + " steckt im Gestein (" + e.st + ")");
    check(e.foe || e.pl === 0 || e.pl === 1, label + ": Kreatur ohne Besitzer");
  }
}

for (const seed of quick ? [7] : [7, 42, 1234]) {
  console.log("Karte " + seed);
  const s = TT.newVersus(seed), W = s.W, H = s.H, n = W * H;

  // Fair: punktsymmetrisch
  let asym = 0;
  for (let i = 0; i < n; i++) if (s.tiles[i] !== s.tiles[n - 1 - i] || s.ore[i] !== s.ore[n - 1 - i]) asym++;
  check(asym === 0, "Karte nicht symmetrisch (" + asym + " Felder)");
  check(s.pl[0].coreIdx === n - 1 - s.pl[1].coreIdx, "Herzkerne nicht gespiegelt");
  check(s.ents.filter((e) => e.pl === 0).length === 4 && s.ents.filter((e) => e.pl === 1).length === 4, "Startwühler falsch verteilt");

  // Zwischen den Kernen darf kein Urfels alles versperren
  s._ff = null;
  const f = TT.inCtx(s, 0, () => TT.foeField(s));
  check(f[s.pl[1].coreIdx + 1] < Infinity || f[s.pl[1].coreIdx - 1] < Infinity, "kein grabbarer Weg zwischen den Herzkernen");
  s._ff = null;

  // Gast verbindet sich
  const hs = TT.syncHost(s, 1);
  let g = TT.guestState(JSON.parse(JSON.stringify(TT.syncFull(s))), 1);
  let bytes = 0, packets = 0;
  function sync() {
    const d = TT.syncDelta(s, hs), txt = JSON.stringify(d);
    bytes += txt.length; packets++;
    TT.guestApply(g, JSON.parse(txt));
    TT.guestTick(g, 0.1);
  }

  const cores = [s.pl[0].coreIdx, s.pl[1].coreIdx], rifts = [s.pl[0].rift.idx, s.pl[1].rift.idx];
  const xy = (i) => [i % W, (i / W) | 0];
  let siegeTicks = 0;
  function run(sec, each) {
    for (let t = 0; t < sec && !s.over; t += 0.05) {
      TT.update(s, 0.05);
      for (const e of s.ents) if (e.st === "siege") { siegeTicks++; break; }
      if (Math.round(t * 20) % 2 === 0) sync();
      if (each && Math.round(t * 20) % 400 === 0) each();
    }
  }

  // 1. Beide graben ihr Revier und einen Gang zum Riss (Spieler 1 ausschließlich über den Gast-Befehlsweg)
  for (let k = 0; k < 2; k++) {
    const c = xy(cores[k]), r = xy(rifts[k]);
    const m1 = [c[0] - 7, c[1] - 6, c[0] + 7, c[1] + 6, true], m2 = [Math.min(c[0], r[0]) - 1, Math.min(c[1], r[1]) - 1, Math.max(c[0], r[0]) + 1, Math.max(c[1], r[1]) + 1, true];
    TT.versusAct(s, k, "actMark", m1); TT.versusAct(s, k, "actMark", m2);
  }
  check(TT.versusAct(s, 1, "constructor", []) === null && TT.versusAct(s, 1, "actMark", [1, 2]) === null, "unerlaubter Befehl wurde angenommen");
  run(240);
  for (let k = 0; k < 2; k++) {
    const P = k === s.me ? s : s.pl[k];
    check(P.rift.on, "Spieler " + (k + 1) + ": Riss nicht beansprucht");
    check(P._claimed > 50, "Spieler " + (k + 1) + ": zu wenig Boden (" + P._claimed + ")");
  }
  sane(s, "nach dem Graben");

  // 2. Räume bauen (Spieler 2 über den Befehlsweg des Gastes)
  for (let k = 0; k < 2; k++) {
    TT.inCtx(s, k, () => { s.gold += 6000; });
    TT.inCtx(s, k, () => {
      check(buildSome(s, "treasury", 6) === 6, "Spieler " + (k + 1) + ": Schatzkammer nicht gebaut");
      check(buildSome(s, "lair", 12) === 12, "Spieler " + (k + 1) + ": Schlafhöhle nicht gebaut");
      check(buildSome(s, "garden", 8) === 8, "Spieler " + (k + 1) + ": Pilzgarten nicht gebaut");
      check(buildSome(s, "training", 9) === 9, "Spieler " + (k + 1) + ": Übungshalle nicht gebaut");
    });
  }
  // Gegenprobe: auf fremdem Boden darf man nicht bauen
  const ec = xy(cores[0]);
  const r = TT.versusAct(s, 1, "actBuild", [ID.lair, ec[0] - 2, ec[1] - 2, ec[0] + 2, ec[1] + 2]);
  check(r && r.built === 0, "Spieler 2 konnte auf dem Boden von Spieler 1 bauen");
  run(300);
  sane(s, "nach dem Aufbau");
  const horde = [0, 1].map((k) => s.ents.filter((e) => e.pl === k && !e.worker).length);
  check(horde[0] >= 5 && horde[1] >= 5, "zu wenige Kreaturen: " + horde.join(" / "));
  console.log("  Kreaturen " + horde.join(" / ") + ", Boden " + [0, 1].map((k) => TT.inCtx(s, k, () => s._claimed)).join(" / "));

  // 3. Krieg: beide graben zur Mitte und werfen ihre Kämpfer an die Front
  for (let k = 0; k < 2; k++) {
    const c = xy(cores[k]), cy = c[1];
    TT.versusAct(s, k, "actMark", [Math.min(c[0], W / 2), cy - 1, Math.max(c[0], W / 2 - 1), cy + 1, true]);
    const o = xy(cores[1 - k]);
    TT.versusAct(s, k, "actMark", [Math.min(W / 2 - 1, o[0]), cy - 1, Math.max(W / 2, o[0]), cy + 1, true]);
  }
  let drops = 0, sieges = 0, convert = 0;
  run(quick ? 900 : 1800, function () {
    for (let k = 0; k < 2; k++) {
      TT.inCtx(s, k, function () {
        s.gold = TT.clamp(s.gold, 800, TT.goldCap(s) * 0.6);        // Lager nie ganz voll, sonst bleiben Goldadern im Weg liegen
        const oc = cores[1 - k], ox = oc % W + 0.5, oy = ((oc / W) | 0) + 0.5;
        // eigenes Feld, das dem feindlichen Kern am nächsten liegt
        let best = -1, bd = 1e9;
        for (let i = 0; i < n; i++) if (TT.mine(s, i) && !TT.isSpecial(s, i)) { const d = Math.hypot(i % W + 0.5 - ox, ((i / W) | 0) + 0.5 - oy); if (d < bd) { bd = d; best = i; } }
        for (const e of s.ents) {
          if (TT.heldCount(s) >= TT.BAL.maxHeld) break;
          if (e.pl === k && !e.worker && !e.held && e.st !== "fight" && e.st !== "siege" && e.hp > TT.maxHp(s, e) * 0.6) TT.actGrab(s, e.id);
        }
        while (TT.heldCount(s) > 0 && best >= 0) { if (!TT.actDrop(s, best).ok) break; drops++; }
        for (const e of s.ents) if (e.pl === k && e.st === "siege") sieges++;
      });
    }
    for (let i = 0; i < n; i++) if (s.own[i] && s.own[i] !== (i % W < W / 2 ? 1 : 2)) convert++;
  });
  sane(s, "nach dem Krieg");
  const lost = [0, 1].map((k) => TT.inCtx(s, k, () => s.stats.lost));
  console.log("  " + Math.round(s.time / 60) + " min: " + (s.over ? "Spieler " + (s.winner + 1) + " gewinnt" : "noch kein Sieger") +
    ", Kerne " + [0, 1].map((k) => Math.round(TT.inCtx(s, k, () => s.coreHp))).join(" / ") + ", gefallen " + lost.join(" / ") +
    ", Würfe " + drops + ", Belagerungsschritte " + sieges + ", übernommene Felder (Summe) " + convert);
  check(lost[0] + lost[1] > 0, "es wurde nie gekämpft");
  check(siegeTicks > 0, "kein Kämpfer ist je auf einen Herzkern losgegangen");

  // 4. Der Gast sieht dasselbe wie der Gastgeber
  for (let k = 0; k < 3; k++) sync();
  const P1 = s.pl[1];
  TT.syncPl(s);
  let bad = 0;
  ["tiles", "room", "own", "obj", "ore"].forEach(function (a) { for (let i = 0; i < n; i++) if (g[a][i] !== s[a][i]) bad++; });
  for (let i = 0; i < n; i++) if (g.seen[i] !== P1.seen[i] || g.mark[i] !== P1.mark[i]) bad++;
  check(bad === 0, "Gast weicht bei " + bad + " Feldern ab");
  check(g.ents.length === s.ents.length, "Gast kennt " + g.ents.length + " statt " + s.ents.length + " Kreaturen");
  const hostE = new Map(s.ents.map((e) => [e.id, e]));
  let far = 0;
  for (const e of g.ents) { const h = hostE.get(e.id); if (!h || Math.abs(h.x - e._tx) > 0.02 || h.st !== e.st || h.pl !== e.pl) far++; }
  check(far === 0, far + " Kreaturen weichen beim Gast ab");
  check(Math.abs(g.gold - P1.gold) < 0.02 && g.over === s.over && g.coreIdx === P1.coreIdx, "Werte des Gastes weichen ab");
  check(g.msgs.length > 0, "Gast bekam keine Meldungen");
  console.log("  Abgleich: " + packets + " Pakete, im Schnitt " + Math.round(bytes / packets) + " Zeichen, " +
    Math.round(bytes / (s.time) / 1024 * 10) / 10 + " KB/s");
}

console.log(failures ? "\n" + failures + " Fehler gefunden." : "\nAlle Prüfungen bestanden.");
process.exit(failures ? 1 : 0);
