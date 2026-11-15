"use strict";
/* Darstellung: alles wird zur Laufzeit gezeichnet – es gibt keine Bilddateien. */
(function () {
  const T = TT.T, OBJ = TT.OBJ, ID = TT.ROOM_ID, B = TT.BAL, S = 32, TAU = Math.PI * 2;
  let spr = null;

  /* ---------- Zeichenhelfer ---------- */
  function ell(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function circ(g, x, y, r, c) { ell(g, x, y, r, r, c); }
  function line(g, x1, y1, x2, y2, c, w) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round";
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  function poly(g, p, c) {
    g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]);
    for (let k = 2; k < p.length; k += 2) g.lineTo(p[k], p[k + 1]);
    g.closePath(); g.fill();
  }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  /* ---------- Bodenkacheln einmalig vorzeichnen ---------- */
  function make(seed, fn, scale) {
    const k = scale || 1, c = document.createElement("canvas");
    c.width = S * k; c.height = S * k;
    const g = c.getContext("2d", { willReadFrequently: k > 1 });   // die 3D-Ansicht bearbeitet die großen Kacheln pixelweise nach
    g.scale(k, k);                      // gemalt wird immer in 32er-Einheiten
    fn(g, TT.rng(seed));
    return c;
  }
  function speckle(g, r, colors, n, a, b) {
    for (let k = 0; k < n; k++) {
      g.fillStyle = colors[(r() * colors.length) | 0];
      const sz = a + r() * (b - a);
      g.fillRect(r() * S, r() * S, sz, sz);
    }
  }
  function earthBase(g, r) {
    rect(g, 0, 0, S, S, "#3b2b36");
    speckle(g, r, ["#46333f", "#33242e", "#4f3a47", "#2c1f28"], 80, 1.5, 4.5);
    for (let k = 0; k < 4; k++) ell(g, r() * S, r() * S, 1.5 + r() * 1.5, 1 + r(), "#5b4653");
  }
  function slabBase(g, r) {
    rect(g, 0, 0, S, S, "#2a323d");
    speckle(g, r, ["#2f3844", "#262d37", "#313b48"], 40, 2, 6);
    g.fillStyle = "#1b222a";
    g.fillRect(0, 0, S, 1.5); g.fillRect(0, 0, 1.5, S);
    g.fillRect(15.5 + (r() - 0.5) * 6, 0, 1.2, S); g.fillRect(0, 15.5 + (r() - 0.5) * 6, S, 1.2);
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(1.5, 1.5, S - 1.5, 1); g.fillRect(1.5, 1.5, 1, S - 1.5);
    g.fillStyle = "rgba(55,224,200,0.45)";
    g.fillRect(0, 0, 2, 2);
  }

  const ROOM_ART = {
    treasury: function (g, r) {
      g.strokeStyle = "rgba(233,185,58,0.55)"; g.lineWidth = 1.5; g.strokeRect(3.5, 3.5, S - 7, S - 7);
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(8 + r() * 16, 8 + r() * 16, 2.2, 0, TAU); g.stroke(); }
    },
    lair: function (g) {
      ell(g, 16, 17, 11, 8.5, "#5b4630"); ell(g, 16, 17, 8, 5.8, "#2c2132");
      g.strokeStyle = "#8a6c45"; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const a = k * 0.7; g.beginPath(); g.moveTo(16 + Math.cos(a) * 8, 17 + Math.sin(a) * 6); g.lineTo(16 + Math.cos(a + 0.5) * 11, 17 + Math.sin(a + 0.5) * 8.5); g.stroke(); }
    },
    garden: function (g, r) {
      rect(g, 3, 3, S - 6, S - 6, "rgba(28,34,22,0.85)");
      speckle(g, r, ["#28351f", "#1c2616", "#33452a"], 40, 1.5, 4);
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let y = 8; y < S - 4; y += 7) g.fillRect(4, y, S - 8, 1.2);
    },
    training: function (g) {
      g.strokeStyle = "rgba(230,190,150,0.5)"; g.lineWidth = 1.6;
      g.beginPath(); g.arc(16, 16, 10.5, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(11, 11); g.lineTo(21, 21); g.moveTo(21, 11); g.lineTo(11, 21); g.stroke();
    },
    archive: function (g, r) {
      g.strokeStyle = "rgba(143,232,255,0.6)"; g.lineWidth = 1.3; g.lineCap = "round";
      g.beginPath();
      let x = 9 + r() * 4, y = 8;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x = 8 + r() * 16; y += 3.5; g.lineTo(x, y); }
      g.stroke();
      g.strokeRect(5.5, 5.5, S - 11, S - 11);
    },
    forge: function (g, r) {
      rect(g, 3, 3, S - 6, S - 6, "rgba(40,44,52,0.8)");
      [[6, 6], [26, 6], [6, 26], [26, 26]].forEach(function (p) { circ(g, p[0], p[1], 1.3, "#b7c2cf"); });
      const gr = g.createRadialGradient(16, 16, 1, 16, 16, 9);
      gr.addColorStop(0, "rgba(255,150,60,0.75)"); gr.addColorStop(1, "rgba(255,90,30,0)");
      g.fillStyle = gr; g.fillRect(6, 6, 20, 20);
      void r;
    },
    prison: function (g) {
      rect(g, 3, 3, S - 6, S - 6, "rgba(20,14,22,0.8)");
      g.strokeStyle = "rgba(176,82,124,0.7)"; g.lineWidth = 1.5; g.strokeRect(3.5, 3.5, S - 7, S - 7);
    },
  };

  function rockArt(g, r) {
    rect(g, 0, 0, S, S, "#262a40");
    for (let k = 0; k < 7; k++) {
      const x = r() * S, y = r() * S, w = 5 + r() * 9;
      poly(g, [x, y, x + w, y + r() * 5, x + w * 0.6, y + w * 0.9, x - 2, y + w * 0.6], ["#30365a", "#1d2034", "#363d63", "#222640"][(r() * 4) | 0]);
    }
    speckle(g, r, ["#3d4570", "#191b2c"], 14, 1, 2.5);
  }
  function goldArt(g, r) {
    earthBase(g, r);
    for (let k = 0; k < 7; k++) {
      const x = 4 + r() * 24, y = 4 + r() * 24, w = 2 + r() * 2.6;
      ell(g, x, y, w, w * 0.8, "#b9841f"); ell(g, x - 0.4, y - 0.5, w * 0.75, w * 0.55, "#f0c341");
      circ(g, x - w * 0.3, y - w * 0.35, 0.8, "#fff4b5");
    }
  }
  function gemArt(g, r) {
    earthBase(g, r);
    for (let k = 0; k < 5; k++) {
      const x = 5 + r() * 22, y = 6 + r() * 20, h = 4 + r() * 5, w = 2 + r() * 2, c = r() < 0.5;
      poly(g, [x, y - h, x + w, y, x, y + h * 0.5, x - w, y], c ? "#41d6c8" : "#a56bf0");
      poly(g, [x, y - h, x + w, y, x, y], c ? "#9ffcf0" : "#dcc0ff");
    }
  }
  function floorArt(g, r) {
    rect(g, 0, 0, S, S, "#1b151d");
    speckle(g, r, ["#241c27", "#15101a", "#2a2130"], 60, 1.5, 4);
    for (let k = 0; k < 3; k++) ell(g, r() * S, r() * S, 1.6, 1.1, "#352b3a");
  }
  function fogArt(g, r) {
    rect(g, 0, 0, S, S, "#0a0810");
    speckle(g, r, ["#0e0b16", "#08060d"], 20, 3, 8);
  }
  function roomArt(def) {
    return function (g, r) {
      slabBase(g, r);
      g.globalAlpha = 0.26; rect(g, 0, 0, S, S, def.color); g.globalAlpha = 1;
      ROOM_ART[def.key](g, r);
    };
  }

  function buildSprites() {
    spr = { rock: [], earth: [], gold: [], gem: [], floor: [], claimed: [], fog: [], room: [] };
    for (let v = 0; v < 4; v++) {
      spr.earth.push(make(11 + v, earthBase));
      spr.rock.push(make(31 + v, rockArt));
      spr.gold.push(make(51 + v, goldArt));
      spr.gem.push(make(71 + v, gemArt));
      spr.floor.push(make(91 + v, floorArt));
      spr.claimed.push(make(111 + v, slabBase));
      spr.fog.push(make(131 + v, fogArt));
    }
    for (let id = 1; id < TT.ROOMS.length; id++) {
      const def = TT.ROOMS[id];
      spr.room[id] = [make(200 + id * 10, roomArt(def)), make(201 + id * 10, roomArt(def))];
    }
  }

  // Dieselben Kacheln in höherer Auflösung – daraus macht die 3D-Ansicht ihre Texturen
  TT.tileCanvas = function (kind, scale) {
    const art = { earth: earthBase, rock: rockArt, gold: goldArt, gem: gemArt, floor: floorArt, claimed: slabBase, fog: fogArt };
    if (art[kind]) return make(11, art[kind], scale);
    return make(210, roomArt(TT.ROOMS[TT.ROOM_ID[kind]]), scale);   // sonst: Raumname
  };

  /* ---------- Kreaturen ---------- */
  function human(g, tunic, legs, skin) {
    rect(g, -3.6, 7, 2.8, 3.2, legs); rect(g, 0.9, 7, 2.8, 3.2, legs);
    rect(g, -4.6, -1.8, 9.2, 9.6, tunic);
    rect(g, -4.6, 3.2, 9.2, 1.3, "rgba(0,0,0,0.28)");
    circ(g, 0.6, -5, 3.5, skin);
    circ(g, 2.5, -4.8, 0.7, "#1a1014");
  }

  const ART = {
    digger: function (g, e, time, rot) {
      ell(g, 0, 3, 6, 5.5, "#c9925a"); ell(g, 1, 5, 4, 3, "#e3b889");
      ell(g, 5, 2, 3, 2.2, "#f0b7a2"); circ(g, 7.3, 1.8, 1, "#5a2e2a"); circ(g, 3.2, -0.5, 1, "#1a1014");
      ell(g, 0.5, -2.6, 4.6, 2.3, "#55606e"); circ(g, 3.6, -3.4, 1.4, "#9ffcf0");
      g.save(); g.translate(3, 4); g.rotate(-0.5 + rot);
      line(g, 0, 0, 7, -5, "#7a5a3a", 1.4); line(g, 5, -7.5, 9.5, -3, "#b9c4cf", 1.8);
      g.restore();
      if (e.carry > 0) { circ(g, -5.5, 0.5, 3, "#e9b93a"); circ(g, -6.3, -0.5, 1, "#fff2a8"); }
    },
    schrat: function (g, e, time, rot) {
      ell(g, 0, 2, 7.5, 7.5, "#5f9a4e"); ell(g, -1, 5, 5.5, 4, "#78b565"); ell(g, -2.5, -4.5, 3, 2, "#3f6f38");
      circ(g, 2, -1.5, 1.3, "#ffe36e"); circ(g, 5.2, -1.2, 1.1, "#ffe36e");
      circ(g, 2.3, -1.5, 0.5, "#1a1014"); circ(g, 5.4, -1.2, 0.45, "#1a1014");
      poly(g, [2.2, 2.6, 3.1, 0.2, 4, 2.6], "#f4efe0"); poly(g, [5, 2.6, 5.7, 0.6, 6.4, 2.6], "#f4efe0");
      g.save(); g.translate(6.5, 4.5); g.rotate(-0.4 + rot * 1.3);
      line(g, 0, 0, 0, -9, "#6e4c2e", 2.2); circ(g, 0, -9.5, 2.7, "#7d5a36");
      g.restore();
    },
    spucker: function (g, e, time) {
      // Basaltechse mit Rückenkamm und pulsierenden Glutadern
      const base = g.globalAlpha, pulse = 0.7 + Math.sin(time * 4 + e.ph) * 0.3;
      line(g, -6, 5, -11.5, 3 + Math.sin(time * 5 + e.ph) * 1.2, "#2a1c22", 2.6);
      line(g, -3.5, 7.5, -5, 9.8, "#2a1c22", 1.8); line(g, 3, 7.5, 4.5, 9.8, "#2a1c22", 1.8);
      poly(g, [-5.5, 1, -4, -3.5, -2.5, 0.4], "#6a4048"); poly(g, [-2, 0.2, -0.5, -5, 1, 0.2], "#6a4048");
      poly(g, [1.5, 0.4, 3, -4, 4.5, 0.8], "#6a4048");
      ell(g, 0, 4, 8, 4.6, "#3d2a33"); ell(g, 6.2, 1.2, 4.4, 3.4, "#3d2a33");
      g.globalAlpha = base * pulse;
      circ(g, -3.2, 4.6, 1.5, "#ff8a2c"); circ(g, 0.4, 5.4, 1.2, "#ffb347"); circ(g, 3, 3.8, 1, "#ff8a2c");
      ell(g, 9, 2.6, 2, 1.1, "#ffb347");
      g.globalAlpha = base;
      circ(g, 7.2, 0, 1.1, "#ffe36e"); circ(g, 7.5, 0, 0.45, "#1a1014");
    },
    fluesterer: function (g, e, time) {
      poly(g, [0, -11, -6.5, 9.5, 6.5, 9.5], "#27406b"); poly(g, [0, -11, -2.6, 9.5, 2.6, 9.5], "#35558c");
      ell(g, 0.8, -4.5, 3.2, 3.6, "#0c1220"); circ(g, 1.6, -4.6, 1.5, "#8fe8ff"); circ(g, 1.6, -4.6, 0.6, "#fff");
      for (let k = 0; k < 3; k++) { const a = time * 2 + k * 2.1 + e.ph; circ(g, Math.cos(a) * 9, -2 + Math.sin(a) * 4, 0.9, "#7fe0ff"); }
    },
    eisenwanst: function (g, e, time, rot) {
      circ(g, 0, 2, 9, "#7f8b97"); ell(g, 0.5, 3.5, 6.5, 5.5, "#a5b1bd");
      [[-4, 0], [4.8, 0], [-3, 7], [4, 7]].forEach(function (p) { circ(g, p[0], p[1], 0.8, "#4b5560"); });
      circ(g, 1, -7.5, 3.6, "#6b7783"); rect(g, 0.5, -8.3, 4, 1.3, "#ffb347");
      g.save(); g.translate(8, 3); g.rotate(-0.3 + rot * 1.2);
      line(g, 0, 0, 0, -8, "#5a4636", 2); rect(g, -3, -11.5, 6, 4, "#4b5560");
      g.restore();
    },
    klinge: function (g, e, time, rot) {
      poly(g, [-3.5, -3, -7.5, -5.5, -3.8, 0], "#7d2a5c"); poly(g, [-3.8, 1, -7.5, 0.5, -3.5, 4.5], "#7d2a5c");
      ell(g, 0, 2, 4.2, 8, "#b8478a"); ell(g, 0.5, 3.5, 2.6, 5, "#d679ae");
      circ(g, 1, -6.5, 3.3, "#b8478a"); rect(g, 1, -7.3, 3, 1, "#fff");
      g.save(); g.translate(3, 0); g.rotate(rot * 0.9 - 0.2); poly(g, [0, 0, 11, -6, 2, 2.5], "#f3d9e9"); g.restore();
      g.save(); g.translate(3, 3); g.rotate(-rot * 0.9 + 0.2); poly(g, [0, 0, 10, 5, 1, 3], "#e8c5dc"); g.restore();
    },
    nachtmahr: function (g, e, time) {
      g.fillStyle = "#3d2468"; g.beginPath(); g.moveTo(-10, 8);
      for (let k = 0; k <= 10; k++) g.lineTo(-10 + k * 2, 8 + Math.sin(time * 5 + k * 1.3 + e.ph) * 1.6);
      g.quadraticCurveTo(13, -4, 4, -11); g.quadraticCurveTo(-4, -14, -9, -7); g.closePath(); g.fill();
      ell(g, 0, -1, 7, 7.5, "#553392");
      circ(g, 1, -5, 1.5, "#f0c8ff"); circ(g, 5, -3.5, 1.2, "#f0c8ff"); circ(g, 3.5, -0.6, 1, "#f0c8ff");
      ell(g, 4, 3.6, 3.5, 1.6, "#12081f");
    },
    miliz: function (g, e, time, rot) {
      human(g, "#a98f62", "#4a3a2c", "#e8c9a0");
      g.fillStyle = "#8a939e"; g.beginPath(); g.arc(0.6, -5.6, 4, Math.PI, 0); g.fill(); g.fillRect(-4, -6, 9.2, 1.3);
      g.save(); g.translate(6, 4); g.rotate(rot * 0.7);
      line(g, 0, 4, 1.5, -13, "#6e4c2e", 1.3); poly(g, [1.5, -16.5, 0.2, -12.5, 2.9, -12.5], "#d8e0ea");
      g.restore();
      line(g, -5.5, 2, -6.8, -5, "#6e4c2e", 1.4);
      circ(g, -6.9, -7 + Math.sin(time * 13 + e.ph) * 0.5, 2.4, "#ff9a2c"); circ(g, -6.9, -7.4, 1.2, "#fff2a8");
    },
    schuetze: function (g, e, time, rot) {
      human(g, "#5f7248", "#3a3226", "#e8c9a0");
      g.fillStyle = "#3f4f30"; g.beginPath(); g.arc(0.2, -5.4, 4.1, Math.PI * 0.9, Math.PI * 2.1); g.fill();
      line(g, 2, 1.5 - rot, 10.5, 1.5 - rot, "#6e4c2e", 1.7); line(g, 8.2, -3 - rot, 8.2, 6 - rot, "#b9c4cf", 1.2);
    },
    sappeur: function (g, e, time) {
      human(g, "#8a6a4a", "#3a3226", "#e0b890");
      g.fillStyle = "#e8c33c"; g.beginPath(); g.arc(0.6, -5.6, 4, Math.PI, 0); g.fill(); g.fillRect(-4.2, -6, 9.6, 1.4);
      circ(g, 3.4, -7.4, 1.2, "#fff7c8");
      const sw = e.nx >= 0 && !e.mv ? Math.sin(time * 15) * 0.5 : 0;
      g.save(); g.translate(6, 5); g.rotate(sw);
      line(g, 0, 4, 2, -9, "#6e4c2e", 1.4); poly(g, [0, -9, 4, -9, 3.6, -13.5, 0.4, -13.5], "#aab4c0");
      g.restore();
    },
    priester: function (g, e, time) {
      poly(g, [-4.4, -2, 4.4, -2, 6.5, 10.2, -6.5, 10.2], "#e8e4d8"); rect(g, -0.8, -2, 1.6, 12, "#d4b24a");
      circ(g, 0.6, -5, 3.5, "#e8c9a0"); circ(g, 2.5, -4.8, 0.7, "#1a1014");
      g.strokeStyle = "#ffe9a0"; g.lineWidth = 1.1; g.beginPath(); g.ellipse(0.6, -10, 4, 1.4, 0, 0, TAU); g.stroke();
      line(g, 7, 10, 7, -9, "#8a6c45", 1.3); circ(g, 7, -10.5, 2 + Math.sin(time * 4 + e.ph) * 0.3, "#fff3b0");
    },
    ritter: function (g, e, time, rot) {
      rect(g, -4, 7, 3.2, 3.4, "#6b7480"); rect(g, 0.8, 7, 3.2, 3.4, "#6b7480");
      rect(g, -5.2, -2.4, 10.4, 10.2, "#9aa6b5"); rect(g, -5.2, 2.6, 10.4, 1.4, "#6b7480");
      circ(g, 0.6, -5.4, 4, "#b7c2cf"); rect(g, 1, -6.2, 3.8, 1.2, "#1a1014");
      poly(g, [-1, -9, -6, -12.5, -2.5, -7.5], "#d0433c");
      poly(g, [3, -1.5, 9.5, -1.5, 9.5, 4, 6.2, 8.5, 3, 4], "#3a62b8"); rect(g, 5.8, -0.5, 1, 7, "#e9eef5"); rect(g, 4, 1.6, 4.6, 1, "#e9eef5");
      g.save(); g.translate(-5, 3); g.rotate(-rot);
      line(g, 0, 0, -3, -11, "#d8e0ea", 1.7); line(g, -2.2, -1.5, 1.2, -2.6, "#8a6c45", 1.5);
      g.restore();
    },
    vogt: function (g, e, time, rot) {
      poly(g, [-4, -3, -11, 10.5, -1, 10.5], "#f1ead2");
      rect(g, -4, 7, 3.2, 3.4, "#a8842a"); rect(g, 0.8, 7, 3.2, 3.4, "#a8842a");
      rect(g, -5.4, -2.6, 10.8, 10.4, "#e0b23a"); rect(g, -5.4, 2.6, 10.8, 1.4, "#a8842a");
      circ(g, -5.4, -2, 2.6, "#f3cf63"); circ(g, 5.4, -2, 2.6, "#f3cf63");
      circ(g, 0.6, -5.6, 4, "#f3cf63"); rect(g, 1, -6.4, 3.8, 1.2, "#1a1014");
      poly(g, [-2.6, -8.6, -1.6, -12, 0.2, -9.2, 1.8, -12.4, 3.4, -8.6], "#fff3b0");
      g.strokeStyle = "rgba(255,243,176,0.9)"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0.6, -14, 5, 1.6, 0, 0, TAU); g.stroke();
      g.save(); g.translate(6.5, 3); g.rotate(0.25 + rot * 1.2);
      line(g, 0, 0, 0, -16, "#fff8d8", 2.3); line(g, -2.6, -2, 2.6, -2, "#a8842a", 1.8);
      g.restore();
    },
  };

  function drawCreature(g, s, e, time, selected) {
    const def = TT.CREATURES[e.type];
    const sc = (def.boss || e.boss ? 1.55 : 1) * (1 + (e.lvl - 1) * 0.035);
    const asleep = e.st === "act" && e.act === "sleep";
    const bob = e.mv ? -Math.abs(Math.sin(time * 11 + e.ph)) * 1.8 : Math.sin(time * 2 + e.ph) * 0.4;
    let rot = 0;
    if (e.st === "fight" && e.cd > 0) rot = Math.sin(Math.min(1, e.cd / def.cd) * Math.PI) * 0.9;
    else if (e.worker && e.st === "work") rot = Math.sin(time * 16 + e.ph) * 0.6;

    if (selected) {
      g.strokeStyle = "#37e0c8"; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(0, 9.5 * sc, 10 * sc, 3.8 * sc, 0, 0, TAU); g.stroke();
    }
    ell(g, 0, 9.5 * sc, 7.5 * sc, 2.6 * sc, "rgba(0,0,0,0.38)");
    g.save();
    g.translate(0, bob);
    g.scale(e.dir * sc, sc);
    if (asleep) g.globalAlpha = 0.72;
    ART[def.art || e.type](g, e, time, rot);
    if (e.conv) rect(g, -4.6, 0.4, 9.2, 1.7, "#b06cff");      // Überläufer tragen dein Band
    if (s.pl && !e.foe && e.pl !== s.me) rect(g, -4.6, 0.4, 9.2, 1.7, "#ff3a2a");   // Kreaturen des Rivalen
    if (e.hurt > 0) circ(g, 0, 0, 10, "rgba(255,255,255,0.4)");
    g.restore();

    const top = -13 * sc - 3, mx = TT.maxHp(s, e);
    if (e.hp < mx) {
      rect(g, -8, top, 16, 2.6, "rgba(0,0,0,0.7)");
      rect(g, -7.5, top + 0.5, 15 * Math.max(0, e.hp / mx), 1.6, TT.hostile(s, e) ? "#ff6a55" : "#7dffb0");
    }
    g.textAlign = "center";
    if (e.lvl > 1) {
      g.font = "bold 7px sans-serif"; g.fillStyle = e.foe ? "#ffcf8a" : "#b9fff2";
      g.fillText(String(e.lvl), 10 * sc, top + 5);
    }
    if (asleep) {
      g.font = "bold 8px sans-serif"; g.fillStyle = "#c9c2ff";
      g.fillText("z", 6, top - 1 + Math.sin(time * 2) * 1.5); g.fillText("z", 10, top - 6 + Math.sin(time * 2 + 1) * 1.5);
    } else if (!e.foe && !e.worker && e.mood < 25) {
      g.font = "bold 10px sans-serif"; g.fillStyle = "#ff6a55"; g.fillText("!", 0, top - 2);
    }
    if (e.haste > 0) { g.font = "bold 8px sans-serif"; g.fillStyle = "#ffe36e"; g.fillText("»", -10 * sc, 2); }
  }

  /* ---------- Markierung zum Graben ---------- */
  function markOverlay(ctx, px, py, w, h, time) {
    ctx.fillStyle = "rgba(55,224,200," + (0.2 + 0.08 * Math.sin(time * 4)) + ")";
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = "rgba(150,255,240,0.8)"; ctx.lineWidth = Math.max(1, w / 18);
    const m = w * 0.18, l = w * 0.2;
    ctx.beginPath();
    ctx.moveTo(px + m, py + m + l); ctx.lineTo(px + m, py + m); ctx.lineTo(px + m + l, py + m);
    ctx.moveTo(px + w - m - l, py + m); ctx.lineTo(px + w - m, py + m); ctx.lineTo(px + w - m, py + m + l);
    ctx.moveTo(px + w - m, py + h - m - l); ctx.lineTo(px + w - m, py + h - m); ctx.lineTo(px + w - m - l, py + h - m);
    ctx.moveTo(px + m + l, py + h - m); ctx.lineTo(px + m, py + h - m); ctx.lineTo(px + m, py + h - m - l);
    ctx.stroke();
  }

  /* ============================================================
     HAUPT-ZEICHENROUTINE
     ============================================================ */
  TT.render = function (s, v, ctx, ui, time) {
    if (!spr) buildSprites();
    const z = v.zoom, W = s.W, H = s.H;
    const ox = v.w / 2 - v.cx * z, oy = v.h / 2 - v.cy * z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#07060b"; ctx.fillRect(0, 0, v.w, v.h);

    const x0 = Math.max(0, Math.floor(-ox / z)), x1 = Math.min(W - 1, Math.floor((v.w - ox) / z));
    const y0 = Math.max(0, Math.floor(-oy / z)), y1 = Math.min(H - 1, Math.floor((v.h - oy) / z));
    const PX = function (x) { return Math.floor(ox + x * z); }, PY = function (y) { return Math.floor(oy + y * z); };
    // Zeichnen in "Feldkoordinaten": 32 Einheiten pro Feld, Ursprung = Weltpunkt (x, y)
    const at = function (x, y) { ctx.setTransform(z / S, 0, 0, z / S, ox + x * z, oy + y * z); };
    const reset = function () { ctx.setTransform(1, 0, 0, 1, 0, 0); };
    const fillRatio = s.gold / TT.goldCap(s);

    /* --- 1. Boden --- */
    for (let y = y0; y <= y1; y++) {
      const py = PY(y), h = PY(y + 1) - py;
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, px = PX(x), w = PX(x + 1) - px;
        const hv = TT.hash(x, y, 7), vr = (hv * 4) | 0;
        if (!s.seen[i]) {
          ctx.drawImage(spr.fog[vr], px, py, w, h);
          if (s.mark[i]) markOverlay(ctx, px, py, w, h, time);
          continue;
        }
        const t = s.tiles[i];
        if (t < T.FLOOR) {
          ctx.drawImage((t === T.ROCK ? spr.rock : t === T.EARTH ? spr.earth : t === T.GOLD ? spr.gold : spr.gem)[vr], px, py, w, h);
          if (s.dig[i] > 0) { ctx.fillStyle = "rgba(10,6,12," + Math.min(0.55, s.dig[i] / B.digTime * 0.55) + ")"; ctx.fillRect(px, py, w, h); }
          if (t === T.GOLD && s.ore[i] < B.oreGold) { ctx.fillStyle = "rgba(20,12,20," + (1 - s.ore[i] / B.oreGold) * 0.5 + ")"; ctx.fillRect(px, py, w, h); }
          if (s.mark[i]) markOverlay(ctx, px, py, w, h, time);
          if (s.tiles[i + W] >= T.FLOOR && s.seen[i + W]) {      // Wandkante nach unten
            ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(px, py + h * 0.74, w, h * 0.26);
            ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(px, py + h * 0.74 - 1, w, 1.5);
          }
          continue;
        }
        ctx.drawImage(t === T.CLAIMED ? (s.room[i] ? spr.room[s.room[i]][vr & 1] : spr.claimed[vr]) : spr.floor[vr], px, py, w, h);
        if (s.tiles[i - W] < T.FLOOR) {                           // Schatten der Wand darüber
          ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(px, py, w, h * 0.16);
          ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(px, py + h * 0.16, w, h * 0.14);
        }
        if (s.tiles[i - 1] < T.FLOOR) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(px, py, w * 0.12, h); }

        const room = s.room[i];
        if (room === ID.garden && s.food[i] > 0) {
          at(x + 0.5, y + 0.5);
          const pos = [[-7, -4], [6, 1], [-2, 8]];
          for (let k = 0; k < s.food[i]; k++) {
            const mx = pos[k][0] + (TT.hash(x, y, k + 20) - 0.5) * 4, my = pos[k][1];
            rect(ctx, mx - 0.8, my - 1, 1.6, 4.5, "#d8d0c0");
            ell(ctx, mx, my - 1.5, 3.6, 2.5, "#39c9a0"); ell(ctx, mx - 0.6, my - 2.2, 1.6, 0.9, "#b9fff0");
          }
          reset();
        } else if (room === ID.treasury && fillRatio > 0.02) {
          at(x + 0.5, y + 0.5);
          const n = Math.max(1, Math.round(fillRatio * 5 + hv - 0.5));
          const pos = [[0, 3], [-7, 7], [7, 6], [-4, -3], [5, -4]];
          for (let k = 0; k < n && k < 5; k++) {
            ell(ctx, pos[k][0], pos[k][1], 4.5, 2.8, "#b9841f"); ell(ctx, pos[k][0], pos[k][1] - 1, 4.2, 2.5, "#f0c341");
            circ(ctx, pos[k][0] - 1.4, pos[k][1] - 1.8, 0.8, "#fff4b5");
          }
          reset();
        }
      }
    }

    /* --- 2. Objekte --- */
    const vis = function (i) { const x = i % W, y = (i / W) | 0; return s.seen[i] && x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1; };

    for (const tr of s.traps) {
      if (!vis(tr.idx)) continue;
      at((tr.idx % W) + 0.5, ((tr.idx / W) | 0) + 0.5);
      if (tr.k === OBJ.DOOR) {
        rect(ctx, -13, -13, 26, 26, "#5a4030");
        for (let k = -9; k <= 9; k += 6) rect(ctx, k - 0.5, -13, 1, 26, "#3c2a1f");
        rect(ctx, -13, -8, 26, 3, "#8a939e"); rect(ctx, -13, 5, 26, 3, "#8a939e");
        const def = TT.TRAP_BY_OBJ[OBJ.DOOR];
        if (tr.hp < def.hp) { rect(ctx, -10, -17, 20, 3, "rgba(0,0,0,0.7)"); rect(ctx, -9.5, -16.5, 19 * tr.hp / def.hp, 2, "#ffb347"); }
      } else if (tr.k === OBJ.SPIKE) {
        rect(ctx, -11, -11, 22, 22, "#333b47");
        const up = tr.cd > 0 ? 0.4 : 1;
        for (let a = -7; a <= 7; a += 7) for (let b = -7; b <= 7; b += 7) poly(ctx, [a - 2, b + 2, a, b + 2 - 6 * up, a + 2, b + 2], "#d8e0ea");
      } else {
        circ(ctx, 0, 0, 11, "#241a22");
        circ(ctx, 0, 0, 7, tr.cd > 0 ? "#5a2a1a" : "#ff7a2c"); circ(ctx, 0, 0, 3.5, tr.cd > 0 ? "#7a3a22" : "#ffd27a");
        ctx.strokeStyle = "#0f0a10"; ctx.lineWidth = 1.5;
        for (let k = -6; k <= 6; k += 4) { ctx.beginPath(); ctx.moveTo(k, -9); ctx.lineTo(k, 9); ctx.stroke(); }
      }
    }
    for (const p of s.pickups) {
      if (!vis(p.idx)) continue;
      at((p.idx % W) + 0.5, ((p.idx / W) | 0) + 0.5);
      rect(ctx, -8, -4, 16, 11, "#6e4c2e"); rect(ctx, -8, -7, 16, 5, "#8a6238");
      rect(ctx, -8, -2.6, 16, 1.6, "#e9b93a"); rect(ctx, -1.5, -3.6, 3, 4, "#f0c341");
    }
    for (const sh of s.shafts) {
      if (!vis(sh)) continue;
      at((sh % W) + 0.5, ((sh / W) | 0) + 0.5);
      ell(ctx, 0, 0, 12, 9, "#050408");
      line(ctx, -5, -10, -5, 8, "#8a6a42", 1.6); line(ctx, 5, -10, 5, 8, "#8a6a42", 1.6);
      for (let k = -8; k <= 6; k += 3.5) line(ctx, -5, k, 5, k, "#8a6a42", 1.3);
    }
    // Tutorial-Pfeil
    if (s._tutTarget >= 0) {
      at((s._tutTarget % W) + 0.5, ((s._tutTarget / W) | 0) + 0.5);
      const b = Math.abs(Math.sin(time * 3)) * 8;
      ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 15, 10, 0, 0, TAU); ctx.stroke();
      poly(ctx, [-8, -26 - b, 8, -26 - b, 0, -12 - b], "#ffcf5a");
      rect(ctx, -3, -40 - b, 6, 15, "#ffcf5a");
    }
    // Siegelsteine: golden, solange der Orden sie hält – violett, sobald sie gebrochen sind
    for (const seal of s.seals || []) {
      if (!vis(seal.idx)) continue;
      at((seal.idx % W) + 0.5, ((seal.idx / W) | 0) + 0.5);
      const glow = seal.taken ? "#b06cff" : "#ffe9a0";
      ell(ctx, 0, 10, 11, 4, "rgba(0,0,0,0.45)");
      ctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 2.5 + seal.idx); circ(ctx, 0, -4, 15, glow); ctx.globalAlpha = 1;
      poly(ctx, [-6, 10, -4, -15, 0, -21, 4, -15, 6, 10], seal.taken ? "#2a1c3a" : "#3a3e4c");
      poly(ctx, [0, -21, 4, -15, 6, 10, 0, 10], "rgba(0,0,0,0.25)");
      ctx.strokeStyle = glow; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 3); ctx.moveTo(-3, -9); ctx.lineTo(3, -5); ctx.moveTo(3, -2); ctx.lineTo(-3, 2); ctx.stroke();
    }
    if (vis(s.rift.idx)) {
      const on = s.rift.on;
      at((s.rift.idx % W) + 0.5, ((s.rift.idx / W) | 0) + 0.5);
      circ(ctx, 0, 0, 13, "#0c0714");
      ctx.lineCap = "round";
      for (let k = 0; k < 4; k++) {
        const a = time * (on ? 1.4 + k * 0.5 : 0.3) * (k % 2 ? -1 : 1) + k;
        ctx.strokeStyle = on ? ["#b06cff", "#7a3fe0", "#e0b0ff", "#5a2ab0"][k] : "#4a4458";
        ctx.lineWidth = 2.2 - k * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, 12 - k * 3, a, a + 2.4); ctx.stroke();
      }
    }
    if (s.pl && vis(s.pl[1 - s.me].coreIdx)) {               // Herzkern des Rivalen
      const o = s.pl[1 - s.me], p = 1 + Math.sin(time * 2.6) * 0.05, hurt = s.time - o.coreHitT < 0.25;
      at((o.coreIdx % W) + 0.5, ((o.coreIdx / W) | 0) + 0.5);
      ell(ctx, 0, 9, 14, 5.5, "#180c0c");
      ctx.save(); ctx.scale(p, p);
      const gr = ctx.createLinearGradient(0, -17, 0, 13);
      gr.addColorStop(0, hurt ? "#ffffff" : "#ffb0a0"); gr.addColorStop(0.55, "#e04a3a"); gr.addColorStop(1, "#7a1a2a");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(9, -6); ctx.lineTo(7, 8); ctx.lineTo(0, 13); ctx.lineTo(-7, 8); ctx.lineTo(-9, -6); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (o.coreHp < B.coreHp) {
        rect(ctx, -16, -25, 32, 4, "rgba(0,0,0,0.75)");
        rect(ctx, -15.3, -24.3, 30.6 * o.coreHp / B.coreHp, 2.6, "#ff6a55");
      }
    }
    if (vis(s.coreIdx)) {
      const p = 1 + Math.sin(time * 2.2) * 0.05, hurt = s.time - s.coreHitT < 0.25;
      at((s.coreIdx % W) + 0.5, ((s.coreIdx / W) | 0) + 0.5);
      ell(ctx, 0, 9, 14, 5.5, "#110c18");
      ctx.save(); ctx.scale(p, p);
      const gr = ctx.createLinearGradient(0, -17, 0, 13);
      gr.addColorStop(0, hurt ? "#ffffff" : "#8ffff0"); gr.addColorStop(0.55, "#37c8e0"); gr.addColorStop(1, "#7a3fe0");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(9, -6); ctx.lineTo(7, 8); ctx.lineTo(0, 13); ctx.lineTo(-7, 8); ctx.lineTo(-9, -6); ctx.closePath(); ctx.fill();
      poly(ctx, [0, -17, 9, -6, 0, -3], "rgba(255,255,255,0.35)"); poly(ctx, [0, -3, 7, 8, 0, 13], "rgba(0,0,0,0.18)");
      ctx.restore();
      if (s.coreHp < B.coreHp) {
        rect(ctx, -16, -25, 32, 4, "rgba(0,0,0,0.75)");
        rect(ctx, -15.3, -24.3, 30.6 * s.coreHp / B.coreHp, 2.6, s.coreHp / B.coreHp < 0.35 ? "#ff6a55" : "#37e0c8");
      }
    }
    if (s.rally && vis(s.rally.idx)) {
      at((s.rally.idx % W) + 0.5, ((s.rally.idx / W) | 0) + 0.5);
      ctx.strokeStyle = "rgba(255,154,92," + (0.5 + 0.3 * Math.sin(time * 6)) + ")"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 8, 14, 6, 0, 0, TAU); ctx.stroke();
      line(ctx, 0, 9, 0, -14, "#8a6c45", 1.6);
      poly(ctx, [0, -14, 11, -10 + Math.sin(time * 7) * 1.5, 0, -6], "#ff7a3c");
    }
    for (const p of s.prisoners) {
      if (!vis(p.idx)) continue;
      at((p.idx % W) + 0.5, ((p.idx / W) | 0) + 0.5);
      ctx.save(); ctx.scale(0.8, 0.8);
      ART[TT.CREATURES[p.type].art || p.type](ctx, { ph: p.idx, dir: 1, nx: -1, mv: false, carry: 0 }, time, 0);
      ctx.restore();
      for (let k = -10; k <= 10; k += 5) rect(ctx, k - 0.7, -13, 1.4, 26, "#8a939e");
      rect(ctx, -11, 12, 22 * Math.min(1, p.t / B.convertTime), 1.6, "#b06cff");
    }

    /* --- 3. Kreaturen (von hinten nach vorn) --- */
    const list = [];
    for (const e of s.ents) {
      if (e.held || e.dead) continue;
      if (e.x < x0 - 1 || e.x > x1 + 2 || e.y < y0 - 1 || e.y > y1 + 2) continue;
      if (s.pl && !e.foe && e.pl !== s.me && !s.seen[TT.tileOf(s, e)]) continue;   // Rivalen im Nebel bleiben verborgen
      list.push(e);
    }
    list.sort(function (a, b) { return a.y - b.y; });
    for (const e of list) {
      // kleine feste Streuung, damit Kreaturen auf demselben Feld nicht exakt übereinander stehen
      const jx = (TT.hash(e.id, 3, 5) - 0.5) * 0.34, jy = (TT.hash(e.id, 9, 5) - 0.5) * 0.3;
      at(e.x + jx, e.y + jy);
      drawCreature(ctx, s, e, time, ui && ui.sel === e.id);
    }
    reset();

    /* --- 4. Effekte --- */
    for (const f of s.fx) {
      const p = Math.max(0, f.t / f.d), sx = ox + f.x * z, sy = oy + f.y * z;
      ctx.globalAlpha = Math.min(1, p * 1.6);
      switch (f.k) {
        case "shot": {
          const ex = ox + f.x2 * z, ey = oy + f.y2 * z, q = 1 - p;
          ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(1, z / 16); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(sx + (ex - sx) * Math.max(0, q - 0.35), sy + (ey - sy) * Math.max(0, q - 0.35));
          ctx.lineTo(sx + (ex - sx) * q, sy + (ey - sy) * q); ctx.stroke();
          break;
        }
        case "hit":
          ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, z / 18);
          ctx.beginPath();
          for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.6, r1 = z * 0.1, r2 = z * (0.2 + 0.25 * (1 - p)); ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1); ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2); }
          ctx.stroke();
          break;
        case "text":
          ctx.font = "bold " + Math.max(10, Math.round(z * 0.36)) + "px 'Segoe UI', sans-serif";
          ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.75)";
          ctx.strokeText(f.text, sx, sy - (1 - p) * z * 0.9); ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy - (1 - p) * z * 0.9);
          break;
        case "ring":
          ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(1.5, z / 10 * p);
          ctx.beginPath(); ctx.arc(sx, sy, f.r * z * (0.25 + 0.75 * (1 - p)), 0, TAU); ctx.stroke();
          ctx.globalAlpha = p * 0.15; ctx.fillStyle = f.color; ctx.fill();
          break;
        case "bolt": {
          ctx.strokeStyle = "#fffbe0"; ctx.lineWidth = Math.max(2, z / 9); ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(sx + z * 0.8, sy - z * 7);
          for (let k = 1; k <= 6; k++) ctx.lineTo(sx + z * 0.8 * (1 - k / 6) + (k < 6 ? (TT.hash(k, f.x * 10 | 0, f.y * 10 | 0) - 0.5) * z : 0), sy - z * 7 * (1 - k / 6));
          ctx.stroke();
          break;
        }
        case "puff":
          for (let k = 0; k < 5; k++) {
            const a = k * 1.26, r = z * 0.45 * (1 - p);
            ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * r, sy + Math.sin(a) * r, z * 0.16 * p + 1, 0, TAU); ctx.fill();
          }
          break;
      }
    }
    ctx.globalAlpha = 1;

    /* --- 5. Licht --- */
    ctx.globalCompositeOperation = "lighter";
    const glow = function (x, y, r, rgb, a) {
      const gx = ox + x * z, gy = oy + y * z, rr = r * z;
      if (gx < -rr || gy < -rr || gx > v.w + rr || gy > v.h + rr) return;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
      gr.addColorStop(0, "rgba(" + rgb + "," + a + ")"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = gr; ctx.fillRect(gx - rr, gy - rr, rr * 2, rr * 2);
    };
    glow((s.coreIdx % W) + 0.5, ((s.coreIdx / W) | 0) + 0.5, 4.2, "55,224,200", 0.2 + 0.05 * Math.sin(time * 2.2));
    if (s.seen[s.rift.idx]) glow((s.rift.idx % W) + 0.5, ((s.rift.idx / W) | 0) + 0.5, 2.6, "176,108,255", s.rift.on ? 0.28 : 0.08);
    for (const sh of s.shafts) if (s.seen[sh]) glow((sh % W) + 0.5, ((sh / W) | 0) + 0.5, 2.4, "255,220,150", 0.16);
    const lit = {};                                  // ein Fackelschein pro Feld, sonst überstrahlt ein Trupp alles
    for (const e of list) {
      if (!e.foe) continue;
      const k = TT.tileOf(s, e);
      if (lit[k]) continue;
      lit[k] = 1;
      glow(e.x, e.y, 2.1, "255,170,80", 0.16);
    }
    ctx.globalCompositeOperation = "source-over";

    /* --- 6. Werkzeugvorschau --- */
    if (ui && ui.hx >= 0 && !ui.overlayOpen) drawPreview(s, ctx, ui, PX, PY, z, ox, oy, time);

    /* --- 7. Vignette und Alarm --- */
    TT.drawVignette(s, v, ctx, time);
  };

  // Abdunklung zum Bildrand und roter Alarmschein (wird von beiden Ansichten benutzt)
  TT.drawVignette = function (s, v, ctx, time) {
    const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h);
    if (s._alarm && !s.over) {
      const ag = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.45, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
      ag.addColorStop(0, "rgba(255,60,40,0)"); ag.addColorStop(1, "rgba(255,60,40," + (0.16 + 0.1 * Math.sin(time * 5)) + ")");
      ctx.fillStyle = ag; ctx.fillRect(0, 0, v.w, v.h);
    }
  };

  /* Was würde das aktuelle Werkzeug hier tun? Liefert betroffene Felder, Farben und Beschriftung.
     Die 2D- und die 3D-Ansicht zeichnen daraus jeweils ihre eigene Vorschau. */
  TT.previewInfo = function (s, ui) {
    const W = s.W, kind = ui.kindNow();
    const tool = kind === ui.tool.kind ? ui.tool : { kind: kind };
    let x0 = ui.hx, y0 = ui.hy, x1 = ui.hx, y1 = ui.hy;
    const rectTool = tool.kind === "dig" || tool.kind === "room" || tool.kind === "sell";
    if (ui.drag && rectTool) {
      x0 = Math.min(ui.drag.x0, ui.drag.x1); x1 = Math.max(ui.drag.x0, ui.drag.x1);
      y0 = Math.min(ui.drag.y0, ui.drag.y1); y1 = Math.max(ui.drag.y0, ui.drag.y1);
    }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(s.H - 1, y1);
    const out = { kind: tool.kind, x0: x0, y0: y0, x1: x1, y1: y1, cells: [], stroke: "#bdb8cc", label: "", radius: 0 };

    if (rectTool) {
      let n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x, t = s.tiles[i];
        if (tool.kind === "dig") {
          const un = ui.drag ? !ui.drag.on : !!s.mark[i];
          if (un) { if (s.mark[i]) { out.cells.push([x, y, "#ff965a", 0.35]); n++; } }
          else if (x > 0 && y > 0 && x < W - 1 && y < s.H - 1 && t < T.FLOOR && !(s.seen[i] && t === T.ROCK) && !s.mark[i]) { out.cells.push([x, y, "#37e0c8", 0.3]); n++; }
        } else if (tool.kind === "room") {
          if (TT.canBuildAt(s, i)) { out.cells.push([x, y, TT.ROOMS[tool.id].color, 0.5]); n++; }
          else if (s.seen[i]) out.cells.push([x, y, "#ff503c", 0.15]);
        } else if (s.room[i] || s.obj[i]) { out.cells.push([x, y, "#ff503c", 0.45]); n++; }
      }
      if (tool.kind === "room") {
        const cost = n * TT.ROOMS[tool.id].cost;
        out.stroke = cost > s.gold ? "#ff6a55" : TT.ROOMS[tool.id].color;
        if (n) out.label = n + (n === 1 ? " Feld · " : " Felder · ") + cost + " Gold";
      } else out.stroke = tool.kind === "dig" ? "#37e0c8" : "#ff6a55";
    } else if (tool.kind === "spell") {
      out.radius = tool.def.radius; out.stroke = "#b06cff";
    } else if (tool.kind === "trap") {
      out.stroke = TT.canBuildAt(s, ui.hy * W + ui.hx) ? "#7dffb0" : "#ff6a55";
    } else if (tool.kind === "hand") {
      out.stroke = "#ffe36e";
      const held = TT.heldCount(s);
      if (held) out.label = held + " im Griff · Rechtsklick setzt ab";
    }
    return out;
  };

  function drawPreview(s, ctx, ui, PX, PY, z, ox, oy, time) {
    const p = TT.previewInfo(s, ui);
    const bx = PX(p.x0), by = PY(p.y0), bw = PX(p.x1 + 1) - bx, bh = PY(p.y1 + 1) - by;
    for (const c of p.cells) {
      ctx.globalAlpha = c[3]; ctx.fillStyle = c[2];
      ctx.fillRect(PX(c[0]), PY(c[1]), PX(c[0] + 1) - PX(c[0]), PY(c[1] + 1) - PY(c[1]));
    }
    ctx.globalAlpha = 1;
    if (p.radius) {
      const cx = ox + (ui.hx + 0.5) * z, cy = oy + (ui.hy + 0.5) * z;
      ctx.strokeStyle = "rgba(176,108,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -time * 20;
      ctx.beginPath(); ctx.arc(cx, cy, p.radius * z, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(176,108,255,0.1)"; ctx.fill();
    }
    ctx.strokeStyle = p.stroke; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    if (p.label) TT.drawLabel(ctx, p.label, bx + 4, by - 7, p.stroke);
  }

  TT.drawLabel = function (ctx, text, x, y, color) {
    ctx.font = "bold 13px 'Segoe UI', sans-serif"; ctx.textAlign = "left";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  };

  /* ---------- Übersichtskarte ---------- */
  // Maßstab der Übersichtskarte: die ganze Karte passt hinein, mittig und unverzerrt
  TT.miniFit = function (s, cw, ch) {
    const k = Math.min(cw / s.W, ch / s.H);
    return { k: k, ox: (cw - s.W * k) / 2, oy: (ch - s.H * k) / 2 };
  };
  TT.drawMini = function (s, v, g, time, poly3d) {
    const W = s.W, H = s.H, fit = TT.miniFit(s, g.canvas.width, g.canvas.height), k = fit.k;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#07060b"; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(1, 0, 0, 1, fit.ox, fit.oy);
    void H;
    const cols = ["#262a40", "#3b2b36", "#e9b93a", "#59f0e0", "#1b151d", "#3c6a78"];
    for (let i = 0; i < s.tiles.length; i++) {
      if (!s.seen[i]) { if (!s.mark[i]) continue; g.fillStyle = "#1f6b62"; }
      else if (s.mark[i]) g.fillStyle = "#37e0c8";
      else if (s.own && s.own[i] && s.own[i] !== s.me + 1 && s.tiles[i] === TT.T.CLAIMED) g.fillStyle = s.room[i] ? "#8a2a22" : "#5a2420";
      else if (s.room[i]) g.fillStyle = TT.ROOMS[s.room[i]].color;
      else g.fillStyle = cols[s.tiles[i]];
      g.fillRect((i % W) * k, ((i / W) | 0) * k, k, k);
    }
    const dot = function (i, c, r) { g.fillStyle = c; g.fillRect((i % W) * k - r + k / 2, ((i / W) | 0) * k - r + k / 2, r * 2, r * 2); };
    for (const sh of s.shafts) dot(sh, "#ffd98a", 2);
    dot(s.rift.idx, Math.sin(time * 4) > 0 || s.rift.on ? "#b06cff" : "#5a3a8a", 2.5);
    dot(s.coreIdx, "#ffffff", 2.5);
    if (s.pl) {
      const o = s.pl[1 - s.me];
      if (s.seen[o.coreIdx]) dot(o.coreIdx, Math.sin(time * 4) > 0 ? "#ff5a44" : "#ffd0c8", 3);
      if (s.seen[o.rift.idx]) dot(o.rift.idx, "#7a3a5a", 2.5);
    }
    if (s._tutTarget >= 0) {
      g.strokeStyle = "#ffcf5a"; g.lineWidth = 1.5; g.beginPath();
      g.arc((s._tutTarget % W) * k + k / 2, ((s._tutTarget / W) | 0) * k + k / 2, 5 + 2 * Math.sin(time * 5), 0, Math.PI * 2); g.stroke();
    }
    for (const seal of s.seals || []) dot(seal.idx, seal.taken ? "#b06cff" : (Math.sin(time * 3) > -0.3 ? "#ffe9a0" : "#a08a50"), 3);
    for (const e of s.ents) {
      if (e.held) continue;
      const riv = !!s.pl && !e.foe && e.pl !== s.me;
      if (riv && !s.seen[TT.tileOf(s, e)]) continue;                  // Rivalen im Nebel bleiben verborgen
      g.fillStyle = e.boss ? "#ffcf5a" : e.foe || riv ? (e.guard ? "#c8503c" : "#ff5a3c") : e.worker ? "#e3b889" : "#9ffcf0";
      const r = e.boss ? 5 : e.foe || riv ? 3 : 2;
      g.fillRect(e.x * k - r / 2, e.y * k - r / 2, r, r);
    }
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1;
    if (poly3d) {
      // 3D-Ansicht: der sichtbare Bodenausschnitt ist ein Trapez
      g.beginPath();
      poly3d.forEach(function (p, j) { if (j) g.lineTo(p[0] * k, p[1] * k); else g.moveTo(p[0] * k, p[1] * k); });
      g.closePath(); g.stroke();
    } else {
      g.strokeRect((v.cx - v.w / 2 / v.zoom) * k + 0.5, (v.cy - v.h / 2 / v.zoom) * k + 0.5, v.w / v.zoom * k, v.h / v.zoom * k);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  };
})();
