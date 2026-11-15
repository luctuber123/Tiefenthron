"use strict";
/* Schnelltest der Spiellogik ohne Browser:  node tools/simtest.js
   Spielt mehrere Partien im Zeitraffer durch und prüft, ob alles plausibel bleibt. */
const path = require("path");
["config", "util", "map", "entities", "game"].forEach(function (f) {
  require(path.join(__dirname, "..", "js", f + ".js"));
});
const TT = globalThis.TT, T = TT.T, ID = TT.ROOM_ID;

let failures = 0;
function check(cond, text) {
  if (!cond) { failures++; console.log("  FEHLER: " + text); }
}
function run(s, seconds) {
  for (let t = 0; t < seconds; t += 0.05) TT.update(s, 0.05);
}
function sane(s, label) {
  for (const e of s.ents) {
    check(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp), label + ": ungültige Werte bei " + e.type);
    const i = TT.tileOf(s, e);
    check(e.held || s.tiles[i] >= T.FLOOR, label + ": " + e.type + " steckt im Gestein (" + e.st + ")");
  }
  check(Number.isFinite(s.gold) && s.gold >= 0, label + ": Gold ungültig " + s.gold);
  check(Number.isFinite(s.ess), label + ": Essenz ungültig");
}
// Baut einen Raum aus den ersten freien, beanspruchten Feldern
function buildSome(s, key, count) {
  let n = 0;
  for (let i = 0; i < s.tiles.length && n < count; i++) {
    if (!TT.canBuildAt(s, i)) continue;
    const x = i % s.W, y = (i / s.W) | 0;
    n += TT.actBuild(s, ID[key], x, y, x, y).built;
  }
  return n;
}

for (const seed of [1, 7, 42, 1234, 99999]) {
  console.log("Karte " + seed);
  const s = TT.newGame(seed);
  const W = s.W, cx = s.coreIdx % W, cy = (s.coreIdx / W) | 0;
  const rx = s.rift.idx % W, ry = (s.rift.idx / W) | 0;

  // Eindringlinge müssen von jedem Schacht aus einen Weg zum Kern haben
  const f = TT.foeField(s);
  s.shafts.forEach(function (sh) { check(f[sh] < Infinity, "Schacht ohne Weg zum Kern"); });

  // 1. Großen Bereich um den Kern und einen Gang zum Riss markieren
  TT.actMark(s, cx - 8, cy - 7, cx + 8, cy + 7, true);
  TT.actMark(s, Math.min(cx, rx) - 1, Math.min(cy, ry) - 1, Math.max(cx, rx) + 1, Math.max(cy, ry) + 1, true);
  run(s, 240);
  sane(s, "nach dem Graben");
  check(s._claimed > 60, "zu wenig beanspruchter Boden: " + s._claimed);
  check(s.stats.mined > 0, "kein Gold abgebaut");
  check(s.rift.on, "Riss wurde nicht beansprucht");
  console.log("  Boden " + s._claimed + ", Gold " + Math.round(s.gold) + ", abgebaut " + s.stats.mined + ", Riss " + s.rift.on);

  // 2. Räume bauen, Kreaturen sollen kommen
  s.gold += 5000;                       // Testgeld
  check(buildSome(s, "treasury", 6) === 6, "Schatzkammer nicht gebaut");
  check(buildSome(s, "lair", 12) === 12, "Schlafhöhle nicht gebaut");
  check(buildSome(s, "garden", 8) === 8, "Pilzgarten nicht gebaut");
  check(buildSome(s, "training", 9) === 9, "Übungshalle nicht gebaut");
  check(buildSome(s, "archive", 6) === 6, "Archiv nicht gebaut");
  s.waveT = 9999;                       // erst in Ruhe wachsen lassen
  run(s, 260);
  sane(s, "nach dem Aufbau");
  let c = TT.countOwn(s);
  check(c.fighters >= 6, "zu wenige Kreaturen angelockt: " + c.fighters);
  check(Object.keys(s.research.done).length >= 1, "keine Forschung abgeschlossen");
  const types = {};
  for (const e of s.ents) types[e.type] = (types[e.type] || 0) + 1;
  console.log("  Horde: " + JSON.stringify(types) + ", erforscht: " + Object.keys(s.research.done).join(","));

  // 3. Zauber
  s.ess = 600;
  check(TT.actSpell(s, "worker", s.coreIdx).ok, "Wühler rufen schlug fehl");
  check(TT.actSpell(s, "eye", 5 * W + 5).ok, "Erdauge schlug fehl");
  check(s.seen[5 * W + 5] === 1, "Erdauge deckt nichts auf");

  // 4. Greifen und Absetzen
  const fighter = s.ents.find(function (e) { return !e.foe && !e.worker; });
  check(TT.actGrab(s, fighter.id), "Greifen schlug fehl");
  check(TT.actDrop(s, s.coreIdx + 1).ok, "Absetzen schlug fehl");

  // 5. Speichern und Laden mitten im Spiel
  const s2 = TT.deserialize(TT.serialize(s));
  check(s2.ents.length === s.ents.length, "Spielstand verliert Kreaturen");

  // 6. Überfälle
  for (let w = 0; w < 4; w++) {
    s2.waveT = 1;
    run(s2, 110);
    sane(s2, "Überfall " + s2.waveN);
  }
  c = TT.countOwn(s2);
  check(s2.stats.kills > 0, "kein einziger Eindringling besiegt");
  console.log("  nach 4 Überfällen: besiegt " + s2.stats.kills + ", verloren " + s2.stats.lost + ", Kern " +
    Math.round(s2.coreHp) + ", Kämpfer " + c.fighters + ", Eindringlinge übrig " + c.foes + (s2.over ? " (NIEDERLAGE)" : ""));

  // 7. Ohne Verteidigung muss der Kern fallen können
  const s3 = TT.newGame(seed + 1);
  s3.ents = s3.ents.filter(function (e) { return false; });
  s3.waveN = 8; s3.waveT = 1;
  run(s3, 600);
  check(s3.over, "wehrloser Kern überlebt 10 Minuten Belagerung (Kern " + Math.round(s3.coreHp) + ")");
}

console.log(failures ? "\n" + failures + " Fehler gefunden." : "\nAlle Prüfungen bestanden.");
process.exit(failures ? 1 : 0);
