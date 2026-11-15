"use strict";
/* Macht aus den Nachbearbeitungs-Modulen von Three.js (examples/jsm, ES-Module) EINE klassische Skriptdatei,
   damit das Spiel auch per Doppelklick (ohne Webserver) läuft. Alle Namen landen direkt auf THREE.
     node tools/make-post.js <ordner examples/jsm> vendor/three-post.js */
const fs = require("fs"), path = require("path");
const jsm = process.argv[2], out = process.argv[3];
const FILES = [   // Reihenfolge = Abhängigkeiten zuerst
  "shaders/CopyShader.js", "shaders/LuminosityHighPassShader.js", "shaders/OutputShader.js",
  "postprocessing/Pass.js", "postprocessing/MaskPass.js", "postprocessing/ShaderPass.js",
  "postprocessing/EffectComposer.js", "postprocessing/RenderPass.js", "postprocessing/UnrealBloomPass.js", "postprocessing/OutputPass.js",
];
let body = "";
FILES.forEach(function (f) {
  let src = fs.readFileSync(path.join(jsm, f), "utf8");
  src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'[^']+';/g, function (m, names) {
    return "const {" + names.replace(/\s+as\s+/g, ": ") + "} = THREE;";
  });
  if (/^\s*import\s/m.test(src)) throw new Error("unbehandelter import in " + f);
  const names = [];
  src = src.replace(/^export\s*\{([\s\S]*?)\};?/m, function (m, list) {
    list.split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (n) { names.push(n); });
    return "";
  });
  if (/^\s*export\s/m.test(src)) throw new Error("unbehandelter export in " + f);
  body += "/* ---- " + f + " ---- */\n(function () {\n" + src + "\n" + names.map(function (n) { return "THREE." + n + " = " + n + ";"; }).join(" ") + "\n})();\n";
});
fs.writeFileSync(out, "/* Nachbearbeitung aus Three.js 0.160 (examples/jsm), MIT-Lizenz, siehe three.LICENSE.txt.\n" +
  "   Unverändert bis auf die Verpackung (klassische Skriptdatei statt ES-Module).\n" +
  "   Enthält: EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass und ihre Shader. */\n" + body);
console.log("geschrieben: " + out + " (" + (fs.statSync(out).size / 1024).toFixed(0) + " KB)");
