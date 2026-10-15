# Architektur – Spielanalyse

Stand: 2026-10-15. Grundlage: Repository `main` (zuletzt geprüfter Ausgangscommit `7167d287`) und dokumentierte Entwicklungsanforderungen. **Code/Tests haben Vorrang vor dieser Beschreibung.** Nicht separat überprüfte UI-Details sind als Anforderungen gekennzeichnet.

## Zweck und Betriebsmodell

Browserbasierte Handball-Spielanalyse als PWA für Smartphone, Tablet und Desktop; primär Live-Scouting, Video-Nachanalyse, Match-/Saisonauswertung und Medienexport. Das Frontend liegt im Repository `jtaeubrich/Spielanalyse`; `index.html`, `manifest.webmanifest` und `sw.js` bilden den sichtbaren Einstieg und Offline-/PWA-Rahmen. Veröffentlichung erfolgt über GitHub Pages mit GitHub Actions (`.github/workflows/pages.yml`).

## Struktur (im Repository überprüft)

- `src/game-model.js`, `game-format.js`, `game-files.js`: Spielmodell, Format-/Versionsmigration und Dateien.
- `src/storage.js`, `roster.js`, `team-rosters.js`, `team-metadata-sync.js`: lokale Daten und Spielerkader/Mannschaftsdaten.
- `src/handball360.js`: Zuordnung von Spiel-/Spielerinformationen aus handball.net/Handball360.
- `src/video-sync.js`, `video-reference.js`, `video-playback.js`: Zuordnung Spielzeit ↔ Videozeit und Wiedergabe.
- `src/analysis-core.js`, `season-core.js`, `season-files.js`, `special-teams.js`: Match-, Saison- und Überzahlanalyse.
- `src/clip-*.js`, `instagram-*.js`: Clips, Medienerzeugung, HTML-Templates und Export.
- `templates/highlight.html`: versioniertes Highlight-Template.
- `cloud-run-proxy/`: Cloud-Run-Service für Handball360; gesonderte README beachten.
- `tests/`: Vitest-Regressionen, Playwright unter `tests/e2e` sowie Referenz-Fixtures. `TESTING.md` ist maßgeblich für Testaufrufe.

## Datenmodell und Kompatibilität

- Das interne Spieldateiformat wird durch `src/game-format.js` als `handball-spielanalyse`, Version `1`, ausgewiesen. Legacy-Daten werden migriert.
- Wesentliche Entitäten: Heim-/Auswärtsteam, Spielerkader, Ereignisse, aktive Abwehrformation, Zeit-/Video-Metadaten.
- `handballNetId` wird im Spielerprofil mitgeführt, damit Identitäten aus importierten Spielberichten wiedergefunden werden können.
- Die fachliche Vorgabe ist Kompatibilität zum Handballmetrics-JSON, insbesondere zusätzliche taktische Merkmale als Event-Tags. **Details der tatsächlichen Import-/Exportkompatibilität für jede Version sind anhand der Parser und Fixtures zu prüfen.**
- Neutrale Spiele sollen ohne Pflichtzuordnung `Mein Team` analysierbar sein. Achtung: Die Legacy-Migration in `game-format.js` setzt für fehlendes/ungültiges `ownTeam` derzeit `away`; dies ist separat gegen den Neutralmodus zu testen.

## Handball360-Anbindung

`cloud-run-proxy/README.md` dokumentiert den Cloud-Run-Proxy:
- `GET /match/<MATCH_ID>` bzw. `GET /?match=<MATCH_ID>`
- Kombinierte Antwort mit `match_id`, `match_url`, `match`, `events`, `lineups`, `additional_info`.
- Quellen: Match-Metadaten, Events, Aufstellungen und optionale Zusatzinformationen.
- Browser-PWA benötigt CORS; Bearer-Token im Browser ist **keine belastbare Geheimhaltung/Benutzerauthentifizierung**.
- Logos können über den gesonderten, auf bestimmte Hosts/Pfade eingeschränkten Proxy-Endpunkt geladen werden.
- Cloud-Run-Deployment via `.github/workflows/deploy-proxy.yml`. Ein separates Companion-Repository wurde in Gesprächen erwähnt; sein aktueller Quellstand ist **hier nicht geprüft**.

## Event- und Videoablauf (fachliche Zielsetzung)

- Event-Erfassung: Team/Spieler, Wurfzone, Torziel und Ergebnis sowie Spielsituation; ergänzend technischer Fehler, Strafe, Schlüssel-Moment, Auslösehandlung und Deckungsformation.
- Video-Nachanalyse: Videozeit als primäre Referenz; Ereignisse ohne gültige Spielzeit zulassen; Synchronisationspunkte für Halbzeiten und manuell gesetzte Spielzeiten; möglichst abschnittsweise Interpolation.
- `video-sync.js` unterscheidet explizite `realTime`-Werte von abgeleiteten/geschätzten Videozeiten. Geschätzte Werte werden nicht ungeprüft als bestätigte Werte in `realTime` geschrieben.
- Ereignisliste und Eventdetails: Auswahl, automatisches Scrollen, Long-Press für Details ohne Videosprung; Layout für Tablet/Smartphone. Dies sind teils dokumentierte UX-Anforderungen; Status siehe `DEVELOPMENT_STATUS.md`.

## Medienexport

- Instagram-Zielausgabe 1080 × 1350 (4:5); Matchday, Halbzeit, Endstand, Highlight.
- Drei getrennt ladbare HTML-Templates: `matchday`, `endstand` (auch Halbzeit), `highlight`; eigene Validierung und Vorschau.
- HTML/CSS ohne externe Ressourcen und mit definierten `data-field`-Feldern; Highlight-Video mit 16:9-Videobereich und Kommentaren außerhalb des Videobildes.
- Weitere Spezifikation und Integrationsprüfpunkte: `docs/instagram-html-export.md`.

## Qualität und Änderungsdisziplin

`npm run test:unit`, `npm run test:e2e`, `npm test` gemäß `TESTING.md`. Offizielle Handball360-Calls werden in Browser-Regressionen gemockt (Fixture), damit Tests reproduzierbar bleiben. Größere Refactorings/Features vorzugsweise auf Feature-Branch; kleine Korrekturen dürfen nach bisheriger Absprache direkt auf `main` erfolgen. Diese Datei bei Architekturänderungen aktualisieren.
