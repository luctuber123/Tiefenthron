# Quellen der 3D-Modelle

Alle Kreaturenmodelle in `assets/models/` stammen aus frei nutzbaren Paketen unter
**CC0 1.0 (Public Domain)**: Sie dürfen ohne Auflagen verwendet, verändert und
weitergegeben werden, auch kommerziell. Eine Namensnennung ist nicht vorgeschrieben,
geschieht hier aber gern.

Die Dateien wurden mit `tools/pack-models.js` verkleinert (nicht benötigte
Animationen entfernt) und als Skript eingebettet. Aussehen und Animationen sind
unverändert.

## Eindringlinge: KayKit – Adventurers Character Pack 1.0

- Urheber: Kay Lousberg, <https://www.kaylousberg.com>
- Quelle: <https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0>
- Lizenz: CC0 1.0, <http://creativecommons.org/publicdomain/zero/1.0/>

| Datei | Originalmodell | Im Spiel |
| --- | --- | --- |
| `rogue.js` | Rogue | Milizionär |
| `rogue_hooded.js` | Rogue_Hooded | Armbrustschütze |
| `barbarian.js` | Barbarian | Sappeur |
| `mage.js` | Mage | Lichtpriester |
| `knight.js` | Knight | Ritter und Lichtvogt (golden eingefärbt) |

## Deine Horde: Quaternius – Ultimate Monsters

- Urheber: Quaternius, <https://quaternius.com>
- Quelle: <https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6>
- Lizenz: CC0 1.0, <https://creativecommons.org/publicdomain/zero/1.0/>

| Datei | Originalmodell | Im Spiel |
| --- | --- | --- |
| `orc_blob.js` | Orc Enemy | Wühler |
| `orc.js` | Orc | Schrat |
| `dragon.js` | Dragon | Glutspucker |
| `wizard.js` | Wizard | Flüsterer |
| `demon.js` | Demon | Eisenwanst |
| `ninja.js` | Ninja | Dornenklinge |
| `ghost.js` | Ghost Skull | Nachtmahr |

## Umgebung: KayKit – Dungeon Remastered, Furniture Bits, Halloween Bits

- Urheber: Kay Lousberg, <https://www.kaylousberg.com>
- Quellen: <https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0>,
  <https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0>,
  <https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0>
- Lizenz: CC0 1.0

Wände, Böden, Fackeln, Türen, Fallen, Münzstapel, Truhen, Betten, Fässer, Tische,
Bücher, Knochen und Laternen in `assets/env/` stammen aus diesen Paketen. Sie wurden
mit `tools/pack-props.js` in ein kompaktes Format umgewandelt; die Formen sind unverändert.

## Oberfläche und Effekte

| Baustein | Quelle | Urheber | Lizenz |
| --- | --- | --- | --- |
| Symbole in Werkzeug- und Kopfleiste (`js/icons.js`) | <https://game-icons.net>, <https://github.com/game-icons/icons> | Lorc, Delapouite, Sbed | **CC BY 3.0** – Namensnennung erforderlich |
| Verzierte Rahmen (`assets/ui/`) | <https://kenney.nl/assets/fantasy-ui-borders> | Kenney | CC0 1.0 |
| Flamme, Rauch, Stern (`assets/fx/partikel.js`) | <https://kenney.nl/assets/particle-pack> | Kenney | CC0 1.0 |
| Schrift Cinzel (`css/schrift.css`) | <https://github.com/google/fonts/tree/main/ofl/cinzel> | The Cinzel Project Authors | SIL Open Font License 1.1, Text in `assets/fonts/OFL.txt` |

Die Symbole sind als einziger Baustein nicht gemeinfrei: Wer das Spiel weitergibt, muss
die Zeichner nennen. Das geschieht im Start- und Pausenmenü des Spiels und hier.
Verwendet werden: arrow-cursor, bed, bookshelf, cage, drum, gold-stack, healing, miner,
mushrooms, receive-money, two-coins (Delapouite); anvil, cog, crossed-axes, crossed-swords,
crystal-shine, fire-ring, grab, lightning-storm, mining, minions, scroll-unfurled, sprint,
third-eye, wooden-door, wrecking-ball (Lorc); spikes (Sbed). Die Rahmen wurden umgefärbt,
alles andere ist unverändert. Erzeugt werden die Dateien mit `tools/make-ui.js`.

## Mehrspieler-Verbindung: PeerJS

`vendor/peerjs.min.js` ist PeerJS 1.5.4 von Michelle Bu, Eric Zhang und Mitwirkenden (https://peerjs.com),
MIT-Lizenz (Text in `vendor/peerjs.LICENSE.txt`), bezogen über https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js.
Nur der Verweis auf die Quellkarte am Dateiende wurde entfernt. Für den Verbindungsaufbau nutzt PeerJS seinen
kostenlosen öffentlichen Vermittlungsdienst (0.peerjs.com); übertragen wird dort nur die zufällige Raumkennung.

## Eigene Modelle hinzufügen

1. Eine `.glb`-Datei besorgen (auf die Lizenz achten).
2. Einbetten: `node tools/pack-models.js pfad/zur/datei.glb meinmodell --keep Idle,Walk`
3. In `index.html` eine Zeile `<script src="assets/models/meinmodell.js"></script>` ergänzen.
4. In `js/assets3d.js` unter `TT.MODEL_MAP` der Kreatur das Modell und ihre Animationen zuordnen.

Fehlt für eine Kreatur ein Modell, zeigt das Spiel automatisch die selbstgebaute
Figur aus `js/models3d.js`.
