"use strict";
/* Kleine Helfer: Zufall, Rauschen, Himmelsrichtungen. */
(function () {
  // Zufallsgenerator mit Startwert (mulberry32) – gleiche Zahl = gleiche Karte
  TT.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Fester Pseudozufallswert pro Feld (für Grafikvarianten)
  TT.hash = function (x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  TT.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  // Himmelsrichtung eines Feldes vom Kartenmittelpunkt aus
  TT.compass = function (s, idx) {
    const dx = (idx % s.W) - s.W / 2, dy = ((idx / s.W) | 0) - s.H / 2;
    const names = ["Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten", "Norden", "Nordosten"];
    const a = Math.atan2(dy * (s.W / s.H), dx);
    return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  };

  TT.fmtTime = function (sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = (sec / 60) | 0, r = sec % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  };

  // Ton-Ausgabe: wird von audio.js überschrieben, bleibt sonst stumm
  TT.sfx = function () {};
})();
