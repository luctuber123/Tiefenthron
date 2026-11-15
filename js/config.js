"use strict";
/* ============================================================
   TIEFENTHRON – Konfiguration
   Alle Zahlen fürs Balancing stehen in dieser Datei.
   ============================================================ */
globalThis.TT = {};

TT.W = 60;   // Kartenbreite in Feldern
TT.H = 44;   // Kartenhöhe in Feldern (freies Spiel; die Kampagne legt eigene Größen fest)
TT.MAXW = 104; TT.MAXH = 76;   // größte Karte der Kampagne – danach richtet sich die 3D-Ansicht

// Feldtypen (alles ab FLOOR ist begehbar)
TT.T = { ROCK: 0, EARTH: 1, GOLD: 2, GEM: 3, FLOOR: 4, CLAIMED: 5 };

// Objekte auf Feldern
TT.OBJ = { NONE: 0, DOOR: 1, SPIKE: 2, FLAME: 3 };

TT.BAL = {
  startGold: 800,
  coreCap: 1000,        // Gold, das der Herzkern selbst lagert
  treasuryCap: 400,     // Gold pro Schatzkammer-Feld
  coreHp: 2000,
  oreGold: 300,         // Gold pro Goldader-Feld
  goldSwing: 20,        // Gold pro Hieb
  swingT: 0.5,          // Sekunden pro Hieb
  gemSwing: 4,          // Gold pro Hieb an Kristalladern (unerschöpflich)
  carryMax: 100,
  digTime: 1.3,         // Sekunden, um ein Erdfeld abzutragen
  claimTime: 0.9,
  payEvery: 150,        // Sekunden zwischen Zahltagen
  gateEvery: 26,        // Sekunden zwischen Neuankömmlingen
  firstWave: 300,
  waveEvery: 150,
  maxWorkers: 14,
  maxCreatures: 24,
  maxHeld: 6,
  convertTime: 60,      // Sekunden, bis ein Gefangener überläuft
  captureChance: 0.6,   // Anteil der Besiegten, die lebend im Kerker landen
  partsCap: 60,
  trainCap: 4,          // bis zu dieser Stufe bringt Training etwas
  levelCap: 8,
};

/* ---------- Räume (Index 0 = kein Raum) ---------- */
TT.ROOMS = [
  null,
  { key: "treasury", name: "Schatzkammer", cost: 30, color: "#d9b13b", hot: "1",
    desc: "Lagert 400 Gold pro Feld. Ohne Lager kein Reichtum." },
  { key: "lair", name: "Schlafhöhle", cost: 40, color: "#8a6ad6", hot: "2",
    desc: "Ein Schlafplatz pro Feld. Neue Kreaturen kommen nur, wenn Platz ist." },
  { key: "garden", name: "Pilzgarten", cost: 50, color: "#4fb37a", hot: "3",
    desc: "Lässt Leuchtpilze wachsen – das Futter deiner Horde." },
  { key: "training", name: "Übungshalle", cost: 80, color: "#c4623f", hot: "4",
    desc: "Kämpfer trainieren hier bis Stufe 4. Lockt ab 9 Feldern Dornenklingen an." },
  { key: "archive", name: "Archiv", cost: 100, color: "#3f8fc4", hot: "5",
    desc: "Flüsterer erforschen hier Zauber, Räume und Fallen. Lockt ab 4 Feldern Flüsterer an." },
  { key: "forge", name: "Schmiede", cost: 120, color: "#9aa6b3", hot: "6", research: "forge",
    desc: "Eisenwänste fertigen Bauteile für Türen und Fallen." },
  { key: "prison", name: "Kerker", cost: 110, color: "#b0527c", hot: "7", research: "prison",
    desc: "Besiegte Eindringlinge landen oft hier und laufen nach einer Weile zu dir über – sofern ein Schlafplatz frei ist." },
];
TT.ROOM_ID = {};
TT.ROOMS.forEach(function (r, i) { if (r) { r.id = i; TT.ROOM_ID[r.key] = i; } });

/* ---------- Kreaturen ---------- */
TT.CREATURES = {
  // --- deine Horde ---
  digger: { name: "Wühler", hp: 35, speed: 3.4, dmg: 2, range: 1.2, cd: 1.2, worker: true, wage: 0,
    desc: "Gräbt, beansprucht Boden und schleppt Gold." },
  schrat: { name: "Schrat", hp: 95, speed: 2.5, dmg: 9, range: 1.25, cd: 0.9, wage: 15, job: "train",
    need: { lair: 1 }, weight: 5, desc: "Zäher Raufbold. Kommt, sobald es Schlafplätze gibt." },
  spucker: { name: "Glutspucker", hp: 60, speed: 2.6, dmg: 8, range: 4.5, cd: 1.3, ranged: true, wage: 20,
    job: "train", need: { lair: 1, garden: 6 }, weight: 3, shot: "#ff9a3c",
    desc: "Fernkämpfer. Kommt ab 6 Feldern Pilzgarten." },
  fluesterer: { name: "Flüsterer", hp: 50, speed: 2.3, dmg: 7, range: 4.0, cd: 1.5, ranged: true, wage: 25,
    job: "research", need: { lair: 1, archive: 4 }, weight: 3, max: 6, shot: "#7fe0ff",
    desc: "Forscher und Zauberwerfer. Kommt ab 4 Feldern Archiv." },
  eisenwanst: { name: "Eisenwanst", hp: 170, speed: 1.9, dmg: 11, range: 1.25, cd: 1.2, wage: 30,
    job: "forge", need: { lair: 1, forge: 4 }, weight: 2, max: 5,
    desc: "Wandelnde Mauer und Schmied. Kommt ab 4 Feldern Schmiede." },
  klinge: { name: "Dornenklinge", hp: 110, speed: 3.0, dmg: 15, range: 1.25, cd: 0.7, wage: 35, job: "train",
    need: { lair: 1, training: 9 }, weight: 2, desc: "Schnelle Kriegerin. Kommt ab 9 Feldern Übungshalle." },
  nachtmahr: { name: "Nachtmahr", hp: 260, speed: 2.8, dmg: 24, range: 1.4, cd: 0.9, wage: 60, job: "train",
    need: { lair: 10, training: 12, archive: 9 }, weight: 1, max: 2,
    desc: "Albtraum aus der Tiefe. Kommt nur in große, gebildete Dungeons." },

  // --- Eindringlinge von der Oberfläche ---
  miliz: { name: "Milizionär", hp: 55, speed: 2.3, dmg: 6, range: 1.25, cd: 1.0, foe: true, cost: 1, from: 1,
    dig: 2.6, loot: 15 },
  schuetze: { name: "Armbrustschütze", hp: 42, speed: 2.3, dmg: 7, range: 4.5, cd: 1.5, ranged: true,
    foe: true, cost: 1.5, from: 2, dig: 3.0, loot: 20, shot: "#f4e9c8" },
  sappeur: { name: "Sappeur", hp: 70, speed: 2.2, dmg: 5, range: 1.25, cd: 1.0, foe: true, cost: 1.5, from: 3,
    dig: 0.7, loot: 20 },
  priester: { name: "Lichtpriester", hp: 60, speed: 2.2, dmg: 5, range: 4.0, cd: 1.6, ranged: true,
    healer: true, foe: true, cost: 2.5, from: 4, dig: 3.2, loot: 30, shot: "#fff3b0" },
  ritter: { name: "Ritter", hp: 170, speed: 2.0, dmg: 15, range: 1.25, cd: 1.1, foe: true, cost: 3.5, from: 5,
    dig: 2.4, loot: 50 },
  // art = Aussehen einer anderen Art leihen (2D-Zeichnung und Ersatzfigur in 3D)
  zwerg: { name: "Erdbrecher", hp: 120, speed: 2.1, dmg: 10, range: 1.25, cd: 1.0, foe: true, cost: 2, from: 1,
    dig: 0.6, loot: 25, art: "sappeur" },
  feuermagier: { name: "Flammenruferin", hp: 75, speed: 2.2, dmg: 17, range: 5, cd: 1.9, ranged: true, foe: true,
    cost: 3, from: 2, dig: 3.0, loot: 40, shot: "#ff7a2c", doorMult: 3, art: "priester" },
  paladin: { name: "Ordensritter", hp: 260, speed: 1.9, dmg: 17, range: 1.3, cd: 1.1, foe: true, healer: true,
    cost: 4.5, from: 3, dig: 2.6, loot: 70, art: "ritter" },
  vogt: { name: "Lichtvogt", hp: 2100, speed: 1.9, dmg: 31, range: 1.6, cd: 1.0, foe: true, boss: true,
    cleave: true, cost: 99, dig: 1.2, loot: 500 },
};

/* ---------- Zauber (kosten Essenz) ---------- */
TT.SPELLS = [
  { key: "worker", name: "Wühler rufen", cost: 50, instant: true,
    desc: "Ruft einen weiteren Wühler an den Herzkern. Wird mit jedem Wühler teurer." },
  { key: "eye", name: "Erdauge", cost: 40, radius: 6,
    desc: "Deckt einen Bereich der Karte auf." },
  { key: "heal", name: "Heilnebel", cost: 70, radius: 2.5, research: "heal",
    desc: "Heilt deine Kreaturen im Umkreis um die Hälfte ihres Lebens." },
  { key: "spark", name: "Zornfunke", cost: 80, radius: 1.6, research: "spark",
    desc: "Ein Blitz aus dem Gestein: 70 Schaden an Eindringlingen im Umkreis." },
  { key: "drum", name: "Kriegstrommel", cost: 90, radius: 1, research: "drum",
    desc: "Alle Kämpfer sammeln sich 25 Sekunden lang am Zielfeld." },
  { key: "haste", name: "Hetzjagd", cost: 60, radius: 3, research: "haste",
    desc: "Kreaturen im Umkreis bewegen sich 15 Sekunden lang fast doppelt so schnell." },
];

/* ---------- Fallen und Türen (kosten Bauteile) ---------- */
TT.TRAPS = [
  { key: "door", obj: 1, name: "Bohlentür", parts: 6, hp: 320, research: "forge",
    desc: "Hält Eindringlinge auf. Deine Kreaturen gehen einfach hindurch." },
  { key: "spike", obj: 2, name: "Dornenfalle", parts: 4, dmg: 35, cd: 4, charges: 10, radius: 0.6, research: "forge",
    desc: "35 Schaden für jeden Eindringling, der darauf tritt. Hält 10 Auslösungen." },
  { key: "flame", obj: 3, name: "Glutschlund", parts: 10, dmg: 28, cd: 6, charges: 8, radius: 1.7, area: true,
    research: "flame", desc: "Feuerstoß gegen alle Eindringlinge im Umkreis. Hält 8 Auslösungen." },
];
TT.TRAP_BY_OBJ = {};
TT.TRAPS.forEach(function (t) { TT.TRAP_BY_OBJ[t.obj] = t; });

/* ---------- Forschung (der Reihe nach) ---------- */
TT.RESEARCH = [
  { key: "heal", name: "Zauber: Heilnebel", cost: 60 },
  { key: "forge", name: "Raum: Schmiede", cost: 120 },
  { key: "spark", name: "Zauber: Zornfunke", cost: 160 },
  { key: "prison", name: "Raum: Kerker", cost: 220 },
  { key: "drum", name: "Zauber: Kriegstrommel", cost: 260 },
  { key: "flame", name: "Falle: Glutschlund", cost: 320 },
  { key: "haste", name: "Zauber: Hetzjagd", cost: 380 },
  { key: "deep", name: "Tiefenbund (+25 % Leben)", cost: 500 },
];
