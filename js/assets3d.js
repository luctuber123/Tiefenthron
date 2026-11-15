"use strict";
/* Fertige 3D-Modelle (assets/models/*.js): laden, für schnelles Zeichnen vorbereiten und Kreaturen zuordnen.
   Fehlt ein Modell oder schlägt das Laden fehl, benutzt die 3D-Ansicht die selbstgebauten Figuren aus models3d.js. */
(function () {
  if (typeof THREE === "undefined") return;
  const A = TT.A3 = { files: {} };

  /* Welche Kreatur benutzt welches Modell?
       file   Name der Modelldatei in assets/models
       h      Körperhöhe in Feldern (das Modell wird passend skaliert)
       hover  Flughöhe über dem Boden
       show   Ausrüstung, die sichtbar sein soll (Heldenmodelle bringen alle Waffen mit; der Rest wird ausgeblendet)
       tint   Einfärbung
       clips  Animationen: idle = Ruhe, walk = Laufen, attack = Angriff, work = Arbeiten/Graben, sleep = Schlafen */
  TT.MODEL_MAP = {
    // --- deine Horde (Quaternius, Ultimate Monsters) ---
    digger: { file: "orc_blob", h: 0.42, clips: { idle: "Idle", walk: "Walk", attack: "Bite_Front", work: "Bite_Front" } },
    schrat: { file: "orc", h: 0.78, clips: { idle: "Idle", walk: "Walk", attack: "Weapon", work: "Punch" } },
    spucker: { file: "dragon", h: 0.42, hover: 0.3, clips: { idle: "Flying_Idle", walk: "Fast_Flying", attack: "Headbutt", work: "Punch" } },
    fluesterer: { file: "wizard", h: 0.62, clips: { idle: "Idle", walk: "Walk", attack: "Bite_Front", work: "Jump" } },
    eisenwanst: { file: "demon", h: 0.92, clips: { idle: "Idle", walk: "Walk", attack: "Weapon", work: "Punch" } },
    klinge: { file: "ninja", h: 0.74, clips: { idle: "Idle", walk: "Run", attack: "Weapon", work: "Punch" } },
    nachtmahr: { file: "ghost", h: 0.75, hover: 0.35, clips: { idle: "Flying_Idle", walk: "Fast_Flying", attack: "Punch", work: "Headbutt" } },
    // --- Eindringlinge (KayKit, Adventurers) ---
    miliz: { file: "rogue", h: 0.8, show: ["Knife"],
      clips: { idle: "Idle", walk: "Walking_A", attack: "1H_Melee_Attack_Stab", work: "1H_Melee_Attack_Stab", sleep: "Lie_Idle" } },
    schuetze: { file: "rogue_hooded", h: 0.8, show: ["2H_Crossbow", "Rogue_Cape"],
      clips: { idle: "Idle", walk: "Walking_A", attack: "2H_Ranged_Shoot", work: "Interact", sleep: "Lie_Idle" } },
    sappeur: { file: "barbarian", h: 0.86, show: ["2H_Axe", "Barbarian_Hat"],
      clips: { idle: "2H_Melee_Idle", walk: "Walking_A", attack: "2H_Melee_Attack_Chop", work: "2H_Melee_Attack_Chop", sleep: "Lie_Idle" } },
    priester: { file: "mage", h: 0.84, show: ["2H_Staff", "Mage_Hat", "Mage_Cape"],
      clips: { idle: "Idle", walk: "Walking_A", attack: "Spellcast_Shoot", work: "Spellcast_Raise", sleep: "Lie_Idle" } },
    ritter: { file: "knight", h: 0.84, show: ["1H_Sword", "Rectangle_Shield", "Knight_Helmet"],
      clips: { idle: "Idle", walk: "Walking_A", attack: "1H_Melee_Attack_Chop", work: "1H_Melee_Attack_Chop", sleep: "Lie_Idle" } },
    vogt: { file: "knight", h: 0.86, show: ["2H_Sword", "Knight_Helmet", "Knight_Cape"], tint: 0xffcf5a,
      clips: { idle: "2H_Melee_Idle", walk: "Walking_A", attack: "2H_Melee_Attack_Chop", work: "2H_Melee_Attack_Chop", sleep: "Lie_Idle" } },
  };

  /* Ein Modell besteht oft aus vielen Einzelteilen mit je eigener Farbe. Jedes Teil wäre ein eigener
     Zeichenaufruf – bei 60 Kreaturen zu viel. Deshalb werden die Teile zu EINEM Netz verschmolzen;
     einfarbige Teile bekommen ihre Farbe dabei direkt in die Eckpunkte geschrieben. */
  function mergeSkinned(root) {
    const groups = new Map();
    root.traverse(function (n) {
      if (!n.isSkinnedMesh || Array.isArray(n.material)) return;
      const key = n.skeleton.uuid + "|" + (n.material.map ? "t" + n.material.uuid : "farbe");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    });
    groups.forEach(function (list) {
      const tex = !!list[0].material.map;
      if (tex && list.length < 2) return;
      const want = tex ? ["position", "normal", "uv", "skinIndex", "skinWeight"] : ["position", "normal", "color", "skinIndex", "skinWeight"];
      const geos = list.map(function (m) {
        const g = m.geometry.clone();
        if (!tex) {
          const c = m.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
          g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
        }
        Object.keys(g.attributes).forEach(function (k) { if (want.indexOf(k) < 0) g.deleteAttribute(k); });
        g.morphAttributes = {};
        return g;
      });
      if (geos.some(function (g) { return want.some(function (k) { return !g.attributes[k]; }); })) return;
      let merged = null;
      try { merged = THREE.BufferGeometryUtils.mergeGeometries(geos, false); } catch (err) { merged = null; }
      if (!merged) return;                                   // passt nicht zusammen: Einzelteile behalten
      const material = tex ? list[0].material : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.04 });
      const mesh = new THREE.SkinnedMesh(merged, material);
      mesh.name = list[0].name;
      mesh.bind(list[0].skeleton, list[0].bindMatrix);
      list[0].parent.add(mesh);
      list.forEach(function (m) { m.parent.remove(m); });
    });
  }

  function prepare(gltf) {
    const root = gltf.scene, clips = {};
    gltf.animations.forEach(function (c) { clips[c.name] = c; });
    mergeSkinned(root);
    root.traverse(function (n) {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.frustumCulled = false;                               // die Hüllkugel stimmt bei bewegten Skeletten nicht
      const m = n.material;
      if (m && m.isMeshStandardMaterial) { m.envMapIntensity = 0.55; m.metalness = Math.min(m.metalness, 0.15); m.roughness = Math.max(m.roughness, 0.6); }
    });
    return { root: root, clips: clips, fits: {} };
  }

  // Alle eingebetteten Modelle auspacken (läuft im Hintergrund, das Spiel wartet nicht darauf)
  A.load = function () {
    const data = globalThis.TT_MODELS;
    if (!data || !THREE.GLTFLoader || !THREE.SkeletonUtils) return;
    const loader = new THREE.GLTFLoader();
    Object.keys(data).forEach(function (name) {
      try {
        const bin = atob(data[name]), n = bin.length, bytes = new Uint8Array(n);
        for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
        delete data[name];                                   // der Base64-Text wird nicht mehr gebraucht
        loader.parse(bytes.buffer, "", function (gltf) {
          try { A.files[name] = prepare(gltf); } catch (err) { console.warn("Modell " + name + " nicht nutzbar:", err); }
        }, function (err) { console.warn("Modell " + name + " konnte nicht gelesen werden:", err); });
      } catch (err) { console.warn("Modell " + name + " ist beschädigt:", err); }
    });
  };

  /* ---------- Umgebungsteile (assets/env/*.js): Wände, Böden, Möbel ----------
     Sie liegen schon als fertige Dreieckslisten vor und müssen nur noch ausgepackt werden. */
  const props = {}, envMats = {};
  function bytes(s) {
    const bin = atob(s), n = bin.length, a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  }
  function envMaterial(pack) {
    if (envMats[pack]) return envMats[pack];
    const t = new THREE.TextureLoader().load(globalThis.TT_PROPS.tex[pack]);
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;     // Farbpalette: nicht verwaschen lassen
    return (envMats[pack] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.02, envMapIntensity: 0.45 }));
  }
  A.hasEnv = function () {
    const P = globalThis.TT_PROPS;
    return !!(P && P.geo.wall && P.geo.floor_tile_small && P.tex.dungeon);
  };
  // Liefert { geo, mat } für ein Bauteil – oder null, wenn es fehlt
  A.prop = function (name) {
    if (props[name] !== undefined) return props[name];
    const P = globalThis.TT_PROPS, d = P && P.geo[name];
    if (!d) return (props[name] = null);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bytes(d.p)), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Int8Array(bytes(d.n)), 3, true));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(bytes(d.u)), 2));
    g.setIndex(new THREE.BufferAttribute(d.big ? new Uint32Array(bytes(d.i)) : new Uint16Array(bytes(d.i)), 1));
    g.computeBoundingSphere();
    return (props[name] = { geo: g, mat: envMaterial(d.tex) });
  };

  A.has = function (type) {
    const e = TT.MODEL_MAP[type];
    return !!(e && A.files[e.file]);
  };

  // Größe und Standhöhe: Das Modell wird in Ruhehaltung vermessen und auf die gewünschte Körperhöhe gebracht
  function fit(F, e) {
    const key = e.clips.idle + "|" + e.h;
    if (F.fits[key]) return F.fits[key];
    const mixer = new THREE.AnimationMixer(F.root), clip = F.clips[e.clips.idle];
    if (clip) { mixer.clipAction(clip).play(); mixer.update(0.01); }
    F.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    F.root.traverse(function (n) { if (n.isSkinnedMesh) box.expandByObject(n, true); });
    mixer.stopAllAction(); mixer.uncacheRoot(F.root);
    const s = e.h / Math.max(1e-6, box.max.y - box.min.y);
    return (F.fits[key] = { s: s, y: -box.min.y * s });
  }

  // Eine eigene, unabhängig animierbare Kopie des Modells für eine Kreatur
  A.instance = function (type) {
    const e = TT.MODEL_MAP[type], F = e && A.files[e.file];
    if (!F) return null;
    const f = fit(F, e), obj = THREE.SkeletonUtils.clone(F.root), mats = [], seen = new Map();
    obj.traverse(function (n) {
      if (!n.isMesh) return;
      if (e.show && !n.isSkinnedMesh && e.show.indexOf(n.name) < 0) { n.visible = false; return; }
      let m = seen.get(n.material);
      if (!m) {                                              // eigenes Material je Kreatur: für Trefferblitz und Einfärbung
        m = n.material.clone();
        if (e.tint) m.color.multiply(new THREE.Color(e.tint));
        seen.set(n.material, m); mats.push(m);
      }
      n.material = m;
    });
    obj.scale.setScalar(f.s);
    obj.position.y = f.y + (e.hover || 0);
    const mixer = new THREE.AnimationMixer(obj), acts = {};
    Object.keys(e.clips).forEach(function (k) { const c = F.clips[e.clips[k]]; if (c) acts[k] = mixer.clipAction(c); });
    return { obj: obj, mixer: mixer, acts: acts, mats: mats, h: e.h, hover: e.hover || 0 };
  };
})();
