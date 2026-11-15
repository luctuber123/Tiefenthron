"use strict";
/* Einstiegspunkt: Fenstergröße, Hauptschleife. */
(function () {
  const cv = document.getElementById("game"), ctx = cv.getContext("2d"), ui = TT.ui;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    ui.view.zoom = ui.view.zoom / ui.dpr * dpr;      // Zoom bleibt optisch gleich
    ui.dpr = dpr;
    cv.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    cv.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    ui.view.w = cv.width; ui.view.h = cv.height;
  }
  window.addEventListener("resize", resize);
  resize();

  // 3D-Ansicht vorbereiten. Klappt das nicht (kein WebGL), bleibt es bei der 2D-Ansicht.
  try {
    if (TT.V3 && TT.V3.init) TT.V3.init(document.getElementById("game3d"));
  } catch (err) {
    console.error("3D-Ansicht nicht verfügbar:", err);
    if (TT.V3) TT.V3.ok = false;
  }

  TT.state = TT.newGame(20261114);     // Kulisse hinter dem Startmenü
  ui.init();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    ui.frame(real);
    if (TT.ambientTick) TT.ambientTick(real);
    if (ui.started && !ui.paused && !ui.overlayOpen) {
      // Zeit in kleinen Schritten vorspulen, damit auch bei 3× nichts durch Wände rutscht
      let rem = real * ui.speed;
      while (rem > 1e-6) {
        const dt = Math.min(0.05, rem);
        TT.update(TT.state, dt);
        rem -= dt;
      }
    } else if (ui.title) {
      TT.update(TT.state, Math.min(0.05, real));      // Beispiel-Dungeon hinter dem Hauptmenü lebt weiter
    }
    if (ui.mode3d) {
      try {
        TT.V3.render(TT.state, ui.view, ui, now / 1000, real);
        TT.V3.overlay(TT.state, ui.view, ctx, ui, now / 1000);   // Balken und Texte liegen als 2D-Ebene darüber
        return;
      } catch (err) {
        console.error("3D-Ansicht abgeschaltet:", err);
        TT.V3.ok = false;
        ui.setMode(false);
      }
    }
    TT.render(TT.state, ui.view, ctx, ui, now / 1000);
  }
  requestAnimationFrame(frame);
})();
