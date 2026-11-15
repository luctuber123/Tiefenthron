"use strict";
/* Winziger lokaler Webserver (optional):  node tools/serve.js
   Danach im Browser http://localhost:5173 öffnen.
   Das Spiel läuft auch ohne ihn per Doppelklick auf index.html. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || process.argv[2] || 5173);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
};

http.createServer(function (req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.resolve(root, "." + rel);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end("Verboten"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end("Nicht gefunden"); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(port, "127.0.0.1", function () {
  console.log("Tiefenthron läuft auf http://localhost:" + port);
});
