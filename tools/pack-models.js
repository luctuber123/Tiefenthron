"use strict";
/* Verkleinert eine GLB-Modelldatei und bettet sie als Skript ins Spiel ein.

   Aufruf:
     node tools/pack-models.js <eingabe.glb> <name> [--keep Idle,Walk,...] [--drop-bones IK,control] [--drop-scale]

   Ergebnis: assets/models/<name>.js  (setzt TT_MODELS["<name>"] auf die Datei als Base64-Text)

   Warum als Skript? Ein Browser darf beim Start per Doppelklick keine lokalen Dateien nachladen,
   Skripte aus <script>-Tags aber schon. So läuft das Spiel weiter ohne Webserver.

   --keep        nur diese Animationen behalten (alle anderen samt ihrer Daten fliegen raus)
   --drop-bones  Animationsspuren für Knochen weglassen, deren Name einen dieser Texte enthält
   --drop-scale  Skalierungsspuren weglassen (bei Figuren, die nie gestaucht werden) */
const fs = require("fs"), path = require("path");

const args = process.argv.slice(2);
if (args.length < 2) { console.log("Aufruf: node tools/pack-models.js <eingabe.glb> <name> [--keep A,B] [--drop-bones X,Y] [--drop-scale]"); process.exit(1); }
const input = args[0], name = args[1];
const opt = { keep: [], dropBones: [], dropScale: false };
for (let i = 2; i < args.length; i++) {
  if (args[i] === "--keep") opt.keep = args[++i].split(",").filter(Boolean);
  else if (args[i] === "--drop-bones") opt.dropBones = args[++i].split(",").filter(Boolean);
  else if (args[i] === "--drop-scale") opt.dropScale = true;
  else { console.log("Unbekannte Option: " + args[i]); process.exit(1); }
}

/* ---------- GLB lesen ---------- */
const buf = fs.readFileSync(input);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(input + " ist keine GLB-Datei");
let g = null, bin = Buffer.alloc(0);
for (let off = 12; off < buf.length;) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.slice(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) g = JSON.parse(data.toString("utf8"));
  else if (type === 0x004e4942) bin = data;
  off += 8 + len;
}
if ((g.buffers || []).length > 1 || (g.buffers && g.buffers[0] && g.buffers[0].uri)) throw new Error("nur GLB mit einem eingebetteten Puffer wird unterstützt");

/* ---------- Animationen ausdünnen ---------- */
const found = [];
g.animations = (g.animations || []).filter(function (a) {
  a.name = (a.name || "").replace(/^.*\|/, "");            // "CharacterArmature|Idle" -> "Idle"
  return !opt.keep.length || opt.keep.indexOf(a.name) >= 0;
});
g.animations.forEach(function (a) {
  found.push(a.name);
  a.channels = a.channels.filter(function (c) {
    const node = g.nodes[c.target.node];
    if (!node) return false;
    if (opt.dropScale && c.target.path === "scale") return false;
    return !opt.dropBones.some(function (p) { return (node.name || "").indexOf(p) >= 0; });
  });
  const used = Array.from(new Set(a.channels.map(function (c) { return c.sampler; })));
  const map = new Map(used.map(function (o, n) { return [o, n]; }));
  a.samplers = used.map(function (o) { return a.samplers[o]; });
  a.channels.forEach(function (c) { c.sampler = map.get(c.sampler); });
});
opt.keep.forEach(function (k) { if (found.indexOf(k) < 0) console.log("  Hinweis: Animation \"" + k + "\" gibt es in dieser Datei nicht."); });
if (!g.animations.length) delete g.animations;

/* ---------- Nur noch benötigte Daten behalten ---------- */
const usedAcc = new Set();
const use = function (i) { if (i !== undefined) usedAcc.add(i); };
(g.meshes || []).forEach(function (m) {
  m.primitives.forEach(function (p) {
    Object.keys(p.attributes).forEach(function (k) { use(p.attributes[k]); });
    use(p.indices);
    (p.targets || []).forEach(function (t) { Object.keys(t).forEach(function (k) { use(t[k]); }); });
  });
});
(g.skins || []).forEach(function (s) { use(s.inverseBindMatrices); });
(g.animations || []).forEach(function (a) { a.samplers.forEach(function (s) { use(s.input); use(s.output); }); });

const accMap = new Map(), accessors = [];
(g.accessors || []).forEach(function (a, i) { if (usedAcc.has(i)) { accMap.set(i, accessors.length); accessors.push(a); } });
const re = function (i) { return i === undefined ? undefined : accMap.get(i); };
(g.meshes || []).forEach(function (m) {
  m.primitives.forEach(function (p) {
    Object.keys(p.attributes).forEach(function (k) { p.attributes[k] = re(p.attributes[k]); });
    if (p.indices !== undefined) p.indices = re(p.indices);
    (p.targets || []).forEach(function (t) { Object.keys(t).forEach(function (k) { t[k] = re(t[k]); }); });
  });
});
(g.skins || []).forEach(function (s) { if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = re(s.inverseBindMatrices); });
(g.animations || []).forEach(function (a) { a.samplers.forEach(function (s) { s.input = re(s.input); s.output = re(s.output); }); });
g.accessors = accessors;

const usedBV = new Set();
accessors.forEach(function (a) {
  if (a.bufferView !== undefined) usedBV.add(a.bufferView);
  if (a.sparse) { usedBV.add(a.sparse.indices.bufferView); usedBV.add(a.sparse.values.bufferView); }
});
(g.images || []).forEach(function (im) { if (im.bufferView !== undefined) usedBV.add(im.bufferView); });

const bvMap = new Map(), views = [], chunks = [];
let size = 0;
(g.bufferViews || []).forEach(function (v, i) {
  if (!usedBV.has(i)) return;
  const start = v.byteOffset || 0, data = bin.slice(start, start + v.byteLength), pad = (4 - (size % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); size += pad; }
  bvMap.set(i, views.length);
  views.push(Object.assign({}, v, { buffer: 0, byteOffset: size }));
  chunks.push(data); size += data.length;
});
accessors.forEach(function (a) {
  if (a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView);
  if (a.sparse) { a.sparse.indices.bufferView = bvMap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = bvMap.get(a.sparse.values.bufferView); }
});
(g.images || []).forEach(function (im) { if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView); });
g.bufferViews = views;
const tail = (4 - (size % 4)) % 4;
if (tail) { chunks.push(Buffer.alloc(tail)); size += tail; }
g.buffers = [{ byteLength: size }];
const newBin = Buffer.concat(chunks, size);

/* ---------- GLB schreiben und als Skript einbetten ---------- */
let json = Buffer.from(JSON.stringify(g), "utf8");
if (json.length % 4) json = Buffer.concat([json, Buffer.from(" ".repeat(4 - (json.length % 4)))]);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + newBin.length, 8);
jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([head, jh, json, bh, newBin]);

const outDir = path.join(__dirname, "..", "assets", "models");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, name + ".js");
fs.writeFileSync(outFile,
  "/* Eingebettetes 3D-Modell \"" + name + "\" (GLB als Base64). Erzeugt mit tools/pack-models.js. Herkunft: siehe assets/QUELLEN.md */\n" +
  "(globalThis.TT_MODELS = globalThis.TT_MODELS || {})[" + JSON.stringify(name) + "] = \"" + glb.toString("base64") + "\";\n");
console.log(name.padEnd(14) + (buf.length / 1024).toFixed(0).padStart(6) + " KB -> " + (glb.length / 1024).toFixed(0).padStart(5) + " KB (eingebettet " +
  (fs.statSync(outFile).size / 1024).toFixed(0) + " KB), Animationen: " + (found.join(", ") || "keine"));
