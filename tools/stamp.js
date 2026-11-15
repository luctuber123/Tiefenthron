"use strict";
/* Hängt in index.html an jede eigene Skript- und Stildatei einen Fingerabdruck ihres Inhalts an,
   z. B.  js/ui.js  ->  js/ui.js?v=3f9a1c2e

   Warum? GitHub Pages lässt Browser Dateien bis zu 10 Minuten zwischenspeichern. Ohne Fingerabdruck
   bekämen Spieler direkt nach einem Update eine Mischung aus alten und neuen Dateien. So ändert sich
   die Adresse genau der Dateien, die sich geändert haben – nur diese lädt der Browser neu.

   Aufruf: node tools/stamp.js   (läuft auch automatisch vor jedem Speichern mit Git, siehe .githooks) */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, ".."), file = path.join(root, "index.html");

let html = fs.readFileSync(file, "utf8"), changed = 0;
html = html.replace(/(<(?:script|link)\b[^>]*\s(?:src|href)=")([^"?#:]+\.(?:js|css))(?:\?v=[0-9a-f]*)?(")/g, function (m, pre, rel, post) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { console.log("  fehlt: " + rel); return m; }
  const v = crypto.createHash("sha1").update(fs.readFileSync(full)).digest("hex").slice(0, 8);
  const out = pre + rel + "?v=" + v + post;
  if (out !== m) changed++;
  return out;
});
fs.writeFileSync(file, html);
console.log("index.html: " + changed + " Dateiverweise aktualisiert");
