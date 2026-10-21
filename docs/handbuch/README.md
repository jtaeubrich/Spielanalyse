# Spielanalyse – Anwenderdokumentation

**Stand:** 21.10.2026 · **Status:** Text und statische Screenshots der echten PWA in Workflows und integrierter `? Hilfe`. Video-Szenen folgen separat.

## Ziel und Leserführung

Die Dokumentation erklärt **zuerst die Arbeitsabläufe** und danach die einzelnen Bedienelemente. So finden Live-Scouter, Videoanalysten und Trainer ihren passenden Einstieg, ohne die gesamte Oberfläche kennen zu müssen.

## Inhaltsverzeichnis

1. **[Workflows](workflows.md)** – drei vollständige Arbeitsabläufe und Entscheidungshilfe
   - W1: ausschließlich Live Scouting
   - W2: Live Scouting mit anschließender Video-Nachanalyse
   - W3: ausschließlich Video Scouting
2. **[Bedienreferenz](bedienreferenz.md)** – Tabs, Zeitsteuerung, Synchronisation, Bearbeitung, Speicherung, Zeichnungen, Clips
3. **[Geräteguide](geraete.md)** – Smartphone Hoch-/Querformat, Tablet und PC; Schwerpunkt und Layout
4. **[Bildbeispiele](images/generated/)** – echte Playwright-Aufnahmen, für die integrierte Hilfe ausgewählt und verkleinert
5. Phase 3 (geplant): Szenen aus dem Companion, Videoanleitungen und vertiefte Vollbild-/Zeichenabläufe

## Welchen Ablauf brauche ich?

| Ausgangslage | Workflow | Hauptansicht |
|---|---|---|
| Ich sitze live beim Spiel und möchte unmittelbar Ereignisse erfassen | [W1 Live](workflows.md#w1--ausschließlich-live-scouting) | Match / Live Scouting |
| Ich erfasse live und ergänze anschließend Details mit Video | [W2 Live + Video](workflows.md#w2--live-scouting-und-spätere-video-nachanalyse) | Match / Live Scouting → Video-Nachanalyse |
| Ich habe ein fertiges Video, aber noch keine Ereignisse | [W3 Video](workflows.md#w3--ausschließlich-video-scouting) | Match / Video Scouting |

**Gemeinsam für alle Workflows:** Spielanlage im Setup, Ereignisse in derselben Spieldatei, Analyse und Speichern/Export. Sportlounge-Videos werden als MP4 heruntergeladen und über `Lokales Video` geöffnet. nuLiga ist aktuell **keine** vorgesehene Datenquelle.

## Begriffsklärung

- **Live Scouting:** Ereignisse während des laufenden Spiels erfassen; Spielzeit wird in der App geführt.
- **Video Scouting:** Ereignisse nachträglich anhand eines Videos neu erfassen; keine laufende Spieluhr erforderlich.
- **Video-Nachanalyse:** Bereits erfasste Live-Ereignisse an einem späteren Video prüfen und ergänzen.
- **Video-Tab:** Video betrachten, Ereignisse filtern, Zeichnungen nutzen und Clips produzieren; kein Ersatz für den Ereigniserfassungsmodus im Match-Tab.
- **H1/H2-Sync:** Startposition der ersten/zweiten Halbzeit im Video markieren. Spielunterbrechungen können Abweichungen verursachen.
- **Spielzeit / Videozeit:** Zeit auf der Spieluhr versus Abspielposition des Videos; nicht gleichsetzen.
- **Ereignis-Kontext:** Zeichnungen sind mit einem Event verknüpft, nicht global mit dem gesamten Video.

## Herkunft und Aktualisierung der Screenshots

Die Screenshots werden in GitHub Actions mit der tatsächlichen PWA und pseudonymisierten Spiel-JSONs unter `docs/handbuch/demo/fixtures/` aufgenommen. `capture_screenshots.py` liefert die vollständigen Screenshots als CI-Artefakt; `publish_help_images.py` erzeugt aus ausgewählten Ansichten verkleinerte Bilder für `docs/handbuch/images/generated/`. Der Workflow schreibt diese Bilder auch dauerhaft auf `main` und wird bei Änderungen an App oder Demo-Automatisierung erneut gestartet.

Für die integrierte Hilfe sind insbesondere [W1 Live](images/generated/w1-live-desktop.jpg), [W2 Nachanalyse](images/generated/w2-review-desktop.jpg) und [W3 Video-Scouting](images/generated/w3-video-desktop.jpg) enthalten. Das lokale Spielvideo ist **noch nicht eingebunden**. Browser-Screenshots ersetzen keinen Test auf echten iOS-/iPadOS-Geräten. Die automatischen Bilder müssen nach größeren UI-Änderungen zusätzlich visuell geprüft werden.

## Nachweislage

Diese Fassung wurde mit den tatsächlich im aktuellen Repository vorhandenen UI-Bezeichnungen abgeglichen (`index.html`, Hauptbranch am Erstellungstag). Geräteeignung beschreibt Layout und beabsichtigte Nutzung, **keine durchgeführten Endgerätetests**. Die Demo-Workflows werden automatisch im Browser durchlaufen; ein grüner CI-Lauf bestätigt die technischen Checks und die Bilderzeugung, ersetzt aber keine visuelle Prüfung der dargestellten Aktionen.
