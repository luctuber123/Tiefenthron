"use strict";
/* 3D-Ansicht mit Three.js. Sie liest nur den Spielzustand – die Spielregeln wissen nichts von 3D.
   Koordinaten: Kartenfeld (x, y) liegt in der Welt bei X = x, Z = y; Y zeigt nach oben. */
(function () {
  const V3 = TT.V3 = { ok: false };
  if (typeof THREE === "undefined" || !TT.M3) return;

  const T = TT.T, OBJ = TT.OBJ, ID = TT.ROOM_ID, B = TT.BAL, M = TT.M3, PI = Math.PI, TAU = PI * 2;
  const WH = 1.0;                        // Wandhöhe in Feldern
  const FOV = 38;

  let renderer, scene, camera, sun, hemi, lights = [], mat = {}, mk = {}, sig = null, lastState = null, lastFill = -1;
  let frame = 0, pxScale = 1000, camDist = 20, spots = [], goldTiles = [], lightSpots = [], torches = [], flames = [];
  // Wo Kreaturen stehen, die sich ein Feld teilen (damit sie nicht ineinander stecken)
  const SLOTS = [[0, 0], [0.27, 0.1], [-0.27, 0.1], [0.08, -0.28], [-0.13, 0.3], [0.3, -0.2], [-0.3, -0.18]];
  let coreGrp, crystal, riftGrp, riftRings = [], riftOn = null, shaftObjs = [], banner, selRing, spellRing, spellDisc;
  let glowPts, dustPts, parts = [], rings = [], bolts = [], prisoners = [];
  let rq = 0, slow = 0;                  // Renderqualität (1 = volle Auflösung) und Zähler für zu langsame Bilder
  const ents = new Map();

  const _mat4 = new THREE.Matrix4(), _pos = new THREE.Vector3(), _quat = new THREE.Quaternion(), _scl = new THREE.Vector3(),
    _col = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _d = new THREE.Vector3();

  function rgb(hex) {                    // "#rrggbb" oder Zahl -> [r, g, b] in 0..1 (Bildschirmwerte)
    const n = typeof hex === "number" ? hex : parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  /* ============================================================
     Texturen: die 2D-Kacheln in vierfacher Auflösung, etwas veredelt
     ============================================================ */
  function copy(c) {
    const n = document.createElement("canvas");
    n.width = c.width; n.height = c.height;
    n.getContext("2d").drawImage(c, 0, 0);
    return n;
  }
  function ctxOf(c) { const g = c.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; return g; }
  function grain(c, amt, seed) {         // feines Rauschen, damit Flächen nicht nach Plastik aussehen
    const g = ctxOf(c), im = g.getImageData(0, 0, c.width, c.height), d = im.data, r = TT.rng(seed);
    for (let i = 0; i < d.length; i += 4) { const k = 1 + (r() - 0.5) * amt; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    g.putImageData(im, 0, 0);
    return c;
  }
  function darken(c, a) { const g = ctxOf(c); g.fillStyle = "rgba(4,3,8," + a + ")"; g.fillRect(0, 0, c.width, c.height); return c; }
  // aufhellen / einfärben: in 3D kommt weniger Licht an als auf der flachen 2D-Karte
  function gain(c, kr, kg, kb) {
    if (kg === undefined) { kg = kr; kb = kr; }
    const g = ctxOf(c), im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * kr); d[i + 1] = Math.min(255, d[i + 1] * kg); d[i + 2] = Math.min(255, d[i + 2] * kb); }
    g.putImageData(im, 0, 0);
    return c;
  }
  function soft(c, px) {                 // harte Pixelkanten der 2D-Kacheln etwas verwischen
    const n = document.createElement("canvas");
    n.width = c.width; n.height = c.height;
    const g = n.getContext("2d");
    g.drawImage(c, 0, 0);
    if ("filter" in g) { g.filter = "blur(" + px + "px)"; g.drawImage(c, 0, 0); g.filter = "none"; }
    return n;
  }
  function strata(c, seed) {             // Wandseiten: Erdschichten, unten dunkler
    const g = ctxOf(c), w = c.width, r = TT.rng(seed);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.045)"; g.fillRect(0, r() * w, w, 2 + r() * 5); }
    const gr = g.createLinearGradient(0, w * 0.45, 0, w);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.5)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(0, 0, w, 3);
    return c;
  }
  function edges(c, a) {                 // dunkle Fugen rund um die Bodenplatte
    const g = ctxOf(c), w = c.width, e = w * 0.09;
    [[0, 0, e, 0, 0, 0, e, w], [w, 0, w - e, 0, w - e, 0, e, w], [0, 0, 0, e, 0, 0, w, e], [0, w, 0, w - e, 0, w - e, w, e]].forEach(function (q) {
      const gr = g.createLinearGradient(q[0], q[1], q[2], q[3]);
      gr.addColorStop(0, "rgba(0,0,0," + a + ")"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(q[4], q[5], q[6], q[7]);
    });
    return c;
  }
  function tex(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  /* ============================================================
     Kleine Helfer für Instanzen (viele gleiche Objekte in einem Zeichenaufruf)
     ============================================================ */
  function inst(geo, material, cap, cast, recv, noColor) {
    const m = new THREE.InstancedMesh(geo, material, cap);
    m.count = 0; m.frustumCulled = false; m.castShadow = !!cast; m.receiveShadow = !!recv;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (!noColor) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    scene.add(m);
    return m;
  }
  function put(m, x, y, z, sx, sy, sz, ry, r, g, b) {
    const i = m.count;
    if (i >= m.instanceMatrix.count) return;
    m.count = i + 1;
    _quat.setFromAxisAngle(_up, ry || 0);
    _mat4.compose(_pos.set(x, y, z), _quat, _scl.set(sx, sy, sz));
    m.setMatrixAt(i, _mat4);
    if (m.instanceColor) m.instanceColor.setXYZ(i, r === undefined ? 1 : r, g === undefined ? 1 : g, b === undefined ? 1 : b);
  }
  function done(m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

  /* ============================================================
     Leuchtpunkte und Partikel (ein einziger Zeichenaufruf pro Sorte)
     ============================================================ */
  function makePoints(cap, additive, map) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("cell", new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage));
    // Die Textur ist ein Bogen mit 2 x 2 Bildern; "cell" wählt eines davon: 0 Leuchtpunkt, 1 Flamme, 2 Rauch, 3 Stern
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, pxScale: { value: 1000 } },
      vertexShader:
        "attribute vec4 tint; attribute float size; attribute float cell; varying vec4 vTint; varying vec2 vCell; uniform float pxScale;\n" +
        "void main() { vTint = tint; vCell = vec2(mod(cell, 2.0), floor(cell / 2.0)); vec4 mv = modelViewMatrix * vec4(position, 1.0);\n" +
        "  gl_PointSize = size * pxScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader:
        "uniform sampler2D map; varying vec4 vTint; varying vec2 vCell;\n" +
        "void main() { float a = texture2D(map, (vCell + gl_PointCoord) * 0.5).r * vTint.a; if (a < 0.004) discard; gl_FragColor = vec4(vTint.rgb, a); }",
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const p = new THREE.Points(geo, material);
    p.frustumCulled = false; p.renderOrder = additive ? 6 : 5;
    p.userData = { n: 0, cap: cap };
    scene.add(p);
    return p;
  }
  const DOT = 0, FLAME = 1, SMOKE = 2, STAR = 3;          // Bilder im Partikelbogen
  function pt(p, x, y, z, size, c, a, cell) {
    const u = p.userData, i = u.n;
    if (i >= u.cap) return;
    u.n = i + 1;
    p.geometry.attributes.position.setXYZ(i, x, y, z);
    p.geometry.attributes.tint.setXYZW(i, c[0], c[1], c[2], a);
    p.geometry.attributes.size.setX(i, size);
    p.geometry.attributes.cell.setX(i, cell || 0);
  }
  function flushPoints(p) {
    const g = p.geometry;
    g.setDrawRange(0, p.userData.n);
    g.attributes.position.needsUpdate = true; g.attributes.tint.needsUpdate = true;
    g.attributes.size.needsUpdate = true; g.attributes.cell.needsUpdate = true;
    p.material.uniforms.pxScale.value = pxScale * rq;
    p.userData.n = 0;
  }
  // Partikel: add = leuchtend (additiv), sonst Staub/Brocken. cell = Bild, al = Deckkraft (0..1)
  function emit(add, x, y, z, vx, vy, vz, life, size, c, grav, cell, al) {
    if (parts.length > 900) return;
    parts.push({ add: add, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, life: life, max: life, size: size, c: c, grav: grav || 0, cell: cell || 0, al: al === undefined ? 1 : al });
  }
  function burst(add, x, y, z, n, speed, life, size, c, grav, up, cell, al) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8);
      emit(add, x, y, z, Math.cos(a) * s, (up || 0) + Math.random() * speed, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.7), c, grav, cell, al);
    }
  }

  /* ============================================================
     Einmaliger Aufbau der Szene
     ============================================================ */
  V3.init = function (canvas) {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    } catch (err) { return false; }
    if (!renderer.getContext()) return false;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06050a);
    scene.fog = new THREE.FogExp2(0x06050a, 0.015);
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 240);

    // Umgebungslicht fürs Glänzen von Gold, Rüstungen und Kristallen
    const es = new THREE.Scene(), eg = new THREE.SphereGeometry(10, 24, 12), ec = [], ep = eg.attributes.position;
    for (let i = 0; i < ep.count; i++) { const t = (ep.getY(i) / 10 + 1) / 2; ec.push(0.03 + 0.3 * t, 0.03 + 0.34 * t, 0.06 + 0.46 * t); }
    eg.setAttribute("color", new THREE.Float32BufferAttribute(ec, 3));
    es.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    [[0xfff0d0, 5, 6, 6, 3, 1.7], [0x66ffe6, 3, -6, 4, -4, 1.3], [0xb080ff, 2, 2, 3, -7, 1.1]].forEach(function (q) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(q[5], 12, 8), new THREE.MeshBasicMaterial({ color: q[0] }));
      m.material.color.multiplyScalar(q[1]); m.position.set(q[2], q[3], q[4]); es.add(m);
    });
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0.03).texture;
    pm.dispose();

    // Licht: weiches Grundlicht, ein schräges Hauptlicht mit Schatten, dazu einige Punktlichter
    hemi = new THREE.HemisphereLight(0xa8b4ff, 0x40304a, 2.2);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff1dc, 3.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    scene.add(sun); scene.add(sun.target);
    for (let k = 0; k < 6; k++) { const l = new THREE.PointLight(0xffffff, 0, 9, 2); l.position.set(0, -50, 0); scene.add(l); lights.push(l); }

    /* --- Materialien --- */
    mat.lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.06, envMapIntensity: 0.55 });
    mat.hurt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, emissive: 0xffffff, emissiveIntensity: 0.75 });
    mat.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    mat.gold = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.8, emissive: 0x6a4200, emissiveIntensity: 0.55 });
    mat.cap = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0x1fbf96, emissiveIntensity: 0.9 });
    mat.shardA = new THREE.MeshStandardMaterial({ color: 0x59f0e0, roughness: 0.15, metalness: 0.1, flatShading: true, emissive: 0x1fb8a8, emissiveIntensity: 0.9, envMapIntensity: 1.6 });
    mat.shardB = new THREE.MeshStandardMaterial({ color: 0xc58bff, roughness: 0.15, metalness: 0.1, flatShading: true, emissive: 0x7a3fe0, emissiveIntensity: 0.9, envMapIntensity: 1.6 });
    mat.crystal = new THREE.MeshStandardMaterial({ color: 0x7ff5ee, roughness: 0.12, metalness: 0.15, flatShading: true, emissive: 0x1fa8c8, emissiveIntensity: 1.3, envMapIntensity: 1.8 });
    mat.rift = new THREE.MeshBasicMaterial({ color: 0xb06cff, toneMapped: false });
    mat.riftOff = new THREE.MeshBasicMaterial({ color: 0x4a4458 });
    mat.mark = new THREE.MeshBasicMaterial({ color: 0x37e0c8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    mat.pre = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    mat.cone = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

    /* --- Texturen --- */
    const k4 = function (kind) { return TT.tileCanvas(kind, 4); };
    // Erde wird warm-braun, Fels schieferblau, Unerforschtes bleibt fast schwarz
    const earth = grain(gain(soft(k4("earth"), 1.4), 1.85, 1.55, 1.22), 0.16, 1), rock = grain(gain(soft(k4("rock"), 1.5), 1.5), 0.1, 2),
      gold = grain(gain(soft(k4("gold"), 1.2), 1.85, 1.55, 1.2), 0.1, 3), gem = grain(gain(soft(k4("gem"), 1.2), 1.7, 1.55, 1.4), 0.1, 4),
      fog = grain(soft(k4("fog"), 3), 0.2, 5);
    const wallMats = function (base, topDark, seed) {
      const side = new THREE.MeshStandardMaterial({ map: tex(strata(copy(base), seed)), roughness: 0.95, envMapIntensity: 0.25 });
      const top = new THREE.MeshStandardMaterial({ map: tex(edges(darken(copy(base), topDark), 0.35)), roughness: 1, envMapIntensity: 0.2 });
      return [side, side, top, side, side, side];        // Reihenfolge der Würfelseiten: +x -x +y -y +z -z
    };
    const floorMat = function (c, rough) {
      return new THREE.MeshStandardMaterial({ map: tex(c), roughness: rough, metalness: 0.02, envMapIntensity: 0.45 });
    };

    const n = TT.W * TT.H;
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-PI / 2);

    mk.earth = inst(box, wallMats(earth, 0.2, 11), n, true, true);
    mk.rock = inst(box, wallMats(rock, 0.12, 12), n, true, true);
    mk.gold = inst(box, wallMats(gold, 0.1, 13), 600, true, true);
    mk.gem = inst(box, wallMats(gem, 0.1, 14), 60, true, true);
    mk.fog = inst(box, wallMats(fog, 0.35, 15), n, true, true);
    mk.dirt = inst(plane, floorMat(edges(grain(gain(soft(k4("floor"), 1.4), 2.3, 1.9, 1.7), 0.16, 6), 0.3), 1), n, false, true);
    mk.claimed = inst(plane, floorMat(edges(grain(gain(soft(k4("claimed"), 1), 1.3), 0.1, 7), 0.4), 0.8), n, false, true);
    mk.roomFloor = [null];
    for (let id = 1; id < TT.ROOMS.length; id++) {
      mk.roomFloor[id] = inst(plane, floorMat(edges(grain(gain(soft(k4(TT.ROOMS[id].key), 0.8), 1.3), 0.1, 20 + id), 0.4), 0.8), 900, false, true);
    }
    mk.mark = inst(box, mat.mark, n, false, false, true);
    mk.mark.renderOrder = 3;
    mk.pre = inst(box, mat.pre, n + 8, false, false);
    mk.pre.renderOrder = 4;

    // Einrichtung
    const P = function (name) { return M.prop(name); };
    mk.nest = inst(P("nest").lit, mat.lit, 400, true, true);
    mk.mushStem = inst(P("mushstem").lit, mat.lit, 900, true, false);
    mk.mushCap = inst(P("mushcap").lit, mat.cap, 900, true, false);
    mk.pile = inst(P("goldpile").lit, mat.gold, 1500, true, false);
    mk.nugget = inst(P("nugget").lit, mat.gold, 1800, false, false);
    mk.shardA = inst(P("shard").lit, mat.shardA, 200, true, false, true);
    mk.shardB = inst(P("shard").lit, mat.shardB, 200, true, false, true);
    mk.dummy = inst(P("dummy").lit, mat.lit, 300, true, true);
    mk.shelf = inst(P("shelf").lit, mat.lit, 300, true, true);
    mk.shelfGlow = inst(P("shelf").glow, mat.glow, 300, false, false, true);
    mk.anvil = inst(P("anvil").lit, mat.lit, 300, true, true);
    mk.anvilGlow = inst(P("anvil").glow, mat.glow, 300, false, false, true);
    mk.brazier = inst(P("brazier").lit, mat.lit, 300, true, true);
    mk.brazierGlow = inst(P("brazier").glow, mat.glow, 300, false, false, true);
    mk.cage = inst(P("cage").lit, mat.lit, 300, true, true);
    mk.torch = inst(P("torch").lit, mat.lit, 500, false, false);
    mk.torchGlow = inst(P("torch").glow, mat.glow, 500, false, false, true);
    mk.chest = inst(P("chest").lit, mat.lit, 16, true, true);
    mk.door = inst(P("door").lit, mat.lit, 200, true, true);
    mk.plate = inst(P("spikeplate").lit, mat.lit, 200, false, true);
    mk.spikes = inst(P("spikes").lit, mat.lit, 200, true, false);
    mk.flame = inst(P("flametrap").lit, mat.lit, 200, false, true);
    mk.flameGlow = inst(P("flametrap").glow, mat.glow, 200, false, false);

    // Boden unter allem
    const base = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x050409 }));
    base.rotation.x = -PI / 2; base.position.set(TT.W / 2, -0.03, TT.H / 2);
    scene.add(base);

    // Herzkern
    coreGrp = new THREE.Group();
    const ped = new THREE.Mesh(P("pedestal").lit, mat.lit); ped.castShadow = true; ped.receiveShadow = true;
    coreGrp.add(ped); coreGrp.add(new THREE.Mesh(P("pedestal").glow, mat.glow));
    crystal = new THREE.Mesh(P("crystal").lit, mat.crystal); crystal.castShadow = true;
    coreGrp.add(crystal);
    scene.add(coreGrp);

    // Riss
    riftGrp = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshBasicMaterial({ color: 0x0c0714 }));
    disc.rotation.x = -PI / 2; disc.position.y = 0.02; riftGrp.add(disc);
    for (let k = 0; k < 4; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.44 - k * 0.09, 0.022 - k * 0.003, 6, 28, 4.2), mat.riftOff);
      r.rotation.x = -PI / 2; r.position.y = 0.06 + k * 0.05;
      riftGrp.add(r); riftRings.push(r);
    }
    scene.add(riftGrp);

    // Kriegstrommel-Banner, Auswahlring, Zauberkreis
    banner = new THREE.Mesh(P("banner").lit, mat.lit); banner.castShadow = true; banner.visible = false; scene.add(banner);
    selRing = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.4, 28), new THREE.MeshBasicMaterial({ color: 0x37e0c8, toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }));
    selRing.rotation.x = -PI / 2; selRing.visible = false; selRing.renderOrder = 4; scene.add(selRing);
    spellRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 56), new THREE.MeshBasicMaterial({ color: 0xb06cff, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
    spellRing.rotation.x = -PI / 2; spellRing.visible = false; spellRing.renderOrder = 7; scene.add(spellRing);
    spellDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 56), new THREE.MeshBasicMaterial({ color: 0xb06cff, transparent: true, opacity: 0.1, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    spellDisc.rotation.x = -PI / 2; spellDisc.visible = false; spellDisc.renderOrder = 7; scene.add(spellDisc);

    // Leuchtpunkte und Staub
    const gc = document.createElement("canvas"); gc.width = gc.height = 64;
    const gg = gc.getContext("2d"), gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.25, "#bbb"); gr.addColorStop(0.6, "#333"); gr.addColorStop(1, "#000");
    gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64);
    // Partikelbogen: 2 x 2 Bilder. Zuerst überall der weiche Leuchtpunkt, dann – sobald geladen –
    // Flamme, Rauch und Stern aus assets/fx (fehlen sie, bleibt es beim Punkt).
    const AT = 256, ac = document.createElement("canvas");
    ac.width = ac.height = AT * 2;
    const ag = ac.getContext("2d");
    for (let k = 0; k < 4; k++) ag.drawImage(gc, (k % 2) * AT, ((k / 2) | 0) * AT, AT, AT);
    const dot = new THREE.CanvasTexture(ac);
    dot.flipY = false; dot.generateMipmaps = false; dot.minFilter = THREE.LinearFilter;
    if (globalThis.TT_FX) {
      [["flame", FLAME], ["smoke", SMOKE], ["star", STAR]].forEach(function (q) {
        const im = new Image();
        im.onload = function () {
          const x = (q[1] % 2) * AT, y = ((q[1] / 2) | 0) * AT;
          ag.fillStyle = "#000"; ag.fillRect(x, y, AT, AT);
          ag.drawImage(im, x, y, AT, AT);
          dot.needsUpdate = true;
        };
        im.src = globalThis.TT_FX[q[0]];
      });
    }
    dustPts = makePoints(700, false, dot);
    glowPts = makePoints(2600, true, dot);

    if (TT.A3) TT.A3.load();                 // fertige Kreaturenmodelle im Hintergrund auspacken
    // Umgebung aus fertigen Bauteilen aufbauen; fehlen sie, bleibt es bei den selbstgemalten Flächen
    if (TT.A3 && TT.A3.hasEnv()) {
      try { buildEnv(); env = true; } catch (err) { console.warn("Umgebungsbauteile nicht nutzbar:", err); env = false; }
    }
    V3.ok = true;
    return true;
  };

  /* ============================================================
     Karte: Wände, Böden, Einrichtung
     ============================================================ */
  function mapChanged(s) {
    const n = s.tiles.length;
    if (!sig || sig.length !== n) { sig = new Uint16Array(n); sig.fill(65535); }
    let ch = false;
    for (let i = 0; i < n; i++) {
      const t = s.tiles[i];
      const dq = s.dig[i] > 0 ? Math.min(3, 1 + ((s.dig[i] / B.digTime * 3) | 0)) : 0;
      const oq = t === T.GOLD ? 3 - Math.min(3, (s.ore[i] / B.oreGold * 3.99) | 0) : 0;
      const v = t | (s.room[i] << 3) | (s.seen[i] << 7) | (s.mark[i] << 8) | (dq << 9) | (oq << 11) | (s.food[i] << 13);
      if (sig[i] !== v) { sig[i] = v; ch = true; }
    }
    const fq = Math.round(s.gold / TT.goldCap(s) * 5);
    if (fq !== lastFill) { lastFill = fq; ch = true; }
    return ch;
  }

  const MAPSET = ["earth", "rock", "gold", "gem", "fog", "dirt", "claimed", "mark", "nest", "mushStem", "mushCap", "pile", "nugget",
    "shardA", "shardB", "dummy", "shelf", "shelfGlow", "anvil", "anvilGlow", "brazier", "brazierGlow", "cage", "torch", "torchGlow"];

  /* ---------- Umgebung aus fertigen Bauteilen (assets/env) ----------
     Maße der Bauteile: Wandstück 4 x 4 x 1, kleine Bodenplatte 2 x 2. Ein Kartenfeld ist 1 x 1,
     deshalb werden Wände auf ein Viertel und Bodenplatten auf die Hälfte verkleinert. */
  let env = false;                       // true, sobald die Bauteile vorhanden und aufgebaut sind
  const ENVSET = [], FY = -0.025;        // FY: Bodenplatten leicht absenken, damit ihre Oberseite auf Höhe 0 liegt
  const COINS = ["coinS", "coinM", "coinS", "coinL", "coinM"];
  // Raum -> Bodenbelag und Einfärbung (Rot, Grün, Blau), damit man Räume weiter auf einen Blick erkennt
  const ROOM_FLOOR = {};
  ROOM_FLOOR[ID.treasury] = ["fTile", 1.5, 1.15, 0.5];
  ROOM_FLOOR[ID.lair] = ["fWoodD", 1.25, 1.0, 1.9];
  ROOM_FLOOR[ID.garden] = ["dirt", 0.7, 1.5, 0.75];
  ROOM_FLOOR[ID.training] = ["fWood", 1.5, 1.05, 0.85];
  ROOM_FLOOR[ID.archive] = ["fWoodD", 0.85, 1.3, 2.1];
  ROOM_FLOOR[ID.forge] = ["fTile", 0.62, 0.6, 0.7];
  ROOM_FLOOR[ID.prison] = ["fTile", 1.35, 0.6, 0.9];

  function envMesh(key, name, cap, cast, perFrame) {
    const p = TT.A3.prop(name);
    if (!p) throw new Error("Bauteil fehlt: " + name);
    mk[key] = inst(p.geo, p.mat, cap, cast, true);
    if (!perFrame) ENVSET.push(key);
  }
  function buildEnv() {
    const n = TT.W * TT.H;
    envMesh("fTile", "floor_tile_small", n, false); envMesh("fBrokA", "floor_tile_small_broken_A", 600, false);
    envMesh("fBrokB", "floor_tile_small_broken_B", 600, false); envMesh("fWeeds", "floor_tile_small_weeds_A", 400, false);
    envMesh("fDirt0", "floor_dirt_small_A", n, false); envMesh("fDirt1", "floor_dirt_small_B", n, false);
    envMesh("fDirt2", "floor_dirt_small_C", n, false); envMesh("fDirt3", "floor_dirt_small_D", n, false);
    envMesh("fWood", "floor_wood_small", 900, false); envMesh("fWoodD", "floor_wood_small_dark", 1500, false);
    envMesh("wall", "wall", 2600, true); envMesh("wCrack", "wall_cracked", 400, true);
    envMesh("wGate", "wall_gated", 400, true); envMesh("wShelf", "wall_shelves", 400, true);
    envMesh("pillar", "pillar", 1600, true);
    envMesh("torchM", "torch_mounted", 700, false); envMesh("banner", "banner_patternB_blue", 400, false);
    envMesh("swordShield", "sword_shield", 300, false);
    envMesh("coinS", "coin_stack_small", 1800, true); envMesh("coinM", "coin_stack_medium", 1800, true); envMesh("coinL", "coin_stack_large", 900, true);
    envMesh("chestG", "chest_gold", 300, true); envMesh("chestGLid", "chest_gold#chest_gold_lid", 300, true);
    envMesh("bedFloor", "bed_floor", 900, true); envMesh("bedFrame", "bed_frame", 400, true);
    envMesh("lantern", "lantern_standing", 300, true);
    envMesh("table", "table_medium_decorated_A", 400, true); envMesh("books", "book_set", 400, true); envMesh("candles", "candle_triple", 400, false);
    envMesh("keg", "keg", 300, true); envMesh("barrel", "barrel_large", 300, true);
    envMesh("skull", "skull", 300, true); envMesh("boneA", "bone_A", 300, false); envMesh("boneB", "bone_B", 300, false); envMesh("ribcage", "ribcage", 300, true);
    envMesh("rubble", "rubble_half", 800, true);
    // wenige Objekte, die jedes Bild neu gesetzt werden
    envMesh("doorW", "wall_doorway", 200, true, true); envMesh("doorLeaf", "wall_doorway#wall_doorway_door", 200, true, true);
    envMesh("spikeBase", "floor_tile_big_spikes", 200, false, true); envMesh("spikeTop", "floor_tile_big_spikes#spikes", 200, true, true);
    envMesh("grate", "floor_tile_grate", 200, false, true);
    envMesh("chestE", "chest", 16, true, true); envMesh("chestELid", "chest#chest_lid", 16, true, true);
  }
  // Wandfackeln: Richtung zur Wand (dx, dy) und passende Drehung des Fackelmodells
  const TORCH_DIR = [[0, -1, 0], [1, 0, -PI / 2], [0, 1, PI], [-1, 0, PI / 2]];
  const MUSH = [[-0.22, -0.13], [0.19, 0.03], [-0.06, 0.25]];
  const PILE = [[0, 0.06], [-0.24, 0.22], [0.24, 0.2], [-0.14, -0.2], [0.2, -0.22]];
  const C_FLAME = [1, 0.58, 0.2], C_FLAME_IN = [1, 0.93, 0.62];
  const C_MUSH = rgb("#39e0b0"), C_FIRE = rgb("#ff8a3c"), C_CANDLE = rgb("#ffd27a"), C_TEAL = rgb("#59f0e0"), C_VIO = rgb("#b06cff");

  function rebuildMap(s) {
    const W = s.W, H = s.H, fill = s.gold / TT.goldCap(s);
    MAPSET.forEach(function (k) { mk[k].count = 0; });
    for (let id = 1; id < mk.roomFloor.length; id++) mk.roomFloor[id].count = 0;
    ENVSET.forEach(function (k) { mk[k].count = 0; });
    spots = []; goldTiles = []; lightSpots = []; torches = []; flames = [];

    // Welche Erd- und Felsblöcke grenzen an dein Reich? Sie bekommen eine gemauerte Wand vorgesetzt.
    // (Gold- und Kristalladern bleiben frei sichtbar, markierte Blöcke ebenfalls.)
    let walled = null, corners = null;
    if (env) {
      walled = new Uint8Array(W * H); corners = new Uint8Array((W + 1) * (H + 1));
      for (let i = W; i < W * H - W; i++) {
        if (s.tiles[i] !== T.CLAIMED) continue;
        for (let k = 0; k < 4; k++) {
          const j = i + TORCH_DIR[k][0] + TORCH_DIR[k][1] * W, tj = s.tiles[j];
          if (s.seen[j] && !s.mark[j] && (tj === T.EARTH || tj === T.ROCK)) walled[j] = 1;
        }
      }
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, cx = x + 0.5, cz = y + 0.5;
      const hv = TT.hash(x, y, 7), h2 = TT.hash(x, y, 13);
      const rot = ((hv * 4) | 0) * PI / 2, tint = 0.84 + h2 * 0.28;
      const t = s.tiles[i];

      if (!s.seen[i]) {
        put(mk.fog, cx, 0, cz, 1, WH * 1.03, 1, rot, tint, tint, tint);
        if (s.mark[i]) put(mk.mark, cx, 0, cz, 1.03, WH * 1.03 + 0.03, 1.03, 0);
        continue;
      }
      if (t < T.FLOOR) {
        let hgt = t === T.ROCK ? 1.05 + hv * 0.22 : 0.95 + hv * 0.13, dark = 1;
        if (env && walled[i]) hgt = 0.97;                   // knapp unter der Mauerkrone, damit die Wand sauber abschließt
        if (s.dig[i] > 0) { const f = Math.min(1, s.dig[i] / B.digTime); hgt *= 1 - 0.45 * f; dark = 1 - 0.3 * f; }
        if (t === T.GOLD) hgt *= 1 - 0.4 * (1 - s.ore[i] / B.oreGold);
        const top = WH * hgt, c = tint * dark;
        put(t === T.ROCK ? mk.rock : t === T.EARTH ? mk.earth : t === T.GOLD ? mk.gold : mk.gem, cx, 0, cz, 1, top, 1, rot, c, c, c);
        if (s.mark[i]) put(mk.mark, cx, 0, cz, 1.03, top + 0.03, 1.03, 0);
        if (t === T.GOLD) {
          goldTiles.push(i);
          for (let k = 0; k < 3; k++) {
            const a = TT.hash(x, y, 40 + k), b = TT.hash(x, y, 50 + k), sz = 0.8 + a * 0.9;
            put(mk.nugget, cx + (a - 0.5) * 0.7, top + 0.02, cz + (b - 0.5) * 0.7, sz, sz, sz, a * 6);
          }
        } else if (t === T.GEM) {
          for (let k = 0; k < 5; k++) {
            const a = TT.hash(x, y, 60 + k), b = TT.hash(x, y, 70 + k), sz = 0.7 + a * 0.8;
            put(k % 2 ? mk.shardB : mk.shardA, cx + (a - 0.5) * 0.7, top - 0.06, cz + (b - 0.5) * 0.7, sz, sz * (0.8 + b), sz, a * 6);
          }
          spots.push([cx, top + 0.25, cz, 2.2, C_TEAL, 0.22, hv * 6]);
        }
        continue;
      }

      // Boden
      const room = s.room[i];
      if (env) {
        const c = (0.9 + h2 * 0.16) * 0.43;                    // die hellen Steinplatten abdunkeln: es ist ein Dungeon
        if (t === T.FLOOR) {                                  // roher, noch nicht beanspruchter Gang
          put(mk["fDirt" + ((hv * 4) | 0)], cx, FY, cz, 0.5, 0.5, 0.5, rot, c * 0.9, c * 0.84, c * 0.86);
          if (TT.hash(x, y, 35) < 0.05) put(mk.rubble, cx - 0.2, 0, cz + (h2 - 0.5) * 0.3, 0.1, 0.1, 0.1, hv * 6);
        } else if (!room) {                                   // dein Boden: Steinplatten, ab und zu gesprungen oder bewachsen
          const r = TT.hash(x, y, 33);
          put(r < 0.06 ? mk.fBrokA : r < 0.12 ? mk.fBrokB : r < 0.16 ? mk.fWeeds : mk.fTile, cx, FY, cz, 0.5, 0.5, 0.5, rot, c, c, c);
        } else {
          const f = ROOM_FLOOR[room], dirt = f[0] === "dirt";
          put(dirt ? mk["fDirt" + ((hv * 4) | 0)] : mk[f[0]], cx, FY, cz, 0.5, 0.5, 0.5, dirt ? rot : 0, f[1] * c, f[2] * c, f[3] * c);
        }
      } else put(t === T.CLAIMED ? (room ? mk.roomFloor[room] : mk.claimed) : mk.dirt, cx, 0, cz, 1, 1, 1, room ? 0 : rot, tint, tint, tint);
      if (s.mark[i]) put(mk.mark, cx, 0, cz, 1.03, 0.06, 1.03, 0);

      // Wände, Fackeln und Wandschmuck rund um dein Reich
      if (t === T.CLAIMED) {
        for (let k = 0; k < 4; k++) {
          const q = TORCH_DIR[k], j = i + q[0] + q[1] * W, along = q[0] ? y : x;
          if (!env) {                                         // ohne Bauteile: nur die selbstgebaute Fackel am nackten Block
            if (along % 3 !== 1 || !s.seen[j] || s.tiles[j] >= T.FLOOR || s.mark[j]) continue;
            put(mk.torch, cx, 0, cz, 1, 1, 1, q[2]); put(mk.torchGlow, cx, 0, cz, 1, 1, 1, q[2]);
            torches.push([cx + q[0] * 0.345, cz + q[1] * 0.345, hv * 6, 0.74]);
            continue;
          }
          if (!walled[j]) continue;
          // Wandstück auf die Feldgrenze setzen, Vorderseite zum Raum gedreht
          const a = Math.atan2(-q[0], -q[1]), bx = cx + q[0] * 0.5, bz = cz + q[1] * 0.5;
          const hw = TT.hash(x * 4 + k, y, 41), wt = 0.9 + hw * 0.16;
          put(room === ID.archive ? mk.wShelf : room === ID.prison ? mk.wGate : hw < 0.07 ? mk.wCrack : mk.wall, bx, 0, bz, 0.25, 0.262, 0.25, a, wt, wt, wt);
          // Eckpunkte merken: wo Längs- und Querwand zusammenstoßen, kommt später ein Pfeiler hin
          const v1 = (q[0] > 0 ? x + 1 : x) + (q[1] > 0 ? y + 1 : y) * (W + 1), flag = q[0] ? 2 : 1;
          corners[v1] |= flag; corners[q[0] ? v1 + W + 1 : v1 + 1] |= flag;
          // Schmuck an der Wand
          if (room !== ID.archive && room !== ID.prison && along % 3 === 1) {
            put(mk.torchM, cx + q[0] * 0.37, 0.5, cz + q[1] * 0.37, 0.42, 0.42, 0.42, a);
            torches.push([cx + q[0] * 0.2, cz + q[1] * 0.2, hv * 6 + k, 0.82]);
          } else if (room === ID.training && along % 3 === 0) put(mk.swordShield, cx + q[0] * 0.36, 0.56, cz + q[1] * 0.36, 0.3, 0.3, 0.3, a);
          else if (!room && along % 3 === 2 && hw > 0.55) put(mk.banner, bx, 0, bz, 0.25, 0.25, 0.25, a);
        }
      }
      if (!room) continue;

      if (room === ID.lair) {
        if (env) {
          put((x + 2 * y) % 4 === 0 ? mk.bedFrame : mk.bedFloor, cx, 0, cz, 0.27, 0.27, 0.27, ((hv * 2) | 0) * PI / 2);
          if ((x * 3 + y) % 7 === 0) {
            put(mk.lantern, cx + 0.35, 0, cz - 0.35, 0.28, 0.28, 0.28, hv * 6);
            spots.push([cx + 0.35, 0.16, cz - 0.35, 0.9, C_CANDLE, 0.4, hv * 6]);
          }
        } else put(mk.nest, cx, 0.005, cz, 1, 1, 1, rot);
      } else if (room === ID.garden) {
        for (let k = 0; k < s.food[i]; k++) {
          const sz = 0.85 + TT.hash(x, y, 20 + k) * 0.6, mx = cx + MUSH[k][0] + (TT.hash(x, y, 80 + k) - 0.5) * 0.1, mz = cz + MUSH[k][1];
          put(mk.mushStem, mx, 0, mz, sz, sz, sz, 0);
          put(mk.mushCap, mx, 0, mz, sz, sz, sz, hv * 6);
          spots.push([mx, 0.2 * sz, mz, 0.75 * sz, C_MUSH, 0.3, h2 * 6 + k]);
        }
      } else if (room === ID.treasury) {
        const nP = fill > 0.02 ? Math.max(1, Math.min(5, Math.round(fill * 5 + hv - 0.5))) : 0;
        for (let k = 0; k < nP; k++) {
          if (env) put(mk[COINS[k]], cx + PILE[k][0], 0, cz + PILE[k][1], 0.27, 0.27, 0.27, k * 1.3 + hv * 6);
          else { const sz = 0.9 + TT.hash(x, y, 90 + k) * 0.5; put(mk.pile, cx + PILE[k][0], 0.005, cz + PILE[k][1], sz, sz, sz, k * 1.3); }
        }
        if (env && fill > 0.3 && (x + y) % 4 === 0) {         // hier und da eine offene Goldtruhe
          put(mk.chestG, cx, 0, cz - 0.26, 0.24, 0.24, 0.24, 0); put(mk.chestGLid, cx, 0, cz - 0.26, 0.24, 0.24, 0.24, 0);
        }
      } else if (room === ID.training) {
        if ((x + 2 * y) % 4 === 0) put(mk.dummy, cx + 0.27, 0, cz - 0.27, 1, 1, 1, hv * 6);
      } else if (room === ID.archive) {
        if (env) {
          const pt3 = (2 * x + y) % 3;
          if (pt3 === 0) put(mk.table, cx + 0.2, 0, cz - 0.2, 0.2, 0.2, 0.2, rot);
          else if (pt3 === 1) {
            put(mk.books, cx - 0.25, 0.075, cz + 0.25, 0.3, 0.3, 0.3, hv * 6);
            put(mk.candles, cx - 0.04, 0, cz + 0.31, 0.3, 0.3, 0.3, hv * 6);
            spots.push([cx - 0.02, 0.27, cz + 0.31, 0.6, C_CANDLE, 0.3, hv * 6]);
            flames.push([cx - 0.02, 0.27, cz + 0.31, 0.26, hv * 6]);
          }
        } else if ((2 * x + y) % 3 === 0) {
          put(mk.shelf, cx, 0, cz - 0.38, 1, 1, 1, 0); put(mk.shelfGlow, cx, 0, cz - 0.38, 1, 1, 1, 0);
          spots.push([cx + 0.18, 0.72, cz - 0.38, 0.6, C_CANDLE, 0.4, hv * 6]);
        }
      } else if (room === ID.forge) {
        if ((x + 2 * y) % 4 === 0) { put(mk.anvil, cx + 0.2, 0, cz - 0.2, 1, 1, 1, rot); put(mk.anvilGlow, cx + 0.2, 0, cz - 0.2, 1, 1, 1, rot); }
        else if ((x + 2 * y) % 4 === 2) {
          put(mk.brazier, cx - 0.2, 0, cz - 0.2, 1, 1, 1, 0); put(mk.brazierGlow, cx - 0.2, 0, cz - 0.2, 1, 1, 1, 0);
          spots.push([cx - 0.2, 0.25, cz - 0.2, 1.5, C_FIRE, 0.3, hv * 6]);
          flames.push([cx - 0.2, 0.2, cz - 0.2, 0.8, hv * 6]);
          lightSpots.push([cx - 0.2, cz - 0.2, 0xff8a3c, 9, 5]);
        } else if (env) {                                     // dazwischen Fässer als Lager
          if ((x + 2 * y) % 4 === 1) put(mk.keg, cx - 0.27, 0, cz - 0.27, 0.15, 0.15, 0.15, rot);
          else put(mk.barrel, cx + 0.28, 0, cz - 0.28, 0.16, 0.16, 0.16, hv * 6);
        }
      } else if (room === ID.prison) {
        put(mk.cage, cx, 0, cz, 1, 1, 1, 0);
        if (env) {                                            // Überreste früherer Gäste
          const hb = TT.hash(x, y, 37);
          if (hb < 0.3) put(mk.skull, cx + 0.2, 0, cz + 0.22, 0.17, 0.17, 0.17, hv * 6);
          else if (hb < 0.55) put(mk.boneA, cx - 0.2, 0.04, cz + 0.2, 0.3, 0.3, 0.3, hv * 6);
          else if (hb < 0.7) put(mk.ribcage, cx + 0.15, 0.09, cz - 0.18, 0.22, 0.22, 0.22, hv * 6);
          else if (hb < 0.85) put(mk.boneB, cx + 0.2, 0.03, cz - 0.2, 0.3, 0.3, 0.3, hv * 6);
        }
      }
    }
    if (env) {
      // Pfeiler an allen Ecken, an denen zwei Wandrichtungen aufeinandertreffen
      for (let v = 0; v < corners.length; v++) if (corners[v] === 3) put(mk.pillar, v % (W + 1), 0, (v / (W + 1)) | 0, 0.2, 0.27, 0.2, 0);
      ENVSET.forEach(function (k) { done(mk[k]); });
    }
    MAPSET.forEach(function (k) { done(mk[k]); });
    for (let id = 1; id < mk.roomFloor.length; id++) done(mk.roomFloor[id]);
  }

  /* ============================================================
     Kreaturen
     ============================================================ */
  function makeCreature(type) {
    const md = M.creature(type), g = new THREE.Group(), tilt = new THREE.Group();
    g.add(tilt);
    const inst = TT.A3 ? TT.A3.instance(type) : null;
    if (inst) {
      // Fertiges Modell mit Skelett-Animation (assets/models). Der Goldsack des Wühlers bleibt selbstgebaut.
      tilt.add(inst.obj);
      let sack = null;
      if (md.extra) { sack = new THREE.Mesh(md.extra, mat.gold); sack.visible = false; tilt.add(sack); }
      return { type: type, md: { h: inst.h, hover: inst.hover }, model: true, inst: inst, base: null, baseName: "", atkT: 0, lastCd: 0, hurtOn: false,
        g: g, tilt: tilt, body: null, arm: null, armMesh: null, extra: sack, band: null,
        yaw: Math.random() * TAU, walk: 0, px: 0, pz: 0, ox: 0, oz: 0, slot: 0, init: false, stamp: 0, e: null, emitT: Math.random() };
    }
    // Sonst: die aus Grundkörpern zusammengesetzte Figur
    const body = new THREE.Mesh(md.lit, mat.lit); body.castShadow = true; tilt.add(body);
    if (md.glow) tilt.add(new THREE.Mesh(md.glow, mat.glow));
    let arm = null, armMesh = null;
    if (md.arm || md.armGlow) {
      arm = new THREE.Group(); arm.position.fromArray(md.pivot);
      if (md.arm) { armMesh = new THREE.Mesh(md.arm, mat.lit); armMesh.castShadow = true; arm.add(armMesh); }
      if (md.armGlow) arm.add(new THREE.Mesh(md.armGlow, mat.glow));
      tilt.add(arm);
    }
    let extra = null;
    if (md.extra) { extra = new THREE.Mesh(md.extra, mat.gold); extra.visible = false; tilt.add(extra); }
    return { type: type, md: md, g: g, tilt: tilt, body: body, arm: arm, armMesh: armMesh, extra: extra, band: null,
      yaw: Math.random() * TAU, walk: 0, px: 0, pz: 0, ox: 0, oz: 0, slot: 0, init: false, stamp: 0, e: null, emitT: Math.random() };
  }

  function dropCreature(o) {
    scene.remove(o.g);
    if (o.model) { o.inst.mixer.stopAllAction(); o.inst.mats.forEach(function (m) { m.dispose(); }); }
  }

  /* ---------- Animation der fertigen Modelle ---------- */
  function loopAct(a) {
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false;
    a.setEffectiveTimeScale(1); a.setEffectiveWeight(1);
    return a;
  }

  function poseModel(o, e, def, time, dt, sc, asleep, working) {
    const A = o.inst.acts, lying = asleep && !A.sleep;

    // Grundbewegung (Ruhe, Laufen, Arbeiten, Schlafen) – weich ineinander überblenden
    let want = "idle";
    if (asleep && A.sleep) want = "sleep";
    else if (o.walk > 0.45) want = "walk";
    else if (working && A.work) want = "work";
    if (want !== o.baseName || !o.base) {
      const next = A[want] || A.idle, prev = o.base;
      o.baseName = want;
      if (next && next !== prev) {
        o.base = next;
        if (o.atkT > 0) { if (prev && prev !== A.attack) prev.stop(); }       // läuft gerade ein Angriff, nur vormerken
        else { loopAct(next); if (prev) next.crossFadeFrom(prev, 0.18, false); next.play(); }
      }
    }

    // Angriff: einmal abspielen, sobald die Spiellogik zugeschlagen oder geschossen hat
    if (e.cd > o.lastCd + 0.05 && A.attack && (o.base !== A.attack || o.atkT > 0)) {
      const atk = A.attack, dur = atk.getClip().duration, ts = Math.max(1, dur / Math.max(0.35, def.cd * 0.95));
      if (o.base && o.base !== atk && o.atkT <= 0) o.base.fadeOut(0.06);
      atk.reset(); atk.setLoop(THREE.LoopOnce, 1); atk.clampWhenFinished = true;
      atk.setEffectiveTimeScale(ts); atk.setEffectiveWeight(1); atk.fadeIn(0.06); atk.play();
      o.atkT = dur / ts;
    }
    o.lastCd = e.cd;
    if (o.atkT > 0) {
      o.atkT -= dt;
      if (o.atkT <= 0) {
        const atk = A.attack;
        if (o.base === atk) loopAct(atk).play();
        else { atk.fadeOut(0.15); if (o.base) loopAct(o.base).fadeIn(0.15).play(); }
      }
    }
    o.inst.mixer.update(dt);

    o.tilt.position.y = lying ? 0.1 * sc : (o.md.hover ? Math.sin(time * 2 + e.ph) * 0.03 : 0);
    o.tilt.rotation.z = lying ? 1.35 : 0;                    // Monster ohne Schlaf-Animation legen sich auf die Seite
    o.tilt.rotation.x = 0;
    o.tilt.scale.setScalar(sc);
    const hurt = e.hurt > 0;
    if (hurt !== o.hurtOn) {
      o.hurtOn = hurt;
      for (const m of o.inst.mats) { m.emissive.setHex(hurt ? 0xffffff : 0x000000); m.emissiveIntensity = hurt ? 0.6 : 1; }
    }
  }

  const bandGeo = new THREE.TorusGeometry(0.3, 0.025, 6, 24);
  let bandMat = null;

  function animate(o, e, s, time, dt) {
    const def = TT.CREATURES[e.type], md = o.md;
    // Platz auf dem Feld: weich dorthin gleiten, wo gerade frei ist
    const sl = SLOTS[o.slot % SLOTS.length], wx = sl[0] + (TT.hash(e.id, 3, 5) - 0.5) * 0.12, wz = sl[1] + (TT.hash(e.id, 9, 5) - 0.5) * 0.12;
    if (!o.init) { o.ox = wx; o.oz = wz; }
    else { const f = Math.min(1, dt * 5); o.ox += (wx - o.ox) * f; o.oz += (wz - o.oz) * f; }
    const px = e.x + o.ox, pz = e.y + o.oz;
    const dx = px - o.px, dz = pz - o.pz, moving = o.init && dx * dx + dz * dz > 1e-7;

    // Blickrichtung: beim Laufen in Laufrichtung, sonst zum Gegner / zur Arbeit
    let want = o.yaw, digging = false;
    if (moving) want = Math.atan2(dx, dz);
    else if (e.st === "fight") { const tg = TT.byId(s, e.target); if (tg) want = Math.atan2(tg.x - e.x, tg.y - e.y); }
    else if (e.worker && e.st === "work" && e.job && e.job.idx >= 0) want = Math.atan2((e.job.idx % s.W) + 0.5 - e.x, ((e.job.idx / s.W) | 0) + 0.5 - e.y);
    else if (e.foe && e.nx >= 0) { want = Math.atan2((e.nx % s.W) + 0.5 - e.x, ((e.nx / s.W) | 0) + 0.5 - e.y); digging = s.tiles[e.nx] < T.FLOOR; }
    if (!o.init) { o.yaw = want; o.init = true; }
    else { const dd = Math.atan2(Math.sin(want - o.yaw), Math.cos(want - o.yaw)); o.yaw += dd * Math.min(1, dt * 12); }
    o.px = px; o.pz = pz;
    o.walk += ((moving ? 1 : 0) - o.walk) * Math.min(1, dt * 10);

    const sc = (def.boss ? 1.55 : 1) * (1 + (e.lvl - 1) * 0.035);
    const asleep = e.st === "act" && e.act === "sleep";
    const working = (e.worker && e.st === "work" && e.job && e.job.kind !== "deliver") || digging;
    const busy = !e.foe && e.st === "act" && (e.act === "train" || e.act === "forge" || e.act === "research");

    o.g.position.set(px, 0, pz);
    o.g.rotation.y = o.yaw;
    if (o.model) poseModel(o, e, def, time, dt, sc, asleep, working || busy);
    else {
      const bt = time * 10 + e.ph;
      const hover = md.hover ? md.hover + Math.sin(time * 2 + e.ph) * 0.03 : 0;

      // Arm- und Waffenbewegung
      let rot = 0;
      if (e.st === "fight" && e.cd > 0) rot = Math.sin(Math.min(1, e.cd / def.cd) * PI);
      else if (working) rot = 0.5 + 0.5 * Math.sin(time * 14 + e.ph);
      else if (busy && e.act !== "research") rot = 0.5 + 0.5 * Math.sin(time * 7 + e.ph);
      if (o.arm) { if (md.spin) o.arm.rotation.y = time * md.spin + e.ph; else o.arm.rotation.x = md.rest + rot * md.swing; }

      o.tilt.position.y = asleep ? 0.1 * sc : Math.abs(Math.sin(bt)) * 0.07 * o.walk + hover;
      o.tilt.rotation.z = asleep ? 1.35 : Math.sin(bt) * 0.09 * o.walk;
      o.tilt.rotation.x = asleep ? 0 : rot * 0.2;
      o.tilt.scale.setScalar(sc * (1 + Math.sin(time * 2.4 + e.ph) * 0.012));

      const m = e.hurt > 0 ? mat.hurt : mat.lit;
      if (o.body.material !== m) { o.body.material = m; if (o.armMesh) o.armMesh.material = m; }
    }
    if (o.extra) o.extra.visible = e.carry > 0;
    if (e.conv && !o.band) {                     // Überläufer tragen einen violetten Ring
      if (!bandMat) bandMat = new THREE.MeshBasicMaterial({ color: 0xb06cff, toneMapped: false });
      o.band = new THREE.Mesh(bandGeo, bandMat); o.band.rotation.x = PI / 2; o.band.position.y = 0.03; o.g.add(o.band);
    }

    // Kleine Effekte direkt an der Kreatur
    o.emitT -= dt;
    if (o.emitT <= 0) {
      o.emitT = 0.12 + Math.random() * 0.1;
      if (e.worker && e.st === "work" && e.job && e.job.kind === "dig") {
        const j = e.job.idx, tx = (j % s.W) + 0.5, tz = ((j / s.W) | 0) + 0.5, t = s.tiles[j];
        const c = t === T.GOLD ? rgb("#e9b93a") : t === T.GEM ? C_TEAL : rgb("#5b4653");
        for (let k = 0; k < 2; k++) emit(t !== T.EARTH, e.x + (tx - e.x) * 0.55 + (Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.4, e.y + (tz - e.y) * 0.55 + (Math.random() - 0.5) * 0.3,
          (e.x - tx) * 1.2 + (Math.random() - 0.5), 1 + Math.random() * 1.5, (e.y - tz) * 1.2 + (Math.random() - 0.5), 0.5, t === T.EARTH ? 0.11 : 0.16, c, 7);
        if (Math.random() < 0.35) emit(false, e.x + (tx - e.x) * 0.5, 0.35, e.y + (tz - e.y) * 0.5, (e.x - tx) * 0.3, 0.3, (e.y - tz) * 0.3, 0.9, 0.5, [0.26, 0.2, 0.22], -0.1, SMOKE, 0.3);
      } else if (digging) {
        const tx = (e.nx % s.W) + 0.5, tz = ((e.nx / s.W) | 0) + 0.5;
        emit(false, e.x + (tx - e.x) * 0.55, 0.3 + Math.random() * 0.4, e.y + (tz - e.y) * 0.55, (e.x - tx) + (Math.random() - 0.5), 1 + Math.random(), (e.y - tz) + (Math.random() - 0.5), 0.5, 0.11, rgb("#5b4653"), 7);
      }
      if (e.haste > 0 && moving) emit(true, px, 0.15, pz, 0, 0.3, 0, 0.4, 0.22, rgb("#ffe36e"), 0);
      if (e.type === "nachtmahr") emit(false, px + (Math.random() - 0.5) * 0.4, 0.15, pz + (Math.random() - 0.5) * 0.4, 0, 0.35, 0, 0.8, 0.3, rgb("#1c1030"), 0);
    }
  }

  function syncEnts(s, time, dt) {
    const used = {};
    for (const e of s.ents) {
      if (e.held || e.dead) continue;
      let o = ents.get(e.id);
      // neu anlegen, wenn es die Kreatur noch nicht gibt – oder ihr fertiges Modell inzwischen geladen ist
      if (!o || o.type !== e.type || (!o.model && TT.A3 && TT.A3.has(e.type))) {
        if (o) dropCreature(o);
        o = makeCreature(e.type);
        ents.set(e.id, o); scene.add(o.g);
      }
      const k = TT.tileOf(s, e);
      o.slot = used[k] || 0; used[k] = o.slot + 1;
      o.stamp = frame; o.e = e;
      animate(o, e, s, time, dt);
    }
    ents.forEach(function (o, id) { if (o.stamp !== frame) { dropCreature(o); ents.delete(id); } });
  }

  /* ============================================================
     Einzelobjekte: Kern, Riss, Schächte, Fallen, Truhen, Gefangene
     ============================================================ */
  function tx(s, i) { return (i % s.W) + 0.5; }
  function tz(s, i) { return ((i / s.W) | 0) + 0.5; }

  function syncObjects(s, time, dt) {
    const W = s.W;
    // Herzkern
    coreGrp.position.set(tx(s, s.coreIdx), 0, tz(s, s.coreIdx));
    const hit = s.time - s.coreHitT < 0.25, weak = s.coreHp / B.coreHp;
    crystal.position.y = 0.62 + Math.sin(time * 1.6) * 0.05;
    crystal.rotation.y = time * 0.5;
    crystal.scale.setScalar(1 + Math.sin(time * 2.2) * 0.04);
    mat.crystal.emissive.setHex(hit ? 0xffffff : weak < 0.35 ? 0xc83a2a : 0x1fa8c8);
    mat.crystal.emissiveIntensity = hit ? 2.5 : 1.2 + Math.sin(time * 2.2) * 0.25;
    if (Math.random() < dt * 6) emit(true, coreGrp.position.x + (Math.random() - 0.5) * 0.7, 0.3, coreGrp.position.z + (Math.random() - 0.5) * 0.7, 0, 0.5 + Math.random() * 0.4, 0, 1.6, 0.12, C_TEAL, -0.2);

    // Riss
    riftGrp.visible = !!s.seen[s.rift.idx];
    riftGrp.position.set(tx(s, s.rift.idx), 0, tz(s, s.rift.idx));
    if (riftOn !== s.rift.on) { riftOn = s.rift.on; riftRings.forEach(function (r) { r.material = riftOn ? mat.rift : mat.riftOff; }); }
    riftRings.forEach(function (r, k) { r.rotation.z = time * (riftOn ? 1.2 + k * 0.5 : 0.25) * (k % 2 ? -1 : 1) + k; });
    if (riftGrp.visible && riftOn && Math.random() < dt * 10) {
      const a = Math.random() * TAU, rr = 0.15 + Math.random() * 0.3;
      emit(true, riftGrp.position.x + Math.cos(a) * rr, 0.1, riftGrp.position.z + Math.sin(a) * rr, -Math.sin(a) * 0.5, 0.7 + Math.random() * 0.6, Math.cos(a) * 0.5, 1.2, 0.14, C_VIO, -0.3);
    }

    // Schächte
    while (shaftObjs.length < s.shafts.length) {
      const g = new THREE.Group(), m = new THREE.Mesh(M.prop("shaft").lit, mat.lit);
      m.castShadow = true; g.add(m);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.6, 2.8, 18, 1, true), mat.cone);
      cone.position.y = 1.4; g.add(cone);
      scene.add(g); shaftObjs.push(g);
    }
    shaftObjs.forEach(function (g, k) {
      const i = s.shafts[k];
      g.visible = i !== undefined && !!s.seen[i];
      if (g.visible) g.position.set(tx(s, i), 0, tz(s, i));
    });

    // Türen und Fallen (wenige, daher jedes Bild neu gesetzt)
    const frameSet = env ? [mk.doorW, mk.doorLeaf, mk.spikeBase, mk.spikeTop, mk.grate, mk.flameGlow, mk.chestE, mk.chestELid]
      : [mk.door, mk.plate, mk.spikes, mk.flame, mk.flameGlow, mk.chest];
    frameSet.forEach(function (m) { m.count = 0; });
    for (const tr of s.traps) {
      const i = tr.idx, x = tx(s, i), z = tz(s, i);
      if (!s.seen[i]) continue;
      if (tr.k === OBJ.DOOR) {
        const ns = s.tiles[i - W] < T.FLOOR || s.tiles[i + W] < T.FLOOR, ew = s.tiles[i - 1] < T.FLOOR || s.tiles[i + 1] < T.FLOOR;
        const ry = ns && !ew ? PI / 2 : 0;
        if (env) { put(mk.doorW, x, 0, z, 0.25, 0.262, 0.25, ry); put(mk.doorLeaf, x, 0, z, 0.25, 0.262, 0.25, ry); }
        else put(mk.door, x, 0, z, 1, 1, 1, ry);
      } else if (tr.k === OBJ.SPIKE) {
        const up = tr.cd > 0 ? 0.2 + 0.8 * Math.max(0, (tr.cd - 3.6) / 0.4) : 1;       // nach dem Auslösen eingefahren
        if (env) { put(mk.spikeBase, x, 0, z, 0.25, 0.25, 0.25, 0); put(mk.spikeTop, x, 0.01, z, 0.25, 0.25 * up, 0.25, 0); }
        else { put(mk.plate, x, 0, z, 1, 1, 1, 0); put(mk.spikes, x, 0.03, z, 1, up, 1, 0); }
      } else {
        const hot = tr.cd > 0 ? 0.25 : 0.8 + Math.sin(time * 6 + i) * 0.2;
        if (env) put(mk.grate, x, 0.07, z, 0.25, 0.25, 0.5, 0); else put(mk.flame, x, 0, z, 1, 1, 1, 0);
        put(mk.flameGlow, x, 0, z, 1, 1, 1, 0, hot, hot, hot);
        if (tr.cd <= 0) pt(glowPts, x, 0.15, z, 1.3, C_FIRE, 0.3);
        if (tr.cd > 5.7) burst(true, x, 0.2, z, 6, 2.2, 0.5, 0.35, C_FIRE, -1, 1.5);
      }
    }
    for (const p of s.pickups) if (s.seen[p.idx]) {
      const px = tx(s, p.idx), pz = tz(s, p.idx), ry = TT.hash(p.idx, 1, 2) * 6;
      if (env) { put(mk.chestE, px, 0, pz, 0.3, 0.3, 0.3, ry); put(mk.chestELid, px, 0, pz, 0.3, 0.3, 0.3, ry); }
      else put(mk.chest, px, 0, pz, 1, 1, 1, ry);
      pt(glowPts, px, 0.35, pz, 1.1, rgb("#ffd75e"), 0.18 + 0.08 * Math.sin(time * 3));
    }
    frameSet.forEach(done);

    // Kriegstrommel
    banner.visible = !!s.rally;
    if (s.rally) { banner.position.set(tx(s, s.rally.idx), 0, tz(s, s.rally.idx)); banner.rotation.y = Math.sin(time * 2) * 0.25; }

    // Gefangene in ihren Käfigen
    for (let k = 0; k < s.prisoners.length; k++) {
      const p = s.prisoners[k];
      let o = prisoners[k];
      if (!o || o.type !== p.type || (!o.model && TT.A3 && TT.A3.has(p.type))) {
        if (o) dropCreature(o);
        o = prisoners[k] = makeCreature(p.type); scene.add(o.g);
      }
      o.g.visible = true;
      o.g.position.set(tx(s, p.idx), 0, tz(s, p.idx));
      o.g.rotation.y = Math.sin(time * 0.7 + p.idx) * 0.8;
      o.tilt.scale.setScalar(0.85);
      if (o.model) {
        if (!o.base && o.inst.acts.idle) { o.base = loopAct(o.inst.acts.idle); o.base.play(); }
        o.inst.mixer.update(dt);
      } else if (o.arm && !o.md.spin) o.arm.rotation.x = o.md.rest;
    }
    for (let k = s.prisoners.length; k < prisoners.length; k++) prisoners[k].g.visible = false;
  }

  /* ============================================================
     Effekte aus dem Spielzustand (Schüsse, Treffer, Zauberkreise, Blitze)
     ============================================================ */
  function ringMesh() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.rotation.x = -PI / 2; m.renderOrder = 5; scene.add(m);
    return m;
  }
  function boltMesh() {
    const b = new M.Builder();
    let x = 0.9, y = 7;
    for (let k = 0; k < 7; k++) {
      const nx = k === 6 ? 0 : 0.9 * (1 - (k + 1) / 7) + (Math.random() - 0.5) * 0.8, ny = 7 * (1 - (k + 1) / 7);
      const len = Math.hypot(nx - x, ny - y), ang = Math.atan2(nx - x, ny - y);
      b.box("#fffbe0", (x + nx) / 2, (y + ny) / 2, 0, 0.07, len, 0.07, 0, 0, -ang);
      x = nx; y = ny;
    }
    const m = new THREE.Mesh(b.build(), mat.glow);
    scene.add(m);
    return m;
  }

  let flash = null;
  function syncFx(s, time) {
    let ri = 0, bi = 0;
    flash = null;
    for (const f of s.fx) {
      const p = Math.max(0, f.t / f.d), fresh = !f._seen;
      f._seen = true;
      switch (f.k) {
        case "shot": {
          const q = 1 - p, c = rgb(f.color);
          for (let k = 0; k < 3; k++) {
            const qq = Math.max(0, q - k * 0.12);
            pt(glowPts, f.x + (f.x2 - f.x) * qq, 0.45, f.y + 0.2 + (f.y2 - f.y) * qq, 0.45 - k * 0.1, c, 0.9 - k * 0.25);
          }
          break;
        }
        case "hit":
          pt(glowPts, f.x, 0.45, f.y + 0.1, 0.5 + (1 - p) * 0.8, [1, 0.95, 0.85], p * 0.7);
          if (fresh) burst(true, f.x, 0.45, f.y + 0.1, 4, 2.4, 0.25, 0.3, [1, 0.9, 0.6], 6, 0.5, STAR);
          break;
        case "ring": {
          const m = rings[ri] || (rings[ri] = ringMesh());
          ri++;
          m.visible = true;
          m.position.set(f.x, 0.08, f.y);
          m.scale.setScalar(f.r * (0.25 + 0.75 * (1 - p)));
          m.material.color.set(f.color); m.material.opacity = p;
          if (fresh) burst(true, f.x, 0.2, f.y, 10, f.r * 1.6, 0.7, 0.45, rgb(f.color), 0, 0.8, STAR);
          break;
        }
        case "bolt": {
          const m = bolts[bi] || (bolts[bi] = boltMesh());
          bi++;
          m.visible = Math.sin(time * 90) > -0.4;
          m.position.set(f.x, 0, f.y);
          m.rotation.y = f.x * 7;
          pt(glowPts, f.x, 0.3, f.y, 4.5, [1, 0.97, 0.8], p * 0.8);
          flash = [f.x, f.y, 0xfff4c0, 90 * p, 12];
          if (fresh) { burst(true, f.x, 0.3, f.y, 16, 4, 0.5, 0.4, [1, 0.95, 0.7], 5, 1.5, STAR); burst(false, f.x, 0.3, f.y, 5, 0.7, 1.2, 0.8, [0.2, 0.19, 0.22], -0.2, 0.3, SMOKE, 0.35); }
          break;
        }
        case "puff":
          if (fresh) { const c = rgb(f.color); burst(true, f.x, 0.35, f.y, 7, 1.6, 0.6, 0.4, c, 0, 0.6, STAR); burst(false, f.x, 0.3, f.y, 5, 0.6, 1.0, 0.7, [c[0] * 0.35, c[1] * 0.35, c[2] * 0.35], -0.2, 0.3, SMOKE, 0.4); }
          break;
        case "text":
          if (fresh && f.text.indexOf("Stufe") === 0) burst(true, f.x, 0.5, f.y + 0.5, 14, 1.4, 0.9, 0.42, C_TEAL, -1, 1.2, STAR);
          break;
      }
    }
    for (; ri < rings.length; ri++) rings[ri].visible = false;
    for (; bi < bolts.length; bi++) bolts[bi].visible = false;
  }

  /* ============================================================
     Licht: Kern und Riss haben feste Lichter, vier weitere wandern zu den wichtigsten Stellen
     ============================================================ */
  function setLight(l, x, z, color, intensity, dist, y) {
    l.position.set(x, y || 1.1, z); l.color.setHex(color); l.intensity = intensity; l.distance = dist;
  }
  function syncLights(s, v, time) {
    const weak = s.coreHp / B.coreHp < 0.35;
    setLight(lights[0], tx(s, s.coreIdx), tz(s, s.coreIdx), weak ? 0xff6a4a : 0x4ff0dc, 26 + Math.sin(time * 2.2) * 5, 11, 1.4);
    if (s.seen[s.rift.idx]) setLight(lights[1], tx(s, s.rift.idx), tz(s, s.rift.idx), 0xa060ff, s.rift.on ? 26 : 6, 8, 1);
    else lights[1].intensity = 0;

    const cand = [];
    if (flash) cand.push([flash[0], flash[1], flash[2], flash[3], flash[4], -1]);
    const lit = {};
    for (const e of s.ents) {
      if (!e.foe || e.dead) continue;
      const k = TT.tileOf(s, e);
      if (lit[k]) continue;
      lit[k] = 1;
      cand.push([e.x, e.y, 0xffa450, 8 + Math.sin(time * 9 + e.ph) * 1.5, 5, Math.hypot(e.x - v.cx, e.y - v.cy)]);
      pt(glowPts, e.x, 0.65, e.y, 2.0, C_FIRE, 0.06);
    }
    for (const sh of s.shafts) if (s.seen[sh]) cand.push([tx(s, sh), tz(s, sh), 0xffdca0, 12, 6, Math.hypot(tx(s, sh) - v.cx, tz(s, sh) - v.cy) + 3]);
    for (const q of lightSpots) cand.push([q[0], q[1], q[2], q[3] + Math.sin(time * 8 + q[0]) * 1.5, q[4], Math.hypot(q[0] - v.cx, q[1] - v.cy) + 2]);
    cand.sort(function (a, b) { return a[5] - b[5]; });
    for (let k = 2; k < lights.length; k++) {
      const c = cand[k - 2];
      if (c) setLight(lights[k], c[0], c[1], c[2], c[3], c[4]); else lights[k].intensity = 0;
    }
  }

  /* ============================================================
     Werkzeugvorschau
     ============================================================ */
  function tall(s, i) { return !s.seen[i] || s.tiles[i] < T.FLOOR; }

  function syncPreview(s, ui, time) {
    mk.pre.count = 0;
    spellRing.visible = spellDisc.visible = false;
    if (ui && ui.hx >= 0 && !ui.overlayOpen) {
      const p = TT.previewInfo(s, ui), W = s.W;
      let high = false;
      for (const c of p.cells) {
        const hi = tall(s, c[1] * W + c[0]), a = c[3] * 1.5;
        if (hi) high = true;
        _col.set(c[2]);
        put(mk.pre, c[0] + 0.5, 0, c[1] + 0.5, 1.04, hi ? WH * 1.2 : 0.07, 1.04, 0, _col.r * a, _col.g * a, _col.b * a);
      }
      if (!p.cells.length) high = tall(s, ui.hy * W + ui.hx);
      const yl = high ? WH * 1.21 : 0.08, w = p.x1 - p.x0 + 1, d = p.y1 - p.y0 + 1, mx = p.x0 + w / 2, mz = p.y0 + d / 2;
      _col.set(p.stroke);
      const pulse = 1.5 + Math.sin(time * 6) * 0.3, r = _col.r * pulse, g = _col.g * pulse, b = _col.b * pulse;
      put(mk.pre, mx, yl, p.y0, w + 0.06, 0.05, 0.06, 0, r, g, b); put(mk.pre, mx, yl, p.y1 + 1, w + 0.06, 0.05, 0.06, 0, r, g, b);
      put(mk.pre, p.x0, yl, mz, 0.06, 0.05, d + 0.06, 0, r, g, b); put(mk.pre, p.x1 + 1, yl, mz, 0.06, 0.05, d + 0.06, 0, r, g, b);
      if (p.radius) {
        spellRing.visible = spellDisc.visible = true;
        spellRing.position.set(ui.hx + 0.5, yl, ui.hy + 0.5); spellDisc.position.copy(spellRing.position);
        spellRing.scale.setScalar(p.radius); spellDisc.scale.setScalar(p.radius);
        spellRing.rotation.z = time * 0.6;
      }
    }
    done(mk.pre);

    const sel = ui && ui.sel ? ents.get(ui.sel) : null;
    selRing.visible = !!sel;
    if (sel) { selRing.position.set(sel.g.position.x, 0.04, sel.g.position.z); selRing.scale.setScalar(1 + Math.sin(time * 5) * 0.06); }
  }

  /* ============================================================
     Partikel bewegen und zusammen mit den festen Leuchtpunkten ausgeben
     ============================================================ */
  function syncParticles(s, v, time, dt) {
    // funkelndes Gold
    if (goldTiles.length && Math.random() < dt * Math.min(14, goldTiles.length)) {
      const i = goldTiles[(Math.random() * goldTiles.length) | 0];
      emit(true, (i % s.W) + Math.random(), WH * 0.5 + Math.random() * 0.55, ((i / s.W) | 0) + Math.random(), 0, 0, 0, 0.55, 0.5, [1, 0.93, 0.6], 0, STAR);
    }
    for (const q of spots) pt(glowPts, q[0], q[1], q[2], q[3] * (1 + Math.sin(time * 2 + q[6]) * 0.08), q[4], q[5] * (0.85 + Math.sin(time * 3 + q[6]) * 0.15));
    // Wandfackeln: flackernde Flamme, Lichtschein am Boden, ab und zu ein Funke
    for (const q of torches) {
      const fl = 0.8 + 0.2 * Math.sin(time * 11 + q[2]) * Math.sin(time * 7.3 + q[2] * 2);
      pt(glowPts, q[0], q[3] + 0.1, q[1], 0.62 * (0.9 + 0.1 * fl), C_FLAME, 0.95, FLAME);      // Flamme
      pt(glowPts, q[0], q[3] + 0.07, q[1], 0.36 * fl, C_FLAME_IN, 0.9, FLAME);                  // heller Kern
      pt(glowPts, q[0], q[3], q[1], 1.2 * fl, C_FIRE, 0.28);                                    // Lichthof
      pt(glowPts, q[0], 0.3, q[1], 3.4, C_FIRE, 0.13 * fl);                                     // Schein am Boden
    }
    // Kerzen und Kohlebecken
    for (const q of flames) {
      const fl = 0.85 + 0.15 * Math.sin(time * 10 + q[4]) * Math.sin(time * 6.1 + q[4] * 3);
      pt(glowPts, q[0], q[1] + q[3] * 0.2, q[2], q[3] * fl, C_FLAME, 0.95, FLAME);
      pt(glowPts, q[0], q[1] + q[3] * 0.14, q[2], q[3] * 0.55 * fl, C_FLAME_IN, 0.9, FLAME);
    }
    if (torches.length && Math.random() < dt * Math.min(10, torches.length * 0.4)) {
      const q = torches[(Math.random() * torches.length) | 0];
      emit(true, q[0], q[3] + 0.04, q[1], (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 0.7, 0.09, [1, 0.7, 0.3], -0.4);
      if (Math.random() < 0.5) emit(false, q[0], q[3] + 0.25, q[1], (Math.random() - 0.5) * 0.1, 0.3, (Math.random() - 0.5) * 0.1, 1.6, 0.4, [0.13, 0.12, 0.15], -0.05, SMOKE, 0.22);
    }
    // Schwebeteilchen in der Luft
    if (Math.random() < dt * 10) {
      emit(true, v.cx + (Math.random() - 0.5) * camDist * 1.3, 0.2 + Math.random() * 1.3, v.cy + (Math.random() - 0.5) * camDist,
        (Math.random() - 0.5) * 0.12, 0.03, (Math.random() - 0.5) * 0.12, 4, 0.07, [0.2, 0.26, 0.34], 0);
    }
    pt(glowPts, tx(s, s.coreIdx), 0.7, tz(s, s.coreIdx), 5.5, C_TEAL, 0.3 + Math.sin(time * 2.2) * 0.06);
    if (s.seen[s.rift.idx]) pt(glowPts, tx(s, s.rift.idx), 0.3, tz(s, s.rift.idx), 3.2, C_VIO, s.rift.on ? 0.34 : 0.1);
    for (const sh of s.shafts) if (s.seen[sh]) pt(glowPts, tx(s, sh), 0.4, tz(s, sh), 2.8, [1, 0.86, 0.6], 0.2);

    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.life -= dt;
      if (p.life <= 0) { parts[k] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03 && p.grav > 0) { p.y = 0.03; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      const a = p.life / p.max;
      const grow = p.cell === SMOKE ? 1 + (1 - a) * 0.9 : p.add ? 0.5 + a * 0.5 : 1;            // Rauch quillt auf
      pt(p.add ? glowPts : dustPts, p.x, p.y, p.z, p.size * grow, p.c, (p.add ? a : Math.min(1, a * 2) * 0.9) * p.al, p.cell);
    }
    flushPoints(glowPts); flushPoints(dustPts);
  }

  /* ============================================================
     Kamera
     ============================================================ */
  function syncCamera(v, ui) {
    const dpr = ui ? ui.dpr : 1;
    camDist = 760 * dpr / v.zoom;
    if (!rq) rq = Math.min(1, 1.6 / dpr);          // sehr hochauflösende Bildschirme: etwas gröber rechnen
    const rw = Math.max(1, Math.round(v.w * rq)), rh = Math.max(1, Math.round(v.h * rq));
    if (renderer.domElement.width !== rw || renderer.domElement.height !== rh) renderer.setSize(rw, rh, false);
    const asp = v.w / Math.max(1, v.h);
    if (camera.aspect !== asp) { camera.aspect = asp; camera.updateProjectionMatrix(); }
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    camera.position.set(v.cx + Math.sin(v.yaw) * cp * camDist, sp * camDist, v.cy + Math.cos(v.yaw) * cp * camDist);
    camera.lookAt(v.cx, 0, v.cy);
    camera.updateMatrixWorld();
    pxScale = v.h / (2 * Math.tan(FOV * PI / 360));
    scene.fog.density = 0.32 / camDist;

    // Das Schattenlicht folgt der Kamera
    const half = TT.clamp(camDist * 1.15, 14, 36), sc = sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    sun.target.position.set(v.cx, 0, v.cy);
    sun.position.set(v.cx - 18, 42, v.cy + 22);
    sun.target.updateMatrixWorld();
  }

  function rayFrom(v, mx, my) {
    _v.set(mx / v.w * 2 - 1, -(my / v.h * 2 - 1), 0.5).unproject(camera);
    _d.copy(_v).sub(camera.position).normalize();
  }

  // Welches Feld liegt unter dem Mauszeiger? Der Sehstrahl wird von der Wandoberkante bis zum Boden abgetastet.
  V3.pick = function (s, v, ui, mx, my) {
    syncCamera(v, ui);
    rayFrom(v, mx, my);
    const o = camera.position;
    if (_d.y > -0.02) return { wx: -1, wy: -1 };
    const top = WH * 1.1, t0 = (top - o.y) / _d.y, t1 = -o.y / _d.y, n = Math.ceil((t1 - t0) / 0.03);
    for (let k = 0; k <= n; k++) {
      const t = k === n ? t1 : t0 + k * 0.03;
      const x = o.x + _d.x * t, z = o.z + _d.z * t, ix = Math.floor(x), iz = Math.floor(z);
      if (ix < 0 || iz < 0 || ix >= s.W || iz >= s.H) continue;
      if (k === n || tall(s, iz * s.W + ix)) return { wx: x, wy: z };
    }
    return { wx: o.x + _d.x * t1, wy: o.z + _d.z * t1 };
  };

  // Punkt auf dem Boden unter einer Bildschirmposition
  V3.groundAt = function (v, ui, mx, my) {
    syncCamera(v, ui);
    rayFrom(v, mx, my);
    const t = _d.y < -0.01 ? -camera.position.y / _d.y : 200;
    return [camera.position.x + _d.x * t, camera.position.z + _d.z * t];
  };

  // Weltpunkt -> Bildschirm; liefert [x, y, Pixel pro Feld] oder null (hinter der Kamera)
  V3.project = function (v, x, y, z) {
    _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    const depth = -_v.z;
    if (depth < 0.5) return null;
    _v.applyMatrix4(camera.projectionMatrix);
    return [(_v.x + 1) / 2 * v.w, (1 - _v.y) / 2 * v.h, pxScale / depth];
  };

  // Kreatur unter dem Mauszeiger (nach Bildschirmabstand, damit man auf den Körper klicken kann)
  V3.pickEnt = function (s, v, ui, mx, my, ownOnly) {
    syncCamera(v, ui);
    let best = null, bd = 1e9;
    for (const e of s.ents) {
      if (e.held || e.dead || (ownOnly && e.foe)) continue;
      const o = ents.get(e.id), md = o ? o.md : M.creature(e.type), p = V3.project(v, e.x, md.hover + md.h * 0.5, e.y);
      if (!p) continue;
      const d = Math.hypot(p[0] - mx, p[1] - my) / p[2];
      if (d < 0.5 && d < bd) { bd = d; best = e; }
    }
    return best;
  };

  // Zugriff auf die Szene, um Licht und Material in der Browserkonsole auszuprobieren
  V3.debug = function () { return { renderer: renderer, scene: scene, camera: camera, sun: sun, hemi: hemi, lights: lights, mat: mat, mk: mk }; };

  V3.viewPoly = function (v, ui) {
    return [V3.groundAt(v, ui, 0, 0), V3.groundAt(v, ui, v.w, 0), V3.groundAt(v, ui, v.w, v.h), V3.groundAt(v, ui, 0, v.h)];
  };

  /* ============================================================
     Ein Bild zeichnen
     ============================================================ */
  V3.render = function (s, v, ui, time, dt) {
    if (!V3.ok) return;
    frame++;
    // Läuft es dauerhaft unter etwa 30 Bildern pro Sekunde, wird schrittweise gröber gerechnet
    if (dt > 0.034 && dt < 0.09 && document.visibilityState === "visible") slow++; else slow = Math.max(0, slow - 2);
    if (slow > 120 && rq > 0.55) { rq = Math.max(0.55, rq - 0.15); slow = 0; }
    if (s !== lastState) {                     // neues oder geladenes Spiel: alles Alte wegräumen
      lastState = s; sig = null; lastFill = -1; parts.length = 0;
      ents.forEach(dropCreature);
      ents.clear();
    }
    syncCamera(v, ui);
    if (mapChanged(s)) rebuildMap(s);
    syncObjects(s, time, dt);
    syncEnts(s, time, dt);
    syncFx(s, time);
    syncLights(s, v, time);
    syncPreview(s, ui, time);
    syncParticles(s, v, time, dt);
    mat.mark.opacity = 0.22 + 0.08 * Math.sin(time * 4);
    renderer.render(scene, camera);
  };

  /* ============================================================
     2D-Ebene über dem 3D-Bild: Lebensbalken, Stufen, Texte, Beschriftungen
     ============================================================ */
  V3.overlay = function (s, v, ctx, ui, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, v.w, v.h);
    if (!V3.ok) return;
    ctx.textAlign = "center";

    ents.forEach(function (o) {
      const e = o.e;
      if (!e || e.dead || e.held) return;
      const def = TT.CREATURES[e.type], sc = (def.boss ? 1.55 : 1) * (1 + (e.lvl - 1) * 0.035);
      const p = V3.project(v, o.g.position.x, (o.md.h + o.md.hover) * sc + 0.14, o.g.position.z);
      if (!p || p[0] < -40 || p[1] < -40 || p[0] > v.w + 40 || p[1] > v.h + 40) return;
      const u = p[2], w = Math.max(22, u * 0.5), h = Math.max(3, u * 0.06), mx = TT.maxHp(s, e);
      let y = p[1];
      if (e.hp < mx) {
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(p[0] - w / 2 - 1, y - h - 1, w + 2, h + 2);
        ctx.fillStyle = e.foe ? "#ff6a55" : "#7dffb0"; ctx.fillRect(p[0] - w / 2, y - h, w * Math.max(0, e.hp / mx), h);
        y -= h + 3;
      }
      const fs = TT.clamp(Math.round(u * 0.17), 10, 20);
      let txt = "", col = "";
      if (e.st === "act" && e.act === "sleep") { txt = "z z"; col = "#c9c2ff"; }
      else if (!e.foe && !e.worker && e.mood < 25) { txt = "!"; col = "#ff6a55"; }
      else if (e.lvl > 1) { txt = String(e.lvl); col = e.foe ? "#ffcf8a" : "#b9fff2"; }
      if (txt) {
        ctx.font = "bold " + fs + "px 'Segoe UI', sans-serif";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText(txt, p[0], y - 2);
        ctx.fillStyle = col; ctx.fillText(txt, p[0], y - 2);
      }
    });

    // Balken für Kern, Türen und Gefangene
    const bar = function (x, y, z, frac, color, wide) {
      const p = V3.project(v, x, y, z);
      if (!p) return;
      const w = Math.max(30, p[2] * wide), h = Math.max(4, p[2] * 0.07);
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(p[0] - w / 2 - 1, p[1] - h - 1, w + 2, h + 2);
      ctx.fillStyle = color; ctx.fillRect(p[0] - w / 2, p[1] - h, w * TT.clamp(frac, 0, 1), h);
    };
    if (s.coreHp < B.coreHp) bar(tx(s, s.coreIdx), 1.7, tz(s, s.coreIdx), s.coreHp / B.coreHp, s.coreHp / B.coreHp < 0.35 ? "#ff6a55" : "#37e0c8", 1.1);
    const dh = TT.TRAP_BY_OBJ[OBJ.DOOR].hp;
    for (const tr of s.traps) if (tr.k === OBJ.DOOR && tr.hp < dh) bar(tx(s, tr.idx), 1.15, tz(s, tr.idx), tr.hp / dh, "#ffb347", 0.7);
    for (const p of s.prisoners) bar(tx(s, p.idx), 0.95, tz(s, p.idx), p.t / B.convertTime, "#b06cff", 0.6);

    // Schwebende Texte
    for (const f of s.fx) {
      if (f.k !== "text") continue;
      const q = Math.max(0, f.t / f.d), p = V3.project(v, f.x, 0.9 + (1 - q) * 0.7, f.y + 0.45);
      if (!p) continue;
      ctx.globalAlpha = Math.min(1, q * 1.6);
      ctx.font = "bold " + Math.max(12, Math.round(p[2] * 0.3)) + "px 'Segoe UI', sans-serif";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText(f.text, p[0], p[1]);
      ctx.fillStyle = f.color; ctx.fillText(f.text, p[0], p[1]);
    }
    ctx.globalAlpha = 1;

    if (ui && ui.hx >= 0 && !ui.overlayOpen) {
      const p = TT.previewInfo(s, ui);
      if (p.label) TT.drawLabel(ctx, p.label, ui.hmx + 16, ui.hmy - 12, p.stroke);
    }
    TT.drawVignette(s, v, ctx, time);
  };
})();
