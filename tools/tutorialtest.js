"use strict";
/* Spielt das Tutorial ohne Browser von vorn bis hinten durch:  node tools/tutorialtest.js
   Erledigt jeden Schritt so, wie ein Spieler es tun würde, und prüft, dass das Tutorial weiterschaltet. */
const path = require("path");
["config", "util", "map", "entities", "game", "campaign", "tutorial"].forEach(function (f) { require(path.join(__dirname, "..", "js", f + ".js")); });
const G = globalThis.TT, T = G.T, ID = G.ROOM_ID;

const s = G.startLevel(-1), W = s.W, cx = s.coreIdx % W, cy = (s.coreIdx / W) | 0;
const ui = { view: { cx: cx + 0.5, cy: cy + 0.5, zoom: 36, yaw: 0 } };
let failures = 0;
const check = function (c, t) { if (!c) { failures++; console.log("  FEHLER: " + t); } };
const tick = function () { return G.tutTick(s, ui); };
function run(sec) { for (let t = 0; t < sec && !s.over; t += 0.05) { G.update(s, 0.05); if (Math.round(t * 20) % 10 === 0) tick(); } }
function build(key, n) {
  for (let i = 0, b = 0; i < s.tiles.length && b < n; i++) {
    const x = i % W, y = (i / W) | 0;
    if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) continue;
    if (G.canBuildAt(s, i)) b += G.actBuild(s, ID[key], x, y, x, y).built;
  }
}
function step() { return s.tut ? s.tut.step : 0; }
function expect(n, what) { tick(); check(step() >= n, "Schritt " + n + " (" + what + ") nicht erreicht, steht bei " + step()); console.log("  Schritt " + step() + " erreicht nach " + Math.round(s.time) + " s: " + what); }

check(s.seals.length === 1, "Siegelstein fehlt"); check(G.countOwn(s).guards === 1, "Wache fehlt");
tick(); check(step() === 0, "Start nicht bei Schritt 0");
ui.view.cx += 3; expect(1, "Kamera bewegt");
const rx = s.rift.idx % W, ry = (s.rift.idx / W) | 0;
G.actMark(s, Math.min(cx, rx) - 1, Math.min(cy, ry) - 1, Math.max(cx, rx) + 1, Math.max(cy, ry) + 1, true); expect(2, "gegraben");
for (let k = 0; k < 40 && !s.rift.on; k++) run(5);
expect(3, "Riss erobert");
G.actMark(s, cx - 6, cy - 5, cx + 6, cy + 5, true); run(60);
build("lair", 6); expect(4, "Schlafhöhle");
build("garden", 4); expect(5, "Pilzgarten");
for (let i = 0; i < s.tiles.length; i++) if (s.seen[i] && s.tiles[i] === T.GOLD) s.mark[i] = 1;
build("treasury", 2);
for (let k = 0; k < 40 && s.stats.mined === 0; k++) run(5);
expect(6, "Gold und Schatzkammer");
for (let k = 0; k < 40 && G.countOwn(s).fighters < 1; k++) run(2);
expect(7, "erste Kreatur");
const f = s.ents.find(function (e) { return !e.foe && !e.worker; });
G.actGrab(s, f.id); G.actDrop(s, s.coreIdx + 1); expect(8, "Griff benutzt");
for (let k = 0; k < 60 && !(s.waveN >= 1 && G.countOwn(s).foes === 0); k++) run(5);
expect(9, "Spähtrupp abgewehrt");
const q = s.seals[0], sx = q.idx % W, sy = (q.idx / W) | 0;
G.actMark(s, Math.min(cx, sx), sy, Math.max(cx, sx), sy, true);
G.actMark(s, cx, Math.min(cy, sy), cx, Math.max(cy, sy), true);
for (let k = 0; k < 120 && !q.taken; k++) {
  run(5);
  let best = -1, bd = 11;
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i] === T.CLAIMED) { const d = Math.hypot((i % W) - sx, ((i / W) | 0) - sy); if (d < bd) { bd = d; best = i; } }
  if (best >= 0 && k % 4 === 0) s.ents.filter(function (e) { return !e.foe && !e.worker && !e.held && e.st !== "fight"; }).forEach(function (e) { if (G.actGrab(s, e.id)) G.actDrop(s, best); });
}
expect(10, "Siegelstein gebrochen");
for (let k = 0; k < 120 && !s.won; k++) run(5);
tick();
check(s.won, "Späherführer nicht besiegt");
check(step() === G.TUT_STEPS.length, "Tutorial nicht vollständig: Schritt " + step());
console.log("  Ende nach " + Math.round(s.time / 60) + " min Spielzeit, Herzkern " + Math.round(s.coreHp) + ", Sterne " + G.starsFor(s).n);
console.log(failures ? "\n" + failures + " Fehler gefunden." : "\nTutorial komplett durchspielbar.");
process.exit(failures ? 1 : 0);
