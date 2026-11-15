# Tiefenthron

Ein eigenständiges Dungeon-Management-Spiel im Geist der Klassiker des Genres:
Du bist der Geist im Herzkern, lässt graben, baust Räume, lockst Kreaturen an
und wehrst die Helden der Oberwelt ab.

Zwei Spielarten stehen im Hauptmenü zur Wahl:

- **Kampagne:** Beginnt mit dem Tutorial „Das Erwachen“, in dem Orm, der Steinflüsterer,
  Schritt für Schritt erklärt, was zu tun ist (mit Pfeil auf das Ziel und hervorgehobenem
  Knopf; jederzeit überspringbar). Danach acht Gebiete mit eigener Geschichte, von der Kalten Wiege bis
  unter den Thron des Lichts. Jedes Gebiet ist größer (48 × 36 bis 104 × 76 Felder),
  bringt neue Gegner, Räume und Zauber und hat ein Ziel: alle Siegelsteine brechen,
  dann den Endboss besiegen. Pro Gebiet gibt es bis zu drei Sterne.
- **Freies Spiel:** Eine Zufallskarte, Überfälle ohne Ende; der Lichtvogt kommt mit
  dem zehnten Überfall.

Reines HTML5 + JavaScript, keine Installation, keine Bild- oder Modelldateien:
Karte, Kreaturen und Klänge entstehen zur Laufzeit aus Code.

Es gibt zwei Ansichten, zwischen denen du jederzeit mit **V** wechselst:

- **3D** (Standard): dreh- und zoombare Kamera, Licht und Schatten, Fackeln,
  Partikel. Gezeichnet mit [Three.js](https://threejs.org) (liegt in `vendor/`
  bei, MIT-Lizenz). Braucht WebGL – fehlt es, startet das Spiel automatisch in 2D.
  Kreaturen, Wände, Böden und Einrichtung sind fertige, frei nutzbare Modelle von
  Quaternius und Kay Lousberg (KayKit), Rahmen und Partikel von Kenney, die Symbole
  von game-icons.net; Herkunft und Lizenzen stehen in `assets/QUELLEN.md`.
- **2D**: die flache Kartenansicht.

Der Look ist bewusst düster: zerklüftete, zusammenhängende Felsmasse statt Klötzen, weiche Schatten am Wandfuß, kühles Grundlicht, Fackeln, Glut und Kristalle als warme
Lichtquellen, kalter Nebel, dazu eine Nachbearbeitung mit Leuchten, leicht gedämpften Farben,
Abdunklung zum Rand, feinem Filmkorn und Kantenglättung. Im Hintergrund läuft eine leise Geräuschkulisse
aus Grollen und Tropfen. Auf langsamen Rechnern schaltet sich das Leuchten von selbst ab.

## Starten

- **In VS Code:** Ordner `Tiefenthron` öffnen (`Datei → Ordner öffnen`), dann **F5**
  drücken und „Tiefenthron starten (Edge)" wählen.
- **Ohne VS Code:** Doppelklick auf `index.html`.
- **Optional mit lokalem Server:** `node tools/serve.js`, dann <http://localhost:5173> öffnen.

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Linke Maustaste | Gestein anklicken oder überziehen: graben lassen · sonst: gewähltes Werkzeug benutzen |
| Rechte Maustaste ziehen | Karte schieben |
| Rechtsklick | Werkzeug ablegen (beim Greifen: Kreatur absetzen) |
| W A S D / Pfeiltasten | Karte schieben |
| Mausrad | Zoom |
| Q / E | Kamera drehen (3D) |
| Umschalt + rechte Maustaste ziehen (oder mittlere Maustaste) | Kamera drehen und neigen (3D) |
| V | zwischen 3D und 2D wechseln |
| G / H / X / Esc | Graben / Greifen / Abreißen / Auswählen |
| 1 – 7 | Räume |
| Leertaste / F / M | Pause / Tempo / Menü |

## So läuft eine Partie

1. **Graben:** Erdreich markieren, die Wühler tragen es ab und nehmen den Boden in Besitz.
2. **Riss erobern:** Einen Gang zum violetten Riss graben – durch ihn kommen Kreaturen.
3. **Räume bauen:** Schlafhöhle (ein Feld pro Kreatur), Pilzgarten (Futter),
   Schatzkammer (Lagerplatz), Übungshalle, Archiv (Forschung), später Schmiede und Kerker.
4. **Gold fördern:** Goldadern markieren. Kristalladern sind unerschöpflich, liegen aber weit draußen.
5. **Verteidigen:** Überfälle kommen durch die Schächte am Kartenrand und graben sich
   notfalls zum Herzkern durch. Türen, Fallen, Zauber und der Griff (Kämpfer aufheben
   und an der Front absetzen) helfen.

Welche Kreaturen kommen, hängt von deinen Räumen ab – die Tooltips in der
Werkzeugleiste verraten die Bedingungen. Alle 150 Sekunden ist Zahltag;
unbezahlte, hungrige oder obdachlose Kreaturen werden wütend und gehen.

### Ziele in der Kampagne

6. **Siegelsteine brechen:** Goldene Obelisken, die durch den Nebel schimmern und auf
   der Übersichtskarte golden blinken. Wachen des Ordens stehen daneben; sie verteidigen
   ihren Stein, verfolgen aber niemanden weit. Grab einen Gang hin, wirf deine Kämpfer
   mit dem Griff zu den Wachen, und sobald sie fallen, nehmen die Wühler den Stein ein.
7. **Endboss:** Sind alle Steine gebrochen, hören die normalen Überfälle auf. Nach
   20 Sekunden steigt der Boss mit Begleitern durch einen Schacht herab. Fällt er, ist
   das Gebiet erobert und das nächste wird frei.
8. **Sterne:** Gebiet erobert · Herzkern nie unter 50 % Leben · schneller als die Zielzeit.

Der Kampagnen-Fortschritt wird im Browser gespeichert, getrennt vom Spielstand.

## Aufbau des Codes

| Datei | Inhalt |
| --- | --- |
| `js/config.js` | Alle Zahlen: Räume, Kreaturen, Zauber, Fallen, Forschung, Balancing |
| `js/map.js` | Kartenerzeugung, Nebel, Wegfindung |
| `js/entities.js` | Verhalten von Wühlern, Kämpfern und Eindringlingen |
| `js/game.js` | Wirtschaft, Forschung, Überfälle, Siegelsteine und Endboss, Zauber, Spieleraktionen, Speichern |
| `js/tutorial.js` | Das Tutorial: Gebiet „Das Erwachen“ und Orms elf Schritte |
| `js/campaign.js` | Die acht Gebiete der Kampagne: Story, Kartengröße, Gegner, Freigaben, Bosse, Fortschritt |
| `js/render.js` | 2D-Ansicht, Kacheltexturen, Übersichtskarte |
| `js/models3d.js` | Selbstgebaute 3D-Modelle: Einrichtung, Fallen, Herzkern – und Ersatzfiguren für Kreaturen ohne fertiges Modell |
| `js/assets3d.js` | Zuordnung Kreatur → fertiges Modell und Animationen (`TT.MODEL_MAP`), Laden und Vorbereiten |
| `js/render3d.js` | 3D-Ansicht: Karte, Licht, Schatten, Partikel, Kamera, Mauszielerkennung, Animation |
| `assets/models/` | Eingebettete Kreaturenmodelle (CC0), Quellen in `assets/QUELLEN.md` |
| `assets/env/` | Eingebettete Umgebung: Wände, Böden, Fackeln, Türen, Fallen, Möbel (CC0) |
| `assets/fx/`, `assets/ui/`, `assets/fonts/` | Partikelbilder, verzierte Rahmen, Lizenztext der Schrift |
| `js/icons.js` | Symbole der Oberfläche (game-icons.net, CC BY 3.0) |
| `css/schrift.css` | Eingebettete Schrift Cinzel |
| `vendor/three.min.js` | Three.js 0.160 (fremde Bibliothek, unverändert) |
| `vendor/three-post.js` | Nachbearbeitung von Three.js (Leuchten, Bildausgabe), nur umverpackt – erzeugt mit `tools/make-post.js` |
| `vendor/three-addons.js` | Modell-Lader von Three.js, nur umverpackt, damit es ohne Webserver läuft |
| `tools/pack-models.js` | Verkleinert eine `.glb`-Datei und bettet sie ein (siehe `assets/QUELLEN.md`) |
| `tools/pack-props.js` | Wandelt unbewegte Modelle (Wände, Möbel) in ein kompaktes Format um |
| `tools/make-ui.js` | Bettet Symbole, Schrift, Rahmen und Partikelbilder ein |
| `js/ui.js` | Werkzeugleiste, Maus, Tastatur, Anzeigen, Menüs |
| `js/audio.js` | Erzeugte Klänge |
| `js/main.js` | Hauptschleife |
| `tools/simtest.js` | Schnelltest der Spiellogik: `node tools/simtest.js` |
| `tools/tutorialtest.js` | Spielt das Tutorial ohne Browser von vorn bis hinten durch |
| `tools/campaigntest.js` | Prüft alle Kampagnenkarten; mit `--bot` spielt ein Bot jedes Gebiet im Zeitraffer |

Zum Herumprobieren ist `js/config.js` der beste Einstieg: Kosten, Lebenspunkte,
Überfall-Abstände und Lockbedingungen lassen sich dort direkt ändern.
Wer am Aussehen schrauben will: Größe, Flughöhe, Ausrüstung und Animationen jeder
Kreatur stehen in `js/assets3d.js` (`TT.MODEL_MAP`). Wie man ein eigenes Modell
einbindet, beschreibt `assets/QUELLEN.md`.
