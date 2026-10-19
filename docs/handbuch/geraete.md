# Geräteguide – geplante und vorhandene Bedienung

**Stand Phase 1:** Layout- und Workflow-Leitfaden auf Basis der aktuellen CSS/UI-Struktur. **Keine reale Screenshotabnahme** auf den genannten Geräten. Dafür folgt Phase 2.

| Gerät | Empfohlener Schwerpunkt | Erwartete Darstellung | Phase-2-Nachweis |
|---|---|---|---|
| Smartphone **hochkant** | Live Scouting; schnelle Eventerfassung; Video Scouting unterwegs | Kompakte Controls; Videobereich und horizontal scrollbar angeordnete Events darunter, wo der Modus dies vorsieht | Setup, Match-Live, Video mit Eventkarten, Zeichnen |
| Smartphone **quer** | Video Scouting, Einzel-Szenen und Zeichnungen | Mehr horizontale Breite; Ereignisse beim Video; Vollbild-Zeichenwerkzeuge müssen erreichbar bleiben | Match-Video, Video-Tab, Vollbild/Orientierungswechsel |
| **Tablet** | Live + spätere Video-Nachanalyse; Spieler-/Event-Details | Breitere Video-/Event-Anordnung, größere Arbeitsfläche; konkrete Unterschiede je iPad/Browser prüfen | Nachanalyse, Eventdetails, Zeichnen, Clipfilter |
| **PC/Desktop** | Vertiefte Video-Nachanalyse; Szenenauswahl, Analyse und Export | Breite Video-/Event-Ansicht; im Video-Tab sollen Eventkarten nicht ineinanderschieben | Analyse, Daten editieren, Video, Cliperstellung |

## Gerätespezifische Abläufe

### Smartphone
- Für **Live**: Quer-/Hochkantwahl nach Erreichbarkeit der Ereignisbuttons, möglichst wenige Bedienwechsel.
- Für **Video**: Lokal heruntergeladene MP4 über `Lokales Video` auswählen; im Hochformat Eventkarten unterhalb des Videos nutzen.
- Für **Zeichnungen**: Im Vollbild die Werkzeugleiste beim Wechsel Hochkant → Querformat prüfen; Zeichenmodus zum Abspielen deaktivieren.

### Tablet
- Geeignet zum parallelen Überblick über Video, Events und Bearbeitungsdetails.
- Nachanalyse aus der gespeicherten Live-JSON starten; H1/H2 setzen; Szenen einzeln prüfen.
- Auf iPad besonders Speichern/Teilen der JSON und den lokalen MP4-Dateizugriff dokumentieren.

### Desktop
- Für längere Analyse- und Export-Sitzungen bevorzugen.
- Video, Ereignisse, Filter und Detailbearbeitung systematisch auf größere Bildschirmbreiten ausrichten.
- Browserseitige Dateiauswahl, mehrere Downloads und optionales direktes Überschreiben der gespeicherten JSON gesondert erläutern.

## Phase 2: Verbindliche Screenshots

Pro Gerät sollten **echte Screenshots des gleichen Testspiels** entstehen, nicht verschiedene Demo-Daten. Mindestansichten:
1. Setup nach Spielanlage, 2. Live Scouting während Eventerfassung, 3. Video Scouting mit lokalem MP4,
4. Video-Nachanalyse mit H1/H2 und Eventliste, 5. Event-Details, 6. Zeichnen im Vollbild,
7. Video-Tab mit Clip-Auswahl, 8. Analyse. 

Jedes Bild bekommt: **Gerät/Bildschirmgröße, Orientierung, Build/Commit, Workflow, Handlung und erwartetes Ergebnis**. Defekte oder noch nicht geprüfte UI nicht als abgeschlossen dokumentieren.

## Phase 3: Vorschlag für reale Bildschirmvideos
- **W1 Live auf Smartphone:** Spiel vorbereiten → Uhr → zwei Ereignisse → sichern (ca. 90–120 s).
- **W2 Live + Video auf Tablet/PC:** Live-JSON öffnen → MP4 → H1/H2 → Event prüfen → annotieren → Clip (ca. 2–3 min).
- **W3 Video auf Smartphone quer + PC:** Spiel anlegen → Video Scouting wählen → erstes Event → analysieren (ca. 2 min).
- **Zeichnungen:** Vollbild, Form wählen/ändern/löschen, Abspielen, Einblendzeit (ca. 60–90 s).

Videoaufnahmen sollten den tatsächlichen HTML-Build zeigen; Phase 1 liefert dafür Ablauf/Sprecherstruktur, **keine angeblich schon gerenderten Screencasts**.
