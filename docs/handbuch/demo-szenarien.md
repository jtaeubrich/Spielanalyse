# Reproduzierbare Dokumentations-Szenarien (Stand 2026-10-19)

Referenzspiel: 03.10.2026, HSG Herzhorn/Kollmar/Neuendorf – TSV Kronshagen (Regionalliga Nord mB).

Die hochgeladene Original-JSON enthält **136 Ereignisse** und Kader beider Mannschaften. Die Bild-/Video-Dokumentation soll daraus sieben deterministisch reproduzierbare Szenarien verwenden:

| Szenario | Datenzustand |
|---|---|
| `00-setup` | Spiel & Kader, keine Ereignisse |
| `01-live-early` | Erste 12 Events |
| `02-live-mid` | Erste 57 Events |
| `03-live-complete` | Alle 136 Events |
| `04-live-video-review` | Alle Events und vorhandene H1/H2-Synchronisationsmarker |
| `05-video-scouting-early` | Erste 12 Events als Video-Scouting-Demo (ohne übernommene Live-Realzeit) |
| `06-video-scouting-complete` | Alle Events als Video-Scouting-Demo (ohne Live-Realzeit) |

**Datenschutz:** Spielerdaten Minderjähriger niemals ungefragt als öffentliche Demo-JSON committen. Stattdessen pseudonymisierte Szenario-Dateien verwenden. Das Original bleibt unverändert und darf nicht in ein öffentliches GitHub-Repository gelangen.

**Präzision:** Die Quell-JSON ist ein Live-/Analyse-Export, nicht zwingend ein vollständiger Match-Endzustand; die Jugendspielzeit beträgt 2 × 25 Minuten. Die Video-Scouting-Szenarien sind didaktische Ableitungen derselben Ereignisse, keine behaupteten historisch getrennt gescouteten Analysen.

**Screenshot-Plan:** Je Szenario einen echten Browser-Screenshot von Setup und Match mit Playwright (Smartphone hochkant 390×844; quer 844×390; Tablet 1024×768; Desktop 1440×900). Für authentische Videoframes und Screenshotprüfung muss später das lokale, berechtigt nutzbare MP4 eingebunden werden. Browser-Viewport-Emulation ist kein echter iPhone-/iPad-Test.

**Bereitstellung:** Die generierten Fixtures und die Generator-/Capture-Skripte wurden zunächst als separates ZIP im Chat bereitgestellt. Das ZIP muss anschließend in ein dafür freigegebenes, vorzugsweise privates Ablageziel übernommen werden. Dieser Dokumentationsabschnitt enthält absichtlich **keine** personenbezogenen Originalereignisse.
