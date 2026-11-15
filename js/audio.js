"use strict";
/* Ton: kleine, zur Laufzeit erzeugte Klänge (keine Audiodateien nötig). */
(function () {
  let ac = null, master = null, noiseBuf = null;
  const last = {};
  TT.audioOn = false;     // wird nach dem ersten Klick eingeschaltet (Browser-Vorgabe)
  TT.muted = false;

  function ctx() {
    if (!ac) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ac = new A();
      master = ac.createGain();
      master.gain.value = 0.22;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const a = ctx();
    if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    const a = ctx();
    if (!a) return;
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
    src.buffer = noiseBuf;
    f.type = "lowpass"; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  function later(ms, fn) { setTimeout(fn, ms); }
  function seq(freqs, gap, dur, type, vol) {
    freqs.forEach(function (f, k) { later(k * gap, function () { tone(f, dur, type, vol); }); });
  }

  const SOUNDS = {
    dig: function () { noise(0.05, 0.22, 700); },
    ore: function () { tone(1400 + Math.random() * 300, 0.05, "triangle", 0.1); },
    claim: function () { tone(520, 0.08, "sine", 0.1, 780); },
    coin: function () { seq([988, 1319], 60, 0.09, "square", 0.07); },
    hit: function () { noise(0.07, 0.28, 320); tone(140, 0.08, "sawtooth", 0.1, 70); },
    shot: function () { tone(900, 0.09, "triangle", 0.09, 300); },
    death: function () { tone(300, 0.35, "sawtooth", 0.13, 60); },
    level: function () { seq([523, 659, 784, 1047], 70, 0.12, "triangle", 0.11); },
    spell: function () { tone(300, 0.3, "sine", 0.13, 1200); },
    bolt: function () { noise(0.25, 0.4, 1500); tone(90, 0.3, "sawtooth", 0.18, 40); },
    alarm: function () { seq([220, 165], 280, 0.35, "sawtooth", 0.15); },
    warn: function () { seq([392, 392], 200, 0.18, "triangle", 0.13); },
    core: function () { tone(70, 0.2, "sine", 0.3, 45); },
    lose: function () { seq([220, 185, 147, 110], 260, 0.4, "sawtooth", 0.15); },
    win: function () { seq([392, 523, 659, 784, 1047], 140, 0.3, "triangle", 0.14); },
    arrive: function () { tone(196, 0.25, "sine", 0.13, 392); },
    build: function () { tone(180, 0.07, "square", 0.07); later(50, function () { noise(0.05, 0.2, 400); }); },
    flame: function () { noise(0.3, 0.3, 500); },
    eat: function () { tone(260, 0.05, "square", 0.04); },
    grab: function () { tone(500, 0.07, "sine", 0.1, 800); },
    drop: function () { tone(600, 0.08, "sine", 0.1, 300); },
    mark: function () { tone(880, 0.04, "sine", 0.07); },
    deny: function () { tone(150, 0.12, "square", 0.07); },
  };
  // Mindestabstand in Millisekunden, damit nichts knattert
  const GAP = { dig: 140, ore: 110, hit: 70, shot: 90, claim: 120, core: 250, eat: 300, alarm: 4000, coin: 150, deny: 200 };

  TT.sfx = function (name) {
    if (!TT.audioOn || TT.muted || TT.quiet || !SOUNDS[name]) return;
    const now = performance.now();
    if (last[name] && now - last[name] < (GAP[name] || 60)) return;
    last[name] = now;
    try { SOUNDS[name](); } catch (err) { /* Ton ist nie spielentscheidend */ }
  };
})();
