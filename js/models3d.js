"use strict";
/* 3D-Modelle: alles wird aus einfachen Körpern (Kugeln, Quader, Zylinder, Kegel) zusammengesetzt
   und pro Modell zu EINER Geometrie mit Farben pro Eckpunkt verschmolzen. Es gibt keine Modelldateien.
   Maße: 1 = ein Kartenfeld. Kreaturen schauen nach +Z, die Füße stehen auf y = 0. */
(function () {
  if (typeof THREE === "undefined") return;
  const M = TT.M3 = {}, PI = Math.PI, TAU = PI * 2;

  /* ---------- Baukasten ---------- */
  const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const unitBall = new THREE.SphereGeometry(0.5, 14, 10).toNonIndexed();
  const unitDome = new THREE.SphereGeometry(0.5, 12, 6, 0, TAU, 0, PI / 2).toNonIndexed();
  const cache = {};
  function cylGeo(rt, rb, seg) {
    const k = "c" + rt.toFixed(3) + "/" + rb.toFixed(3) + "/" + seg;
    return cache[k] || (cache[k] = new THREE.CylinderGeometry(rt, rb, 1, seg).toNonIndexed());
  }
  function torusGeo(R, r) {
    const k = "t" + R.toFixed(3) + "/" + r.toFixed(3);
    return cache[k] || (cache[k] = new THREE.TorusGeometry(R, r, 8, 20).toNonIndexed());
  }

  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _q = new THREE.Quaternion(),
    _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

  function Builder() { this.pos = []; this.nor = []; this.col = []; }
  Builder.prototype.add = function (geo, color, x, y, z, sx, sy, sz, rx, ry, rz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    _n.getNormalMatrix(_m);
    _c.set(color);
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(_m); this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(n, i).applyMatrix3(_n).normalize(); this.nor.push(_v.x, _v.y, _v.z);
      this.col.push(_c.r, _c.g, _c.b);
    }
    return this;
  };
  // Quader: Mitte (x,y,z), Kantenlängen (w,h,d)
  Builder.prototype.box = function (c, x, y, z, w, h, d, rx, ry, rz) { return this.add(unitBox, c, x, y, z, w, h, d, rx, ry, rz); };
  // Ellipsoid: Mitte (x,y,z), Durchmesser (w,h,d)
  Builder.prototype.ball = function (c, x, y, z, w, h, d, rx, ry, rz) { return this.add(unitBall, c, x, y, z, w, h === undefined ? w : h, d === undefined ? w : d, rx, ry, rz); };
  // Halbkugel (Kuppel nach oben), Unterkante bei y
  Builder.prototype.dome = function (c, x, y, z, w, h, d, rx, ry, rz) { return this.add(unitDome, c, x, y, z, w, h * 2, d, rx, ry, rz); };
  // Zylinder/Kegel: Mitte (x,y,z), Radius oben/unten, Höhe
  Builder.prototype.cyl = function (c, x, y, z, rt, rb, h, rx, ry, rz, seg) { return this.add(cylGeo(rt, rb, seg || 10), c, x, y, z, 1, h, 1, rx, ry, rz); };
  Builder.prototype.torus = function (c, x, y, z, R, r, rx, ry, rz) { return this.add(torusGeo(R, r), c, x, y, z, 1, 1, 1, rx, ry, rz); };
  Builder.prototype.build = function () {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  M.Builder = Builder;

  /* ---------- Kreaturen ----------
     Jede Bauanleitung bekommt vier Baukästen:
       B = Körper, G = leuchtende Teile am Körper,
       A = beweglicher Arm / Waffe (Ursprung = Schultergelenk), AG = leuchtende Teile daran. */
  function human(B, A, tunic, legs, skin) {
    B.box(legs, 0.065, 0.1, 0, 0.09, 0.2, 0.1).box(legs, -0.065, 0.1, 0, 0.09, 0.2, 0.1);
    B.box(tunic, 0, 0.33, 0, 0.26, 0.28, 0.16).box("#3a2c22", 0, 0.215, 0, 0.27, 0.04, 0.17);
    B.box(tunic, -0.165, 0.33, 0, 0.07, 0.24, 0.09);
    B.ball(skin, 0, 0.56, 0, 0.2).ball("#1a1014", 0.045, 0.57, 0.09, 0.03, 0.03, 0.02).ball("#1a1014", -0.045, 0.57, 0.09, 0.03, 0.03, 0.02);
    A.box(tunic, 0, -0.11, 0, 0.07, 0.24, 0.09);
  }

  const DEFS = {
    digger: { h: 0.46, pivot: [0.17, 0.22, 0.05], rest: 0.4, swing: 1.3, make: function (B, G, A) {
      B.ball("#c9925a", 0, 0.2, 0, 0.36, 0.32, 0.44).ball("#e3b889", 0, 0.16, 0.06, 0.28, 0.22, 0.34);
      B.cyl("#f0b7a2", 0, 0.2, 0.26, 0.03, 0.09, 0.14, PI / 2).ball("#5a2e2a", 0, 0.2, 0.34, 0.05);
      B.ball("#1a1014", 0.08, 0.27, 0.2, 0.045).ball("#1a1014", -0.08, 0.27, 0.2, 0.045);
      B.dome("#55606e", 0, 0.28, 0.0, 0.32, 0.1, 0.34);
      G.ball("#9ffcf0", 0, 0.37, 0.12, 0.08);
      B.ball("#7a5236", 0.1, 0.04, 0.05, 0.1, 0.07, 0.16).ball("#7a5236", -0.1, 0.04, 0.05, 0.1, 0.07, 0.16);
      A.cyl("#7a5a3a", 0, 0.17, 0, 0.018, 0.018, 0.34).box("#b9c4cf", 0, 0.33, 0, 0.045, 0.05, 0.3);
      A.cyl("#b9c4cf", 0, 0.33, 0.17, 0, 0.03, 0.08, PI / 2).cyl("#b9c4cf", 0, 0.33, -0.17, 0, 0.03, 0.08, -PI / 2);
    }, extra: function (X) { X.ball("#e9b93a", 0, 0.3, -0.2, 0.18, 0.16, 0.16).ball("#fff2a8", 0.03, 0.35, -0.2, 0.06); } },

    schrat: { h: 0.66, pivot: [0.27, 0.34, 0.02], rest: 0.15, swing: 1.5, make: function (B, G, A) {
      B.ball("#5f9a4e", 0, 0.3, 0, 0.52, 0.52, 0.48).ball("#78b565", 0, 0.25, 0.07, 0.4, 0.36, 0.38);
      B.ball("#3f6f38", -0.05, 0.5, -0.05, 0.3, 0.14, 0.28);
      B.ball("#ffe36e", 0.1, 0.4, 0.2, 0.1, 0.1, 0.06).ball("#ffe36e", -0.1, 0.4, 0.2, 0.1, 0.1, 0.06);
      B.ball("#1a1014", 0.1, 0.4, 0.228, 0.045, 0.045, 0.03).ball("#1a1014", -0.1, 0.4, 0.228, 0.045, 0.045, 0.03);
      B.cyl("#f4efe0", 0.09, 0.29, 0.23, 0, 0.03, 0.1).cyl("#f4efe0", -0.09, 0.29, 0.23, 0, 0.03, 0.1);
      B.cyl("#4a7a3e", 0.13, 0.05, 0, 0.07, 0.08, 0.12, 0, 0, 0, 8).cyl("#4a7a3e", -0.13, 0.05, 0, 0.07, 0.08, 0.12, 0, 0, 0, 8);
      B.ball("#5f9a4e", -0.27, 0.3, 0.02, 0.14, 0.2, 0.14);
      A.ball("#5f9a4e", 0, -0.04, 0, 0.14, 0.2, 0.14);
      A.cyl("#6e4c2e", 0, 0.12, 0.08, 0.03, 0.025, 0.36, 0.5).ball("#7d5a36", 0, 0.28, 0.17, 0.13, 0.16, 0.13);
    } },

    spucker: { h: 0.42, make: function (B, G) {
      B.ball("#3d2a33", 0, 0.17, 0, 0.3, 0.24, 0.6).ball("#3d2a33", 0, 0.2, 0.34, 0.24, 0.2, 0.26).ball("#4a3540", 0, 0.17, 0.45, 0.16, 0.1, 0.14);
      B.cyl("#2a1c22", 0, 0.14, -0.44, 0.01, 0.08, 0.4, -PI / 2);
      [[0.15, 0.17], [-0.15, 0.17], [0.15, -0.17], [-0.15, -0.17]].forEach(function (p) { B.ball("#2a1c22", p[0], 0.06, p[1], 0.09, 0.12, 0.11); });
      for (let k = 0; k < 4; k++) B.cyl("#6a4048", 0, 0.32 - k * 0.012, 0.18 - k * 0.14, 0, 0.045, 0.14 - k * 0.015);
      G.ball("#ff8a2c", 0.14, 0.18, 0.08, 0.06, 0.08, 0.1).ball("#ff8a2c", -0.14, 0.18, 0.08, 0.06, 0.08, 0.1);
      G.ball("#ffb347", 0.145, 0.17, -0.1, 0.05, 0.07, 0.09).ball("#ffb347", -0.145, 0.17, -0.1, 0.05, 0.07, 0.09);
      G.ball("#ffb347", 0, 0.11, 0.36, 0.1, 0.06, 0.12);
      G.ball("#ffe36e", 0.085, 0.26, 0.42, 0.05, 0.05, 0.04).ball("#ffe36e", -0.085, 0.26, 0.42, 0.05, 0.05, 0.04);
    } },

    fluesterer: { h: 0.86, hover: 0.08, pivot: [0, 0.45, 0], spin: 1.6, make: function (B, G, A, AG) {
      B.cyl("#27406b", 0, 0.33, 0, 0.08, 0.21, 0.56).box("#35558c", 0, 0.33, 0.15, 0.07, 0.5, 0.03, -0.228);
      B.ball("#1e3256", 0, 0.66, -0.01, 0.26, 0.26, 0.27).ball("#0a0f1c", 0, 0.65, 0.07, 0.17, 0.18, 0.16);
      G.ball("#8fe8ff", 0, 0.655, 0.15, 0.07, 0.07, 0.05);
      B.ball("#27406b", 0.15, 0.42, 0.05, 0.1, 0.16, 0.12).ball("#27406b", -0.15, 0.42, 0.05, 0.1, 0.16, 0.12);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3; AG.ball("#7fe0ff", Math.cos(a) * 0.3, (k - 1) * 0.07, Math.sin(a) * 0.3, 0.05); }
    } },

    eisenwanst: { h: 0.84, pivot: [0.33, 0.42, 0.02], rest: 0.15, swing: 1.4, make: function (B, G, A) {
      B.ball("#7f8b97", 0, 0.34, 0, 0.62, 0.58, 0.56).ball("#a5b1bd", 0, 0.32, 0.1, 0.46, 0.44, 0.4);
      [[0.16, 0.44, 0.255], [-0.16, 0.44, 0.255], [0.14, 0.2, 0.265], [-0.14, 0.2, 0.265]].forEach(function (p) { B.ball("#4b5560", p[0], p[1], p[2], 0.045); });
      B.ball("#6b7783", 0, 0.66, 0.04, 0.24, 0.22, 0.24);
      G.box("#ffb347", 0, 0.66, 0.155, 0.16, 0.035, 0.02);
      B.cyl("#5a6570", 0.16, 0.06, 0, 0.09, 0.1, 0.14, 0, 0, 0, 8).cyl("#5a6570", -0.16, 0.06, 0, 0.09, 0.1, 0.14, 0, 0, 0, 8);
      B.ball("#7f8b97", -0.33, 0.34, 0.02, 0.16, 0.26, 0.16);
      A.ball("#7f8b97", 0, -0.07, 0, 0.16, 0.26, 0.16);
      A.cyl("#5a4636", 0, 0.1, 0.1, 0.022, 0.022, 0.4, 0.5).box("#4b5560", 0, 0.27, 0.19, 0.12, 0.12, 0.2, 0.5);
    } },

    klinge: { h: 0.82, pivot: [0, 0.44, 0.05], rest: -0.2, swing: 1.3, make: function (B, G, A) {
      B.ball("#b8478a", 0, 0.34, 0, 0.24, 0.52, 0.22).ball("#d679ae", 0, 0.32, 0.04, 0.16, 0.4, 0.16);
      B.ball("#b8478a", 0, 0.66, 0.02, 0.2);
      G.box("#ffffff", 0, 0.67, 0.115, 0.13, 0.025, 0.02);
      for (let k = 0; k < 3; k++) B.cyl("#7d2a5c", 0, 0.53 - k * 0.13, -0.14, 0, 0.035, 0.18, -1.1);
      B.cyl("#8a3068", 0.06, 0.07, 0, 0.03, 0.035, 0.16).cyl("#8a3068", -0.06, 0.07, 0, 0.03, 0.035, 0.16);
      A.ball("#b8478a", 0.13, 0, 0.02, 0.08, 0.1, 0.14).ball("#b8478a", -0.13, 0, 0.02, 0.08, 0.1, 0.14);
      A.box("#f3d9e9", 0.15, 0.03, 0.22, 0.025, 0.07, 0.44, -0.2, 0.2).box("#e8c5dc", -0.15, 0.03, 0.22, 0.025, 0.07, 0.44, -0.2, -0.2);
    } },

    nachtmahr: { h: 0.98, hover: 0.06, pivot: [0, 0.3, 0], spin: -0.9, make: function (B, G, A) {
      B.cyl("#3d2468", 0, 0.2, 0, 0.26, 0.4, 0.36, 0, 0, 0, 12).ball("#553392", 0, 0.5, 0, 0.7, 0.72, 0.66);
      B.ball("#3d2468", 0, 0.6, -0.1, 0.6, 0.6, 0.5).ball("#12081f", 0, 0.38, 0.27, 0.32, 0.14, 0.14);
      G.ball("#f0c8ff", -0.12, 0.62, 0.3, 0.1, 0.1, 0.06).ball("#f0c8ff", 0.1, 0.66, 0.31, 0.08, 0.08, 0.05).ball("#f0c8ff", 0.02, 0.52, 0.335, 0.06, 0.06, 0.04);
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; B.cyl("#2a1848", Math.cos(a) * 0.32, 0.07, Math.sin(a) * 0.32, 0.07, 0, 0.2); }
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4; A.ball("#2a1848", Math.cos(a) * 0.5, (k % 2) * 0.16, Math.sin(a) * 0.5, 0.13, 0.1, 0.13); }
    } },

    miliz: { h: 0.74, pivot: [0.165, 0.44, 0], rest: 0.1, swing: 1.0, make: function (B, G, A) {
      human(B, A, "#a98f62", "#4a3a2c", "#e8c9a0");
      B.cyl("#8a939e", 0, 0.615, 0, 0.17, 0.17, 0.02, 0, 0, 0, 14).dome("#8a939e", 0, 0.62, 0, 0.21, 0.08, 0.21);
      B.cyl("#6e4c2e", -0.19, 0.4, 0.08, 0.015, 0.015, 0.3, 0.3);
      G.ball("#ff9a2c", -0.19, 0.58, 0.135, 0.09, 0.13, 0.09).ball("#fff2a8", -0.19, 0.57, 0.135, 0.05, 0.07, 0.05);
      A.cyl("#6e4c2e", 0, 0.05, 0.08, 0.012, 0.012, 0.78, 0.25).cyl("#d8e0ea", 0, 0.44, 0.18, 0, 0.03, 0.1, 0.25);
    } },

    schuetze: { h: 0.74, pivot: [0.165, 0.42, 0], rest: 0, swing: -0.35, make: function (B, G, A) {
      human(B, { box: function () { return this; } }, "#5f7248", "#3a3226", "#e8c9a0");
      B.ball("#3f4f30", 0, 0.58, -0.035, 0.24).box("#6e4c2e", 0.05, 0.36, -0.105, 0.06, 0.22, 0.05, 0, 0, 0.3);
      A.box("#5f7248", 0, -0.02, 0.1, 0.07, 0.08, 0.24);
      A.box("#6e4c2e", -0.08, -0.03, 0.26, 0.04, 0.04, 0.32).box("#b9c4cf", -0.08, -0.03, 0.38, 0.32, 0.025, 0.025);
    } },

    sappeur: { h: 0.74, pivot: [0.165, 0.44, 0], rest: 0.3, swing: 1.1, make: function (B, G, A) {
      human(B, A, "#8a6a4a", "#3a3226", "#e0b890");
      B.cyl("#e8c33c", 0, 0.605, 0.02, 0.14, 0.14, 0.02, 0, 0, 0, 14).dome("#e8c33c", 0, 0.61, 0, 0.22, 0.09, 0.22);
      G.ball("#fff7c8", 0, 0.66, 0.1, 0.06);
      A.cyl("#6e4c2e", 0, 0.0, 0.1, 0.014, 0.014, 0.5, 0.6).box("#aab4c0", 0, 0.223, 0.252, 0.11, 0.14, 0.02, 0.6);
    } },

    priester: { h: 0.84, pivot: [0.165, 0.44, 0], rest: 0.1, swing: 0.6, make: function (B, G, A, AG) {
      B.cyl("#e8e4d8", 0, 0.24, 0, 0.11, 0.2, 0.46).box("#d4b24a", 0, 0.25, 0.155, 0.04, 0.42, 0.02, -0.19);
      B.box("#e8e4d8", -0.165, 0.36, 0, 0.07, 0.22, 0.09);
      B.ball("#e8c9a0", 0, 0.56, 0, 0.2).ball("#1a1014", 0.045, 0.57, 0.09, 0.03, 0.03, 0.02).ball("#1a1014", -0.045, 0.57, 0.09, 0.03, 0.03, 0.02);
      G.torus("#ffe9a0", 0, 0.74, 0, 0.11, 0.012, PI / 2);
      A.box("#e8e4d8", 0, -0.1, 0, 0.07, 0.22, 0.09).cyl("#8a6c45", 0, 0.08, 0.07, 0.014, 0.014, 0.8);
      AG.ball("#fff3b0", 0, 0.5, 0.07, 0.1);
    } },

    ritter: { h: 0.88, pivot: [0.19, 0.44, 0], rest: 0.1, swing: 1.4, make: function (B, G, A) {
      B.box("#6b7480", 0.07, 0.1, 0, 0.1, 0.2, 0.11).box("#6b7480", -0.07, 0.1, 0, 0.1, 0.2, 0.11);
      B.box("#9aa6b5", 0, 0.34, 0, 0.3, 0.3, 0.19).box("#6b7480", 0, 0.215, 0, 0.31, 0.04, 0.2);
      B.ball("#b7c2cf", 0.18, 0.47, 0, 0.13, 0.1, 0.15).ball("#b7c2cf", -0.18, 0.47, 0, 0.13, 0.1, 0.15);
      B.box("#9aa6b5", -0.19, 0.33, 0, 0.08, 0.24, 0.1);
      B.ball("#b7c2cf", 0, 0.6, 0, 0.22).box("#1a1014", 0, 0.6, 0.105, 0.13, 0.025, 0.02);
      B.cyl("#d0433c", 0, 0.74, -0.04, 0, 0.045, 0.18, -0.5);
      B.box("#3a62b8", -0.24, 0.32, 0.1, 0.03, 0.3, 0.22).box("#e9eef5", -0.258, 0.32, 0.1, 0.01, 0.24, 0.04).box("#e9eef5", -0.258, 0.36, 0.1, 0.01, 0.04, 0.16);
      A.box("#9aa6b5", 0, -0.11, 0, 0.08, 0.24, 0.1);
      A.box("#d8e0ea", 0, 0.045, 0.15, 0.02, 0.5, 0.045, 0.45).box("#8a6c45", 0, -0.19, 0.035, 0.12, 0.025, 0.03, 0.45);
    } },

    vogt: { h: 0.96, pivot: [0.19, 0.44, 0], rest: 0.1, swing: 1.5, make: function (B, G, A, AG) {
      B.box("#f1ead2", 0, 0.3, -0.13, 0.32, 0.46, 0.03, 0.18);
      B.box("#a8842a", 0.07, 0.1, 0, 0.1, 0.2, 0.11).box("#a8842a", -0.07, 0.1, 0, 0.1, 0.2, 0.11);
      B.box("#e0b23a", 0, 0.34, 0, 0.3, 0.3, 0.19).box("#a8842a", 0, 0.215, 0, 0.31, 0.04, 0.2);
      B.ball("#f3cf63", 0.19, 0.48, 0, 0.16, 0.12, 0.17).ball("#f3cf63", -0.19, 0.48, 0, 0.16, 0.12, 0.17);
      B.box("#e0b23a", -0.19, 0.33, 0, 0.08, 0.24, 0.1);
      B.ball("#f3cf63", 0, 0.6, 0, 0.22).box("#1a1014", 0, 0.6, 0.105, 0.13, 0.025, 0.02);
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5; G.cyl("#fff3b0", Math.cos(a) * 0.075, 0.73, Math.sin(a) * 0.075, 0, 0.02, 0.07); }
      G.torus("#fff3b0", 0, 0.85, 0, 0.15, 0.014, PI / 2);
      A.box("#e0b23a", 0, -0.11, 0, 0.08, 0.24, 0.1).box("#a8842a", 0, -0.19, 0.035, 0.16, 0.03, 0.035, 0.45);
      AG.box("#fff8d8", 0, 0.14, 0.195, 0.03, 0.72, 0.06, 0.45);
    } },
  };

  const built = {};
  M.creature = function (type) {
    if (built[type]) return built[type];
    const d = DEFS[type], B = new Builder(), G = new Builder(), A = new Builder(), AG = new Builder(), X = new Builder();
    d.make(B, G, A, AG);
    if (d.extra) d.extra(X);
    return (built[type] = {
      lit: B.build(), glow: G.build(), arm: A.build(), armGlow: AG.build(), extra: X.build(),
      pivot: d.pivot || [0, 0, 0], rest: d.rest || 0, swing: d.swing || 0, spin: d.spin || 0,
      h: d.h, hover: d.hover || 0,
    });
  };

  /* ---------- Einrichtung und Objekte ---------- */
  const PROPS = {
    nest: function (B) {
      B.cyl("#2c2132", 0, 0.02, 0, 0.27, 0.27, 0.03, 0, 0, 0, 14).torus("#6b5236", 0, 0.07, 0, 0.3, 0.075, PI / 2);
      for (let k = 0; k < 7; k++) { const a = k * 0.9; B.box("#8a6c45", Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3, 0.2, 0.02, 0.025, 0, a + 1.2, 0.3); }
    },
    dummy: function (B) {
      B.cyl("#3c2a1f", 0, 0.02, 0, 0.12, 0.14, 0.04).cyl("#6e4c2e", 0, 0.25, 0, 0.035, 0.045, 0.5);
      B.box("#6e4c2e", 0, 0.36, 0, 0.4, 0.05, 0.05).ball("#b08d55", 0, 0.33, 0, 0.2, 0.26, 0.16).ball("#c9a56a", 0, 0.54, 0, 0.16);
      B.box("#d0433c", 0, 0.34, 0.082, 0.07, 0.07, 0.01);
    },
    shelf: function (B, G) {
      B.box("#4a3424", 0, 0.3, 0, 0.5, 0.6, 0.16);
      const cols = ["#8a3a3a", "#3a5a8a", "#3a7a5a", "#8a7a3a", "#6a3a8a", "#c9b79a"];
      for (let row = 0; row < 3; row++) {
        let x = -0.21;
        for (let k = 0; x < 0.17; k++) {
          const w = 0.035 + ((k * 7 + row * 3) % 4) * 0.012;
          B.box(cols[(k * 5 + row * 2) % cols.length], x + w / 2, 0.11 + row * 0.19, 0.035, w, 0.13 - (k % 3) * 0.015, 0.12);
          x += w + 0.006;
        }
      }
      B.cyl("#e8e4d8", 0.18, 0.63, 0, 0.015, 0.015, 0.06);
      G.ball("#ffd27a", 0.18, 0.69, 0, 0.035, 0.06, 0.035);
    },
    anvil: function (B, G) {
      B.box("#3a3f47", 0, 0.08, 0, 0.2, 0.16, 0.16).box("#4b5560", 0, 0.2, 0, 0.12, 0.1, 0.12).box("#5c6672", 0, 0.29, 0, 0.36, 0.08, 0.16);
      B.cyl("#5c6672", 0.24, 0.29, 0, 0, 0.04, 0.14, 0, 0, -PI / 2);
      G.box("#ff9a3c", -0.06, 0.335, 0, 0.14, 0.012, 0.04);
    },
    brazier: function (B, G) {
      B.cyl("#2a2028", 0, 0.1, 0, 0.17, 0.1, 0.14, 0, 0, 0, 10).cyl("#2a2028", 0, 0.02, 0, 0.12, 0.14, 0.04, 0, 0, 0, 10);
      G.ball("#ff7a2c", 0, 0.17, 0, 0.27, 0.09, 0.27).ball("#ffd27a", 0.02, 0.19, 0.01, 0.12, 0.07, 0.12);
    },
    cage: function (B) {
      const c = 0.42;
      [[c, c], [-c, c], [c, -c], [-c, -c]].forEach(function (p) { B.cyl("#59626e", p[0], 0.36, p[1], 0.022, 0.022, 0.72, 0, 0, 0, 6); });
      for (let k = -1; k <= 1; k++) {
        const o = k * 0.21;
        B.cyl("#6c7682", o, 0.36, c, 0.012, 0.012, 0.72, 0, 0, 0, 5).cyl("#6c7682", o, 0.36, -c, 0.012, 0.012, 0.72, 0, 0, 0, 5);
        B.cyl("#6c7682", c, 0.36, o, 0.012, 0.012, 0.72, 0, 0, 0, 5).cyl("#6c7682", -c, 0.36, o, 0.012, 0.012, 0.72, 0, 0, 0, 5);
      }
      B.box("#4b5560", 0, 0.72, c, 0.88, 0.035, 0.035).box("#4b5560", 0, 0.72, -c, 0.88, 0.035, 0.035);
      B.box("#4b5560", c, 0.72, 0, 0.035, 0.035, 0.88).box("#4b5560", -c, 0.72, 0, 0.035, 0.035, 0.88);
    },
    chest: function (B) {
      B.box("#6e4c2e", 0, 0.12, 0, 0.42, 0.22, 0.28).cyl("#8a6238", 0, 0.23, 0, 0.14, 0.14, 0.42, 0, 0, PI / 2);
      B.box("#e9b93a", 0, 0.2, 0, 0.44, 0.04, 0.3).box("#f0c341", 0, 0.18, 0.145, 0.06, 0.08, 0.02);
      B.box("#e9b93a", 0.15, 0.2, 0, 0.03, 0.3, 0.3).box("#e9b93a", -0.15, 0.2, 0, 0.03, 0.3, 0.3);
    },
    door: function (B) {
      const w = ["#5a4030", "#664a36", "#52392b", "#604432", "#5a4030"];
      for (let k = 0; k < 5; k++) B.box(w[k], -0.4 + k * 0.2, 0.47, 0, 0.19, 0.94, 0.12);
      B.box("#8a939e", 0, 0.25, 0, 1.0, 0.07, 0.15).box("#8a939e", 0, 0.7, 0, 1.0, 0.07, 0.15);
      for (let k = -2; k <= 2; k++) B.ball("#c3ccd6", k * 0.2, 0.25, 0.08, 0.04).ball("#c3ccd6", k * 0.2, 0.7, 0.08, 0.04).ball("#c3ccd6", k * 0.2, 0.25, -0.08, 0.04).ball("#c3ccd6", k * 0.2, 0.7, -0.08, 0.04);
    },
    spikeplate: function (B) {
      B.box("#333b47", 0, 0.02, 0, 0.8, 0.04, 0.8);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) B.cyl("#1c2028", a * 0.25, 0.042, b * 0.25, 0.05, 0.05, 0.006, 0, 0, 0, 8);
    },
    spikes: function (B) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) B.cyl("#d8e0ea", a * 0.25, 0.15, b * 0.25, 0, 0.045, 0.3, 0, 0, 0, 6);
    },
    flametrap: function (B, G) {
      B.cyl("#241a22", 0, 0.03, 0, 0.4, 0.42, 0.06, 0, 0, 0, 14);
      G.cyl("#ff7a2c", 0, 0.055, 0, 0.3, 0.3, 0.02, 0, 0, 0, 14);
      for (let k = -2; k <= 2; k++) B.box("#0f0a10", k * 0.13, 0.07, 0, 0.03, 0.02, 0.62 - Math.abs(k) * 0.1);
    },
    shaft: function (B) {
      B.cyl("#050408", 0, 0.012, 0, 0.42, 0.42, 0.02, 0, 0, 0, 16).torus("#3a3038", 0, 0.03, 0, 0.42, 0.05, PI / 2);
      B.box("#8a6a42", 0.13, 1.1, -0.1, 0.035, 2.3, 0.035, 0.1).box("#8a6a42", -0.13, 1.1, -0.1, 0.035, 2.3, 0.035, 0.1);
      for (let k = 0; k < 9; k++) B.box("#8a6a42", 0, 0.12 + k * 0.25, -0.2 + k * 0.025, 0.26, 0.03, 0.03, 0.1);
    },
    banner: function (B) {
      B.cyl("#8a6c45", 0, 0.5, 0, 0.02, 0.02, 1.0).ball("#e9b93a", 0, 1.02, 0, 0.06);
      B.box("#ff7a3c", 0.2, 0.82, 0, 0.36, 0.24, 0.02).box("#ffd0a0", 0.2, 0.82, 0.012, 0.1, 0.1, 0.005, 0, 0, PI / 4);
    },
    // Wandfackel: gedacht für ein Bodenfeld, dessen Wand im Norden (z = -0.5) liegt
    torch: function (B, G) {
      B.box("#3a2c22", 0, 0.5, -0.47, 0.07, 0.07, 0.08).cyl("#6e4c2e", 0, 0.57, -0.4, 0.024, 0.016, 0.24, 0.35);
      B.cyl("#2a2028", 0, 0.67, -0.365, 0.045, 0.03, 0.04, 0.35);
      G.ball("#ff9a2c", 0, 0.73, -0.345, 0.09, 0.15, 0.09).ball("#fff2a8", 0, 0.715, -0.345, 0.045, 0.085, 0.045);
    },
    mushstem: function (B) { B.cyl("#d8d0c0", 0, 0.08, 0, 0.022, 0.032, 0.16, 0, 0, 0, 7); },
    mushcap: function (B) { B.dome("#39c9a0", 0, 0.14, 0, 0.2, 0.07, 0.2).ball("#b9fff0", -0.03, 0.2, 0.02, 0.05, 0.02, 0.05); },
    goldpile: function (B) {
      B.cyl("#d9a82a", 0, 0.05, 0, 0.03, 0.16, 0.1, 0, 0, 0, 9);
      for (let k = 0; k < 6; k++) { const a = k * 1.05; B.cyl(k % 2 ? "#f0c341" : "#c9972a", Math.cos(a) * 0.13, 0.012 + (k % 3) * 0.02, Math.sin(a) * 0.13, 0.045, 0.045, 0.014, 0.3 * (k % 2), 0, 0.2, 9); }
      B.ball("#fff2a8", 0.02, 0.105, 0.01, 0.045, 0.03, 0.045);
    },
    nugget: function (B) { B.ball("#f0c341", 0, 0, 0, 0.14, 0.1, 0.12).ball("#fff2a8", 0.02, 0.03, 0.02, 0.05, 0.035, 0.045); },
    shard: function (B) { B.cyl("#ffffff", 0, 0.2, 0, 0, 0.09, 0.4, 0, 0, 0, 5); },
    pedestal: function (B, G) {
      B.cyl("#1c1826", 0, 0.07, 0, 0.4, 0.47, 0.14, 0, 0, 0, 8).cyl("#2a2438", 0, 0.17, 0, 0.3, 0.36, 0.08, 0, 0, 0, 8);
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.39; G.box("#37e0c8", Math.cos(a) * 0.44, 0.08, Math.sin(a) * 0.44, 0.02, 0.06, 0.06, 0, -a, 0); }
    },
    crystal: function (B) {
      B.cyl("#ffffff", 0, 0.34, 0, 0, 0.27, 0.68, 0, 0, 0, 6).cyl("#ffffff", 0, -0.14, 0, 0.27, 0, 0.28, 0, 0, 0, 6);
    },
  };

  const props = {};
  M.prop = function (name) {
    if (props[name]) return props[name];
    const B = new Builder(), G = new Builder();
    PROPS[name](B, G);
    return (props[name] = { lit: B.build(), glow: G.build() });
  };
})();
