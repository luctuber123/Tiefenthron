"use strict";
/* Bereitet die Bausteine der Oberfläche auf und bettet sie ein. Herkunft der Dateien: assets/QUELLEN.md

   node tools/make-ui.js icons  <ordner mit .svg von game-icons.net>   -> js/icons.js
   node tools/make-ui.js font   <Cinzel.ttf>                          -> css/schrift.css
   node tools/make-ui.js border <rahmen.png> <ziel.png> <#farbe>      -> assets/ui/<ziel.png> (umgefärbt)
   node tools/make-ui.js fx     <flamme.png> <rauch.png> <stern.png>  -> assets/fx/partikel.js

   Warum einbetten? Beim Start per Doppelklick darf der Browser Schriften und Texturen für die
   3D-Grafik nicht aus Dateien nachladen. Als Text in Skript bzw. Stylesheet geht es immer. */
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const root = path.join(__dirname, ".."), cmd = process.argv[2], a = process.argv.slice(3);

/* Welches Symbol wofür? Schlüssel = Name im Spiel, Wert = Datei aus dem Symbolpaket (Zeichner_Name). */
const ICONS = {
  // Befehle
  select: "delapouite_arrow-cursor", dig: "lorc_mining", hand: "lorc_grab", sell: "lorc_wrecking-ball",
  // Räume
  treasury: "delapouite_gold-stack", lair: "delapouite_bed", garden: "delapouite_mushrooms", training: "lorc_crossed-swords",
  archive: "delapouite_bookshelf", forge: "lorc_anvil", prison: "delapouite_cage",
  // Türen und Fallen
  door: "lorc_wooden-door", spike: "sbed_spikes", flame: "lorc_fire-ring",
  // Zauber
  worker: "delapouite_miner", eye: "lorc_third-eye", heal: "delapouite_healing", spark: "lorc_lightning-storm",
  drum: "delapouite_drum", haste: "lorc_sprint",
  // Kopfleiste
  gold: "delapouite_two-coins", ess: "lorc_crystal-shine", horde: "lorc_minions", raid: "lorc_crossed-axes",
  know: "lorc_scroll-unfurled", parts: "lorc_cog", pay: "delapouite_receive-money",
};

if (cmd === "icons") {
  const out = {};
  Object.keys(ICONS).forEach(function (key) {
    const svg = fs.readFileSync(path.join(a[0], ICONS[key] + ".svg"), "utf8");
    // Nur die Pfaddaten übernehmen (der schwarze Hintergrund fliegt raus), und nur, wenn sie wie Pfaddaten aussehen
    const ds = [];
    svg.replace(/\sd="([^"]+)"/g, function (m, d) { if (d !== "M0 0h512v512H0z" && /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,+\-eE]+$/.test(d)) ds.push(d); return m; });
    if (!ds.length) throw new Error("kein Pfad in " + ICONS[key]);
    out[key] = ds.join(" ");
  });
  const file = path.join(root, "js", "icons.js");
  fs.writeFileSync(file, "\"use strict\";\n/* Symbole der Oberfläche als Pfaddaten (512 x 512). Erzeugt mit tools/make-ui.js.\n" +
    "   Quelle: game-icons.net, Zeichner Lorc, Delapouite und Sbed, Lizenz CC BY 3.0 – siehe assets/QUELLEN.md */\n" +
    "TT.ICONS = " + JSON.stringify(out, null, 1) + ";\n");
  console.log("icons: " + Object.keys(out).length + " Symbole -> " + (fs.statSync(file).size / 1024).toFixed(0) + " KB");
} else if (cmd === "font") {
  const ttf = fs.readFileSync(a[0]), file = path.join(root, "css", "schrift.css");
  fs.writeFileSync(file, "/* Schrift \"Cinzel\" (The Cinzel Project Authors, SIL Open Font License 1.1 – siehe assets/fonts/OFL.txt),\n" +
    "   eingebettet mit tools/make-ui.js, damit sie auch beim Start per Doppelklick lädt. */\n" +
    "@font-face {\n  font-family: \"Cinzel\";\n  font-weight: 400 900;\n  font-display: swap;\n" +
    "  src: url(data:font/ttf;base64," + ttf.toString("base64") + ") format(\"truetype\");\n}\n");
  console.log("font: " + (fs.statSync(file).size / 1024).toFixed(0) + " KB");
} else if (cmd === "border") {
  // Die Rahmenbilder sind winzige Paletten-PNGs: zum Umfärben genügt es, die Palette auszutauschen.
  const b = fs.readFileSync(a[0]), col = a[2].replace("#", ""), rgb = [0, 2, 4].map(function (k) { return parseInt(col.substr(k, 2), 16); });
  const parts = [b.slice(0, 8)];
  let done = false;
  for (let off = 8; off < b.length;) {
    const len = b.readUInt32BE(off), type = b.toString("latin1", off + 4, off + 8);
    let data = Buffer.from(b.slice(off + 8, off + 8 + len));
    if (type === "PLTE") { for (let k = 0; k < data.length; k += 3) { data[k] = rgb[0]; data[k + 1] = rgb[1]; data[k + 2] = rgb[2]; } done = true; }
    const head = Buffer.alloc(8); head.writeUInt32BE(len, 0); head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.slice(4), data])) >>> 0, 0);
    parts.push(head, data, crc);
    off += 12 + len;
  }
  if (!done) throw new Error("keine Palette in " + a[0]);
  const dir = path.join(root, "assets", "ui");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, a[1]), Buffer.concat(parts));
  console.log("border: assets/ui/" + a[1] + " in #" + col);
} else if (cmd === "fx") {
  const dir = path.join(root, "assets", "fx");
  fs.mkdirSync(dir, { recursive: true });
  const uri = function (f) { return "data:image/png;base64," + fs.readFileSync(f).toString("base64"); };
  const file = path.join(dir, "partikel.js");
  fs.writeFileSync(file, "/* Partikelbilder für Flammen, Rauch und Funkeln. Quelle: Kenney Particle Pack, CC0 – siehe assets/QUELLEN.md */\n" +
    "globalThis.TT_FX = { flame: \"" + uri(a[0]) + "\", smoke: \"" + uri(a[1]) + "\", star: \"" + uri(a[2]) + "\" };\n");
  console.log("fx: " + (fs.statSync(file).size / 1024).toFixed(0) + " KB");
} else {
  console.log("Aufruf: node tools/make-ui.js icons|font|border|fx ... (siehe Kopf der Datei)");
  process.exit(1);
}
