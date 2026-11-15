"use strict";
/* ============================================================
   TIEFENTHRON – Kampagne
   Acht Gebiete, von der tiefsten Höhle bis unter den Thron des Lichtordens.
   Jedes Gebiet: eigene Karte (feste Startzahl), eigene Gegner, Siegelsteine als Ziel und ein Endboss.

   Felder eines Gebiets:
     W, H        Kartengröße in Feldern
     seed        Startzahl der Kartenerzeugung (gleiche Zahl = gleiche Karte bei jedem Versuch)
     gold        Startgold
     allow       Räume, Zauber, Fallen, die es hier gibt
     known       schon zu Beginn erforscht (aus früheren Gebieten mitgebracht)
     research    was das Archiv hier erforschen kann
     creatures   welche Kreaturen durch den Riss kommen können
     foes        welche Eindringlinge die Überfälle bilden
     seals       Anzahl der Siegelsteine
     guards      Wachen an jedem Siegelstein
     shafts      Anzahl der Schächte zur Oberwelt
     firstWave   Sekunden bis zum ersten Überfall
     waveEvery   Abstand der Überfälle (wird mit jedem Überfall etwas kürzer)
     budget      [Grundstärke, Zuwachs pro Überfall] der Überfälle
     heroLvl     zusätzliche Stufen der Eindringlinge
     par         Zielzeit in Sekunden für den dritten Stern
     boss        Endboss: Art, Name, Lebens-Faktor, Stufe, Begleiter, Auftrittsspruch
   ============================================================ */
(function () {
  const BASIC = ["treasury", "lair", "garden", "training", "worker", "eye"];

  TT.CAMPAIGN = [
    {
      id: "wiege", name: "Die Kalte Wiege", x: 50, y: 92,
      W: 48, H: 36, seed: 1101, gold: 900, shafts: 2,
      allow: BASIC, known: [], research: [],
      creatures: ["schrat", "spucker"], foes: ["miliz", "schuetze"],
      seals: 2, guards: ["miliz", "miliz"],
      firstWave: 420, waveEvery: 220, budget: [2, 1.3], heroLvl: 0, par: 1500,
      boss: { type: "ritter", name: "Wachhauptmann Brem", hp: 3, lvl: 2, escort: ["miliz", "miliz"],
        taunt: "„Ein Kristall voller Asche. Das soll ein Herr der Tiefe sein?“" },
      intro: [
        "Vor tausend Jahren bannte der Orden des Lichts den Herrn der Tiefe in einen Kristall und versenkte ihn unter sieben Schichten Fels. Nun ist der Kristall gesprungen. Du erwachst.",
        "Orm, der Steinflüsterer, eine alte Stimme im Gestein, spricht zu dir: „Zwei Siegelsteine halten deinen Bann. Ein Wachposten des Ordens bewacht sie. Grab dich zu ihnen durch und brich sie – dann kommt ihr Hauptmann selbst herab.“",
      ],
      outro: "Brem fällt in den Staub. Zum ersten Mal seit tausend Jahren spürst du, wie sich der Fels über dir bewegt.",
    },
    {
      id: "wurzel", name: "Wurzelgrund", x: 28, y: 80,
      W: 56, H: 42, seed: 2207, gold: 900, shafts: 3,
      allow: BASIC.concat(["archive", "heal"]), known: [], research: ["heal"],
      creatures: ["schrat", "spucker", "fluesterer"], foes: ["miliz", "schuetze", "sappeur"],
      seals: 3, guards: ["miliz", "schuetze", "miliz"],
      firstWave: 380, waveEvery: 210, budget: [3, 1.6], heroLvl: 0, par: 1800,
      boss: { type: "priester", name: "Bruder Halwin", hp: 10, lvl: 3, escort: ["miliz", "miliz", "schuetze"],
        taunt: "„Die Wurzeln flüstern deinen Namen nicht mehr, Ding aus der Tiefe.“" },
      intro: [
        "Die Wurzeln uralter Eichen reichen hier bis tief in den Fels – und mit ihnen die Gebete der Dorfpriester darüber.",
        "Orm: „Drei Siegelsteine nähren sich von ihrem Glauben. Bau ein Archiv: Flüsterer werden kommen und dir die Heilkunst erschließen. Du wirst sie brauchen.“",
      ],
      outro: "Die Eichen über dir verdorren. Im Dorf läuten die Glocken – zu spät.",
    },
    {
      id: "silber", name: "Die Silberadern", x: 64, y: 70,
      W: 64, H: 48, seed: 3313, gold: 1000, shafts: 3,
      allow: BASIC.concat(["archive", "heal", "forge", "door", "spike"]), known: ["heal"], research: ["forge"],
      creatures: ["schrat", "spucker", "fluesterer", "eisenwanst"], foes: ["miliz", "schuetze", "sappeur", "zwerg"],
      seals: 4, guards: ["zwerg", "zwerg", "schuetze", "miliz"],
      firstWave: 300, waveEvery: 200, budget: [4, 2.0], heroLvl: 1, par: 2100,
      boss: { type: "zwerg", name: "Erzvogt Dunstan", hp: 6, lvl: 4, escort: ["zwerg", "zwerg", "sappeur"],
        taunt: "„Silber, Gold, Kristall – und jetzt dein Herz. Alles kommt ans Licht.“" },
      intro: [
        "Unter der Bergbaustadt Grauwacht graben Erdbrecher im Sold des Ordens nach Silber. Sie graben schnell – und sie graben in deine Richtung.",
        "Orm: „Erforsche die Schmiede. Eisenwänste fertigen dir Türen und Dornenfallen. Wer schneller gräbt als du, soll wenigstens nicht weiterkommen.“",
      ],
      outro: "Die Stollen von Grauwacht gehören jetzt dir. Ihr Silber klingt in deinen Schatzkammern.",
    },
    {
      id: "gruft", name: "Klostergruft", x: 34, y: 58,
      W: 72, H: 54, seed: 4421, gold: 1000, shafts: 3,
      allow: BASIC.concat(["archive", "heal", "forge", "door", "spike", "prison", "spark"]), known: ["heal", "forge"], research: ["spark", "prison"],
      creatures: ["schrat", "spucker", "fluesterer", "eisenwanst", "klinge"], foes: ["miliz", "schuetze", "sappeur", "zwerg", "priester"],
      seals: 4, guards: ["priester", "zwerg", "schuetze", "sappeur"],
      firstWave: 300, waveEvery: 200, budget: [5, 2.1], heroLvl: 1, par: 2400,
      boss: { type: "priester", name: "Äbtissin Velia", hp: 15, lvl: 5, escort: ["priester", "schuetze", "schuetze", "miliz"],
        taunt: "„Ich habe für deine Seele gebetet. Nun bete ich für dein Ende.“" },
      intro: [
        "Ein Kloster steht auf den Gräbern derer, die dich einst verehrten. Die Nonnen beten Tag und Nacht – jedes Gebet ein Nagel in deinem Sarg.",
        "Orm: „Lichtpriester heilen ihre Brüder. Schlag sie zuerst. Und bau einen Kerker: Wer gefangen wird, vergisst irgendwann, wem er gedient hat.“",
      ],
      outro: "Die Gebete verstummen. In der Gruft regt sich, was lange geschlafen hat – und es hört auf dich.",
    },
    {
      id: "harrow", name: "Grenzfeste Harrow", x: 70, y: 46,
      W: 80, H: 60, seed: 5531, gold: 1100, shafts: 4,
      allow: BASIC.concat(["archive", "heal", "forge", "door", "spike", "prison", "spark", "flame", "drum"]),
      known: ["heal", "forge", "spark", "prison"], research: ["drum", "flame"],
      creatures: ["schrat", "spucker", "fluesterer", "eisenwanst", "klinge"],
      foes: ["miliz", "schuetze", "sappeur", "zwerg", "priester", "ritter", "feuermagier"],
      seals: 5, guards: ["ritter", "feuermagier", "schuetze", "zwerg", "miliz"],
      firstWave: 280, waveEvery: 195, budget: [6, 2.3], heroLvl: 1, par: 2700,
      boss: { type: "ritter", name: "Kastellan Roderich", hp: 7.5, lvl: 6, escort: ["ritter", "feuermagier", "schuetze", "schuetze"],
        taunt: "„Harrow ist nie gefallen. Nicht vor Drachen, nicht vor Königen – nicht vor dir.“" },
      intro: [
        "Die Festung Harrow bewacht den Pass zur Hauptstadt. Ihre Ritter halten den Fels unter sich für sicher.",
        "Orm: „Zeig ihnen, dass Fels nur ein Weg ist. Flammenruferinnen sprengen deine Türen – leg ihnen Glutschlünde in den Weg, und rühr die Kriegstrommel, wenn es ernst wird.“",
      ],
      outro: "Harrows Mauern stehen noch. Doch unter ihnen ist nichts mehr, das sie hält.",
    },
    {
      id: "asche", name: "Aschefeld", x: 30, y: 34,
      W: 88, H: 64, seed: 6643, gold: 1100, shafts: 4,
      allow: BASIC.concat(["archive", "heal", "forge", "door", "spike", "prison", "spark", "flame", "drum", "haste"]),
      known: ["heal", "forge", "spark", "prison", "drum", "flame"], research: ["haste"],
      creatures: ["schrat", "spucker", "fluesterer", "eisenwanst", "klinge", "nachtmahr"],
      foes: ["miliz", "schuetze", "sappeur", "zwerg", "priester", "ritter", "feuermagier", "paladin"],
      seals: 5, guards: ["paladin", "feuermagier", "ritter", "schuetze", "priester", "zwerg"],
      firstWave: 280, waveEvery: 190, budget: [7, 2.5], heroLvl: 2, par: 3000,
      boss: { type: "feuermagier", name: "Flammenruferin Ysolde", hp: 20, lvl: 7, escort: ["feuermagier", "feuermagier", "paladin"],
        taunt: "„Ich habe ein ganzes Land verbrannt, um dich zu finden. Für dich reicht ein Funke.“" },
      intro: [
        "Der Orden hat das Land über dir niedergebrannt, um dich auszuräuchern. In der Hitze schürt die Flammenruferin Ysolde ihre Bannfeuer.",
        "Orm: „Ordensritter tragen geweihte Rüstung und heilen einander. Locke einen Nachtmahr an – er kommt nur in große, gelehrte Reiche.“",
      ],
      outro: "Die Asche wird kalt. Aus ihr steigt der Rauch deiner Schmieden.",
    },
    {
      id: "kathedrale", name: "Kathedrale des Lichts", x: 66, y: 22,
      W: 96, H: 70, seed: 7759, gold: 1200, shafts: 5,
      allow: BASIC.concat(["archive", "heal", "forge", "door", "spike", "prison", "spark", "flame", "drum", "haste"]),
      known: ["heal", "forge", "spark", "prison", "drum", "flame", "haste"], research: ["deep"],
      creatures: ["schrat", "spucker", "fluesterer", "eisenwanst", "klinge", "nachtmahr"],
      foes: ["miliz", "schuetze", "sappeur", "zwerg", "priester", "ritter", "feuermagier", "paladin"],
      seals: 6, guards: ["paladin", "paladin", "priester", "feuermagier", "ritter", "schuetze"],
      firstWave: 270, waveEvery: 185, budget: [8, 2.8], heroLvl: 2, par: 3300,
      boss: { type: "paladin", name: "Großinquisitor Malrec", hp: 7, lvl: 8, escort: ["paladin", "paladin", "priester", "feuermagier"],
        taunt: "„Tausend Jahre Gebet. Tausend Jahre Wache. Für diesen einen Tag.“" },
      intro: [
        "Unter der Hauptstadt ruht die Kathedrale des Ordens auf geweihten Säulen. Sechs von ihnen tragen Siegel.",
        "Orm: „Erforsche den Tiefenbund – er macht deine Horde zäher. Der Großinquisitor kommt nicht allein.“",
      ],
      outro: "Die Säulen bersten. Durch die Risse fällt zum ersten Mal Licht in deine Tiefe – und es fürchtet sich.",
    },
    {
      id: "thron", name: "Der Thron des Lichts", x: 48, y: 9,
      W: 104, H: 76, seed: 8867, gold: 1300, shafts: 5,
      allow: BASIC.concat(["archive", "heal", "forge", "door", "spike", "prison", "spark", "flame", "drum", "haste"]),
      known: ["heal", "forge", "spark", "prison", "drum", "flame", "haste", "deep"], research: [],
      creatures: ["schrat", "spucker", "fluesterer", "eisenwanst", "klinge", "nachtmahr"],
      foes: ["miliz", "schuetze", "sappeur", "zwerg", "priester", "ritter", "feuermagier", "paladin"],
      seals: 6, guards: ["paladin", "paladin", "ritter", "feuermagier", "feuermagier", "priester", "schuetze"],
      firstWave: 260, waveEvery: 180, budget: [9, 3.0], heroLvl: 3, par: 3600,
      boss: { type: "vogt", name: "Der Hohe Lichtvogt", hp: 1.2, lvl: 8, escort: ["paladin", "paladin", "ritter", "ritter", "feuermagier", "priester"],
        taunt: "„Ich habe dich einmal gebannt. Ich werde es wieder tun.“" },
      intro: [
        "Nur noch einer steht zwischen dir und der Oberwelt: der Hohe Lichtvogt, der dich einst in den Kristall bannte.",
        "Orm: „Sechs Siegel liegen um seinen Thron. Brich sie alle. Dann wird er kommen – und diesmal bist du es, der wartet.“",
      ],
      outro: "Der Lichtvogt sinkt auf die Knie und zerfällt zu Staub. Über dir verstummen die Glocken der Hauptstadt, eine nach der anderen. Die Tiefe ist frei – und sie ist hungrig.",
    },
  ];
  TT.CAMPAIGN.forEach(function (L, i) { L.index = i; });

  TT.levelOf = function (s) {
    if (!s || s.levelId === null || s.levelId === undefined) return null;
    if (s.levelId === "tut") return TT.TUTORIAL || null;
    return TT.CAMPAIGN[s.levelId] || null;
  };
  // Gebiet nach Nummer; -1 ist das Tutorial
  TT.levelAt = function (i) { return i < 0 ? TT.TUTORIAL : TT.CAMPAIGN[i]; };

  /* ---------- Fortschritt (im Browser gespeichert, getrennt vom Spielstand) ---------- */
  const KEY = "tiefenthron.campaign.v1";
  TT.progress = {
    load: function () {
      try { const p = JSON.parse(localStorage.getItem(KEY) || "{}"); return { stars: p.stars || {} }; }
      catch (err) { return { stars: {} }; }
    },
    // Ein Gebiet ist offen, wenn es das erste ist oder das vorige erobert wurde
    open: function (i) { return i === 0 || !!TT.progress.load().stars[TT.CAMPAIGN[i - 1].id]; },
    stars: function (i) { return TT.progress.load().stars[TT.levelAt(i).id] || 0; },
    complete: function (i, stars) {
      const p = TT.progress.load(), id = TT.levelAt(i).id;
      p.stars[id] = Math.max(p.stars[id] || 0, stars);
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (err) { /* ohne Speicher geht der Fortschritt verloren */ }
    },
  };

  // Sterne eines gewonnenen Gebiets: erobert · Herzkern nie unter 50 % · schneller als die Zielzeit
  TT.starsFor = function (s) {
    const L = TT.levelOf(s);
    if (!L || !s.won) return { n: 0, list: [] };
    const list = [
      { ok: true, text: "Gebiet erobert" },
      { ok: (s.coreLow === undefined ? TT.BAL.coreHp : s.coreLow) >= TT.BAL.coreHp * 0.5, text: "Herzkern nie unter 50 % Leben" },
      { ok: (s.wonAt || s.time) <= L.par, text: "Schneller als " + Math.round(L.par / 60) + " Minuten" },
    ];
    return { n: list.filter(function (q) { return q.ok; }).length, list: list };
  };

  /* ---------- Ein Gebiet beginnen ---------- */
  TT.startLevel = function (i) {
    const L = TT.levelAt(i);
    const s = TT.newGame(L.seed, {
      W: L.W, H: L.H, gold: L.gold, shafts: L.shafts, seals: L.seals, guards: L.guards,
      guardLvl: 1 + L.heroLvl + Math.floor(Math.max(0, L.index) / 3), firstWave: L.firstWave, levelId: i < 0 ? "tut" : i,
    });
    L.known.forEach(function (k) { s.research.done[k] = true; });
    s.research.cur = null;
    s.msgs = [];
    TT.msg(s, i < 0 ? "Tutorial: " + L.name + " – Orm zeigt dir den Weg." : "Gebiet " + (i + 1) + ": " + L.name + " – brich " + L.seals + " Siegelsteine, dann stell dich " + L.boss.name + ".", "good");
    return s;
  };
})();
