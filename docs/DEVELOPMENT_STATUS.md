# Entwicklungsstand und Arbeitsliste – Spielanalyse

Stand: 2026-10-15. Basis: `main` am 2026-10-14, Ausgangscommit `7167d287`, vorhandene Module/Dokumente und bisher besprochene Anforderungen. **„Vorhanden“ bedeutet nicht automatisch in der UI oder produktiv erfolgreich getestet.** Keine Live-Ausführung der Test-Suite erfolgte bei der Erstellung dieser Dokumentation.

## Bestätigte Repository-Bausteine

- PWA-Einstieg `index.html`, `manifest.webmanifest`, `sw.js`.
- Module für Spielmodell/JSON-Version, Spielerlisten und Teams, Handball360, Video-Synchronisation, Analyse/Saisonanalyse, Clip-/Instagram-Export.
- Cloud-Run-Proxy mit Handball360-Antwortstruktur und eigenem Deployment-Workflow.
- Vitest/Playwright inkl. HKN- und Handball360-Referenzen; Testverfahren in `TESTING.md`.
- Letzte in GitHub geprüfte Commits vom 2026-10-14: „Add editable review match clock sync dialog and segmented interpolation between anchors“, „Fix video clock time input validation regex“, „Regression test for editable match clock sync dialog“.

## Funktionale Ziele / gewünschte Bedienung

| Bereich | Erwartetes Verhalten | Status dieser Prüfung |
| --- | --- | --- |
| Setup | Matchdaten aus Handball360 übernehmen, Wettbewerb/Halle/Anwurfzeit/Spielort anzeigen; Spielerlisten getrennt laden; Spiel fortsetzen oder neu erstellen | Modul vorhanden; Gesamtablauf nicht manuell geprüft |
| Neutralmodus | Heim/Auswärts statt Mein Team/Gegner ohne zugewiesenes eigenes Team; Mein Team für Saisonanalyse separat wählen | Anforderung besprochen; Migration mit `ownTeam`-Fallback gezielt prüfen |
| Match | Torabschluss, technischer Fehler, Strafe, Schlüssel-Moment; Auslöser-Handlung und Deckungstag; Freiwurf als Angriffsstopp ohne Statistikabschluss | Teilweise implementierungsbezogene Anforderungen; end-to-end prüfen |
| Video-Nachanalyse | Video und Ereignisse nebeneinander, Detailpanel responsiv; Play/Seek/Edit auf Videozeitbasis | Module vorhanden; iPad-Layout und Bedienung prüfen |
| Zeit-Sync | H1-/H2-Anker, antippbare Spielzeit und zusätzlicher Anker mit abschnittsweiser Interpolation | Commit vom 2026-10-14 belegt Implementierungsarbeit und Regressionstest; manuelle Prüfung offen |
| Eventliste | Auto-Scroll mit Puffer, Event-Details bei auslaufender Auswahl schließen, Long-Press nur Details ohne Seek, Sprung zur aktuellen Videozeit | Anforderungen aus Gesprächen; Ist-Verhalten prüfen |
| Analyse/Saison | Match-/Teamvergleich, Wurf- und TW-Quoten, Strafen/Überzahl; absolute und Durchschnittswerte | Core-Module/Tests vorhanden; weitere Saison-Fixtures erwünscht |
| Instagram | 3 Template-Uploads, Vorschau/Validierung, Matchday/Halbzeit/Endstand-HTML/PNG und Highlight-MP4 im ZIP, Logos/Wettbewerb | Module und Spezifikation vorhanden; Preview-Export-Parität und mobile Darstellung prüfen |
| Responsive UI | Smartphone quer: Video/Events rechts mit einstellbarem Verhältnis; Tablet Angriffsbuttons in einer Reihe und ausreichend große Eventdetails | Bekannte UX-Prüfpunkte |

## Konkrete offene Prüfungen

1. **P0 – Keine Datenverluste:** Import/Export von Legacy- und neuen Spiel-JSONs; `handballNetId` und Eventzeiten unverändert erhalten; nie fremde Events überschreiben.
2. **P0 – Neutralmodus:** Keine stille Festlegung von `ownTeam=away` bei neutralen Spielen; Auswirkungen von `game-format.js` auf Setup, Match und Saison prüfen.
3. **P0 – Videozeit:** Manuelles Setzen der Spielzeit erzeugt korrekten Sync-Anker; Interpolation zwischen benachbarten Ankern und über Halbzeitgrenzen testen. Events ohne Spielzeit bleiben zulässig.
4. **P1 – iPad-Layout:** Eventdetails unten rechts nicht zu klein; Liste dynamisch reduzieren oder Details unter Video, gemäß letzter UX-Rückmeldung.
5. **P1 – Event-Interaktion:** Long-Press ohne Videosprung; Auto-Scroll, selektiertes Event und Detailzustand; Funktion „Event auf aktuelle Videozeit setzen“ im Match-Modus.
6. **P1 – Importqualität:** Wettbewerb, Halle und insbesondere *Spielort* aus Handball360 korrekt und nachvollziehbar zuordnen; Mannschaftslisten nicht vor Veröffentlichung implizit laden.
7. **P1 – Instagram-Export:** Alle drei Templates tatsächlich auf Export anwenden, keine fehlenden Platzhalter; Kommentar unter statt über Video; Teamlogos und lange Namen.
8. **P2 – Saisonregression:** Weitere echte Saison-JSONs als Fixtures, Player-Matching (Handball360-ID), Keeper-Quoten, Absolute/Durchschnitt und Strafen.
9. **P2 – Stabilisierung:** Mobile/iPad-E2E, Lade-/Fortsetzen-Buttons, Events ohne Zeitanker, Cache/PWA-Update-Verhalten und Export in Safari überprüfen.
10. **P2 – Sicherheitsreview:** Im Browser eingebettete Token nicht als geheim einstufen; Cloud-Run-Rate-Limits und Missbrauchsschutz untersuchen, ohne bestehende Integration ungeprüft zu brechen.

## Referenzdaten und Testablauf

- `tests/fixtures/hkn_reference.json`: laut `TESTING.md` 136 Events, 26:35, 61 Tore, 19 Paraden, 17 Fehlwürfe, 25 TF, 5 Zeitstrafen.
- `tests/fixtures/handball360_378107.json`: offizieller Handball360-Fixture.
- `npm run test:unit`, `npm run test:e2e`, `npm test`.
- Der zuletzt berichtete grüne CI-Status aus älteren Chats ist **kein verifizierter aktueller CI-Status**. Vor Freigabe letzten Workflow-Run prüfen.

## Fortführung in neuen Chats

Zuerst `docs/ARCHITECTURE.md`, diese Datei und `docs/DECISIONS.md` lesen; dann den aktuellen `main`-Stand, relevante Commits und Tests einsehen. Ein Punkt darf erst von „Prüfbedarf“ auf „Verifiziert“ gesetzt werden, wenn konkrete Datei/Test/Commit oder manuelle Prüfung angegeben ist. Nach jeder größeren Änderung Status und Entscheidungskatalog mit aktualisieren.
