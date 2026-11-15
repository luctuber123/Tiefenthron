"use strict";
/* Wandelt unbewegte 3D-Modelle (Wände, Böden, Möbel …) in ein kompaktes Format um und bettet sie als Skript ein.

   Aufruf:
     node tools/pack-props.js <paket> [--split teil1,teil2] [--info] <datei.glb|datei.gltf> ...

   Ergebnis: assets/env/<paket>.js
     TT_PROPS.tex["<paket>"]  = Farbtextur des Pakets (alle Modelle eines KayKit-Pakets teilen sich eine)
     TT_PROPS.geo["<name>"]   = Geometrie des Modells (Punkte, Normalen, Texturkoordinaten, Dreiecke)

   Anders als bei den Kreaturen (tools/pack-models.js) braucht es hier kein Skelett und keine Animation.
   Deshalb werden nur die nackten Dreiecke gespeichert – das ist klein und lädt ohne Wartezeit.

   --split  Bei diesen Modellen bleibt jeder Unterknoten ein eigenes Teil ("name#knoten"),
            z. B. der Truhendeckel oder die Stacheln einer Falle, damit das Spiel sie einzeln bewegen kann.
   --info   Nur Maße und Aufbau ausgeben, nichts schreiben. */
const fs = require("fs"), path = require("path");

const args = process.argv.slice(2);
if (args.length < 2) { console.log("Aufruf: node tools/pack-props.js <paket> [--split a,b] [--info] <dateien...>"); process.exit(1); }
const pack = args[0];
let split = [], info = false;
const files = [];
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--split") split = args[++i].split(",");
  else if (args[i] === "--info") info = true;
  else files.push(args[i]);
}

/* ---------- kleine Matrizenrechnung (4x4, spaltenweise wie in glTF) ---------- */
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function fromTRS(t, q, s) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  return [
    (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
    (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
    (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function local(n) { return n.matrix || fromTRS(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]); }

/* ---------- Datei lesen (GLB oder glTF mit .bin daneben) ---------- */
function load(file) {
  const buf = fs.readFileSync(file);
  let g, bins = [];
  if (buf.readUInt32LE(0) === 0x46546c67) {
    for (let off = 12; off < buf.length;) {
      const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.slice(off + 8, off + 8 + len);
      if (type === 0x4e4f534a) g = JSON.parse(data.toString("utf8")); else if (type === 0x004e4942) bins[0] = data;
      off += 8 + len;
    }
  } else {
    g = JSON.parse(buf.toString("utf8"));
    (g.buffers || []).forEach(function (b, i) { bins[i] = fs.readFileSync(path.join(path.dirname(file), path.basename(b.uri))); });
  }
  return { g: g, bins: bins, dir: path.dirname(file) };
}

function accessor(d, idx) {
  const a = d.g.accessors[idx], v = d.g.bufferViews[a.bufferView], bin = d.bins[v.buffer || 0];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
  const stride = v.byteStride || comps * size, start = (v.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Array(a.count * comps);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < comps; c++) {
    const o = start + i * stride + c * size;
    out[i * comps + c] = a.componentType === 5126 ? bin.readFloatLE(o) : a.componentType === 5125 ? bin.readUInt32LE(o)
      : a.componentType === 5123 ? bin.readUInt16LE(o) : a.componentType === 5121 ? bin.readUInt8(o)
      : a.componentType === 5122 ? bin.readInt16LE(o) : bin.readInt8(o);
  }
  return out;
}

function Part() { this.p = []; this.n = []; this.u = []; this.i = []; }

/* ---------- Ein Modell in Teile zerlegen und alle Verschiebungen/Drehungen einrechnen ---------- */
function extract(file) {
  const d = load(file), g = d.g, name = path.basename(file).replace(/\.(gltf\.glb|glb|gltf)$/i, "");
  const doSplit = split.indexOf(name) >= 0, parts = {}, nodes = [];
  function walk(ni, m, top) {
    const n = g.nodes[ni], w = mul(m, local(n));
    const key = doSplit && top !== null ? top : "";
    if (n.mesh !== undefined) {
      nodes.push(n.name || "?");
      const part = parts[key] || (parts[key] = new Part());
      g.meshes[n.mesh].primitives.forEach(function (pr) {
        if (pr.mode !== undefined && pr.mode !== 4) return;
        const pos = accessor(d, pr.attributes.POSITION), nor = pr.attributes.NORMAL !== undefined ? accessor(d, pr.attributes.NORMAL) : null;
        const uv = pr.attributes.TEXCOORD_0 !== undefined ? accessor(d, pr.attributes.TEXCOORD_0) : null;
        const base = part.p.length / 3, count = pos.length / 3;
        for (let k = 0; k < count; k++) {
          const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
          part.p.push(w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]);
          let nx = 0, ny = 1, nz = 0;
          if (nor) {
            const a = nor[k * 3], b = nor[k * 3 + 1], c = nor[k * 3 + 2];
            nx = w[0] * a + w[4] * b + w[8] * c; ny = w[1] * a + w[5] * b + w[9] * c; nz = w[2] * a + w[6] * b + w[10] * c;
            const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
          }
          part.n.push(nx, ny, nz);
          part.u.push(uv ? uv[k * 2] : 0, uv ? uv[k * 2 + 1] : 0);
        }
        const idx = pr.indices !== undefined ? accessor(d, pr.indices) : Array.from({ length: count }, function (_, k) { return k; });
        idx.forEach(function (v) { part.i.push(base + v); });
      });
    }
    (n.children || []).forEach(function (c) { walk(c, w, top === null ? (g.nodes[c].name || "teil") : top); });
  }
  const scene = g.scenes[g.scene || 0];
  // Wurzelknoten zählen zum Hauptteil; erst deren Kinder werden bei --split zu eigenen Teilen
  scene.nodes.forEach(function (r) { walk(r, IDENT, null); });

  // Textur des Pakets: eingebettet oder als Datei daneben
  let tex = null;
  const im = (g.images || [])[0];
  if (im) {
    if (im.bufferView !== undefined) { const v = g.bufferViews[im.bufferView]; tex = d.bins[v.buffer || 0].slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); }
    else if (im.uri && im.uri.indexOf("data:") !== 0) tex = fs.readFileSync(path.join(d.dir, path.basename(im.uri)));
  }
  return { name: name, parts: parts, nodes: nodes, tex: tex, materials: (g.materials || []).map(function (m) { return m.name; }) };
}

function bbox(p) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < p.length; k += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], p[k + c]); mx[c] = Math.max(mx[c], p[k + c]); }
  return mn.map(function (v) { return v.toFixed(2); }).join(",") + " .. " + mx.map(function (v) { return v.toFixed(2); }).join(",");
}

/* ---------- Hauptprogramm ---------- */
const geo = {};
let texture = null, verts = 0;
files.forEach(function (f) {
  const m = extract(f);
  if (m.tex && !texture) texture = m.tex;
  Object.keys(m.parts).forEach(function (k) {
    const part = m.parts[k], key = m.name + (k ? "#" + k : "");
    verts += part.p.length / 3;
    if (info) console.log(key.padEnd(34) + String(part.p.length / 3).padStart(5) + " Pkt " + String(part.i.length / 3).padStart(5) + " Dr.  " + bbox(part.p));
    const big = part.p.length / 3 > 65535;
    geo[key] = {
      p: Buffer.from(new Float32Array(part.p).buffer).toString("base64"),
      n: Buffer.from(new Int8Array(part.n.map(function (v) { return Math.round(v * 127); })).buffer).toString("base64"),
      u: Buffer.from(new Float32Array(part.u).buffer).toString("base64"),
      i: Buffer.from((big ? new Uint32Array(part.i) : new Uint16Array(part.i)).buffer).toString("base64"),
      big: big ? 1 : 0,
    };
  });
  if (info && m.materials.length > 1) console.log("   mehrere Materialien: " + m.materials.join(", "));
});
if (info) { console.log(files.length + " Modelle, " + verts + " Punkte, Textur: " + (texture ? (texture.length / 1024).toFixed(0) + " KB" : "keine")); process.exit(0); }

const outDir = path.join(__dirname, "..", "assets", "env");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, pack + ".js");
let js = "/* Eingebettete Umgebungsmodelle, Paket \"" + pack + "\". Erzeugt mit tools/pack-props.js. Herkunft: siehe assets/QUELLEN.md */\n" +
  "(function () {\n  var P = globalThis.TT_PROPS = globalThis.TT_PROPS || { tex: {}, geo: {} };\n";
if (texture) js += "  P.tex[" + JSON.stringify(pack) + "] = \"data:image/png;base64," + texture.toString("base64") + "\";\n";
Object.keys(geo).forEach(function (k) { js += "  P.geo[" + JSON.stringify(k) + "] = " + JSON.stringify(Object.assign({ tex: pack }, geo[k])) + ";\n"; });
js += "})();\n";
fs.writeFileSync(outFile, js);
console.log(pack + ": " + Object.keys(geo).length + " Teile aus " + files.length + " Modellen, " + verts + " Punkte -> " + (fs.statSync(outFile).size / 1024).toFixed(0) + " KB");
