# Entscheidungen und Begründungen – Spielanalyse

Stand: 2026-10-15. **Entscheidungsprotokoll aus bisherigen Entwicklungsgesprächen; nicht jede Entscheidung ist vollständig implementiert.** Verbindlichen Code-Stand bitte anhand `main` und Tests prüfen.

## D-001 – Repository als dauerhafte Informationsquelle
**Entscheidung:** Architektur, Projektstand und fachliche Entscheidungen versioniert in `docs/` pflegen statt ausschließlich in Chatverläufen.  
**Warum:** Ältere Chats können archiviert/gelöscht werden; Anforderungen und Begründungen sollen für neue Entwicklungsrunden auffindbar bleiben.  
**Konsequenz:** `ARCHITECTURE.md`, `DEVELOPMENT_STATUS.md`, `DECISIONS.md` bei relevanten Änderungen fortschreiben. Chats erst löschen, wenn benötigte Einzelheiten gesichert sind.

## D-002 – Handballmetrics-kompatible Eventdaten
**Entscheidung:** Zusätzliche taktische Angaben nach Möglichkeit als Event-Tags ausdrücken und vorhandene JSON-Verarbeitung nicht unnötig verändern.  
**Warum:** Import-/Export-Kompatibilität und Auswertbarkeit erhalten.  
**Beispiele:** Aktive Deckungsformation (6:0, 5:1, 3:2:1, 3:3), Auslöserhandlungen (Aalborg, Mensa, Rolle, Jugo). Keine eigenständigen Ereignisse für abgebrochene Auslösehandlungen in der zunächst vereinbarten Ausbaustufe.  
**Prüfpunkt:** Tag-Feldnamen und tatsächliche Formatkompatibilität anhand der Implementierung absichern.

## D-003 – Neutrale Spiele und eigenes Team trennen
**Entscheidung:** Match-Scouting muss auch ohne „Mein Team“ funktionieren; UI verwendet Heim/Auswärts. Für Saisonanalysen wird ein eigenes Team explizit gewählt.  
**Warum:** Drittspiele neutral analysieren können, ohne falsche Zuordnung der Wurf-/Torwartstatistik.  
**Risiko:** Legacy-Migration setzt bei ungültigem `ownTeam` derzeit `away` – als offene Inkonsistenz separat aufgeführt.

## D-004 – Externe Spieleridentität behalten
**Entscheidung:** `handballNetId` als zusätzliches Spielerprofilfeld führen, aus offiziellen Spiel-/Lineupdaten übernehmen, lokale Roster nicht allein anhand flüchtiger Namen identifizieren.  
**Warum:** Kaderpflege und stabile Zuordnung über mehrere Spiele.  
**Prüfpunkt:** Fehlende IDs, Dubletten und Teilimporte explizit behandeln.

## D-005 – Handball360 über austauschbaren Proxy
**Entscheidung:** Match-Metadaten, Events, Lineups und Zusatzinfos über eigenen Backend-Proxy beziehen; die JSON-Antwortstruktur von Cloudflare Worker und Cloud Run kompatibel halten.  
**Warum:** Frontend unabhängig von konkretem Proxy halten und CORS/Upstream-Besonderheiten zentral verwalten.  
**Einschränkung:** Browser-Bearer-Token ist kein geheimes Authentifizierungsmerkmal. Der bisher fest eingebaute Token sollte nach früherer Absprache nicht als Nebenmaßnahme entfernt werden; Sicherheitsverbesserung separat planen.

## D-006 – Video- und Spielzeit getrennt halten
**Entscheidung:** Videobasierte Nachanalyse primär anhand Videozeit; Spielzeit kann fehlen oder aus Halbzeit- und weiteren Synchronisationspunkten abschnittsweise bestimmt werden.  
**Warum:** Aufzeichnungen enthalten Unterbrechungen, Sprünge und unvollständig synchronisierte Ereignisse.  
**UX:** Spielzeit direkt antippen und setzen; H1/H2-Sync; Event optional auf aktuelle Videozeit setzen. Keine Live-Spielzeituhr-Steuerung in reiner Nachanalyse/Video-Tab.

## D-007 – Match- und Video-Tab fachlich entkoppeln
**Entscheidung:** Nachanalyse und Ereignisbearbeitung im Match-Tab; Video-Tab auf Videosichten, Clipauswahl und Export konzentrieren.  
**Warum:** Doppelbedienung vermeiden und Verantwortung der Tabs klar halten.  
**Ergänzung:** Eventliste synchron scrollen, Long-Press öffnet nur Details ohne Seek; markierte Details schließen, wenn Event automatisch aus dem sichtbaren Bereich läuft.

## D-008 – Responsives Layout nach tatsächlichem Arbeitsablauf
**Entscheidung:** Unter dem Video Aktionen erfassen, daneben Ereignisliste; ausreichend großes Detailpanel; Breite Video/Eventliste auf Mobilgeräten anpassbar. Tablet-Aktionsbuttons möglichst in einer Zeile.  
**Warum:** Scouting auf iPad/iPhone soll ohne verdeckte Controls oder zu kleine Bearbeitungsflächen möglich sein.  
**Status:** Letzte Rückmeldung meldet zu kleine Eventdetails auf iPad; weiter prüfen.

## D-009 – Instagram aus HTML-Templates, nicht aus starren Layouts
**Entscheidung:** Drei unabhängige, lokal geladene selbstständige HTML-Templates für Matchday, Endstand/Halbzeit und Highlight; Validierung + Vorschau; Export muss dasselbe Layout verwenden.  
**Warum:** Individuelles Design und zuverlässige, offline-taugliche ZIP-/PNG-/MP4-Produktion.  
**Vorgaben:** 1080×1350, `data-field`-Bindungen, keine externen Ressourcen, Kommentar unterhalb des 16:9-Videobereichs; Wettbewerb und Logos anzeigen. Templates nicht allein in der Vorschau berücksichtigen.

## D-010 – Manuelle und importierte Spieldaten unterscheiden
**Entscheidung:** Setup bietet getrennte Aktionen „Spieldaten übernehmen“ und „Spielerlisten laden“; für manuell angelegte Begegnungen Wettbewerb erfassen, Standard „Freundschaftsspiel“.  
**Warum:** Offizielle Kader sind vor Spielbeginn möglicherweise noch nicht veröffentlicht; Termin/Halle/Wettbewerb trotzdem früh übernehmen.  
**Prüfpunkt:** Spielort darf nicht aus einem anderen Metadatenfeld geraten werden.

## D-011 – Tests und Referenzspiele als Freigabekriterium
**Entscheidung:** HKN-Referenz und Handball360-Fix­ture für reproduzierbare Regressionen; Vitest und Playwright auf Desktop/Mobil; GitHub Pages erst nach erfolgreichen Tests ausrollen.  
**Warum:** Umfangreiche PWA-Änderungen hatten wiederholt unbeabsichtigte Folgewirkungen.  
**Konsequenz:** Fehlschlagende Tests analysieren und beheben, nicht ohne Nachweis als „grün“ melden.

## D-012 – Git-Arbeitsweise
**Entscheidung:** Größere Feature-/Refactoring-Arbeiten auf separatem Branch; kleine Korrekturen und reine Dokumentation können direkt nach `main`, sofern keine weitere Abstimmung erforderlich ist.  
**Warum:** Entwicklungsaufwand niedrig halten und größere Änderungen kontrolliert zusammenführen.

## Pflegeformat für neue Entscheidungen

Bei neuer Entscheidung ergänzen: ID, Datum, Kontext, Entscheidung, Begründung, Alternativen/Trade-offs, Status (vorgeschlagen/entschieden/implementiert/getestet), betroffene Dateien und Commit/Testbeleg. Nie nur aus einer Chatantwort schließen, dass die Umsetzung bereits erfolgt ist.
