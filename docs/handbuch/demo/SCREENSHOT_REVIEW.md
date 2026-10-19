# Review: Playwright-Dokumentationsscreenshots

**Geprüfter Workflow-Lauf:** [39314030405](https://github.com/jtaeubrich/Spielanalyse/actions/runs/39314030405) (19.10.2026). Basis des Reviews sind die tatsächlich heruntergeladenen 56 PNG-Dateien aus dem GitHub-Actions-Artefakt `documentation-screenshots`.

## Technische Prüfung

- 56/56 PNGs vorhanden, je 14 für `desktop`, `tablet`, `phone-portrait`, `phone-landscape`.
- 41 unterschiedliche Datei-Hashes; einige gleiche Setup-Ansichten sind normal, weil dasselbe Spiel denselben Kader und Spielstand besitzt.
- 28/28 Importvorgänge laut Laufprotokoll verifiziert: 7 Fixtures × 4 Bildschirmgrößen.
- Je Fixture wurden im Runner Spielname, Anzahl der sichtbaren Events, Scouting-Modus und Spielstand kontrolliert.

## Bildinhalt: Befunde

| Befund | Bedeutung | Behandlung |
|---|---|---|
| Vollständiges Spiel zeigt `74:43` statt `49:43` | Fixture speicherte bei Halbzeit 2 fälschlich eine kumulative statt einer halbzeitrelativen Timer-Zahl | In `03`, `04`, `06` korrigiert: `secondsElapsed=1483` bei `gameTime=2983` |
| Toast „Spiel zum Fortsetzen geladen“ über den Bildern | Dokumentationsaufnahmen sind überlagert | Runner wartet vor jedem Screenshot auf ausgeblendeten Toast |
| `04-live-video-review` sieht wie `03-live-complete` aus | Das Laden der JSON aktiviert die Video-Nachanalyse nicht automatisch | Runner drückt `Video-Nachanalyse starten` und prüft `body.match-review-mode` |
| Smartphone-Hochformat: gespeichertes Vollseitenbild 429 Pixel breit, emulierter Viewport 390 Pixel | Horizontaler Überlauf / responsives Layout ist noch zu untersuchen; keine echte iPhone-Messung | Separater UI-Befund, **nicht** durch Abschneiden/Skalieren vertuschen |
| Schwarze/leere Videooberfläche in Video-Scouting-Screenshots | Noch kein MP4 oder Video-Sample vorhanden | Erwartete Einschränkung ohne echtes Videomaterial; Videoszenen folgen in separater Phase |
| Setup-Bilder je Spielstand teilweise gleich | Setup enthält nicht alle Modusunterschiede | Erwartete Wiederholungen; für Workflow-Doku Match-/Analyse-/Video-Zustände gezielt aufnehmen |

## Nachbearbeitung

Die Korrekturen der drei screenshotbezogenen Fehler liegen auf `main`. Ihr Erfolg muss **im nächsten GitHub-Actions-Lauf** geprüft werden. Der grüne Lauf 39314030405 belegt nur die *vorherige* Version.

Für eine publizierbare Phase-2-Doku fehlen weiterhin gezielt aufgenommene Szenen von **Daten editieren, Analyse, Video-Tab, Eventdetails, Vollbild-Zeichnen und Clip-Export**. Diese sollen in einem weiteren Schritt als eigene Screenshot-Szenarien automatisiert werden. Die bestehenden 56 Bilder decken nur Setup und Match ab.

**Prüfregel:** Kein Screenshot wird allein wegen eines grünen CI-Status als fachlich korrekt freigegeben.
