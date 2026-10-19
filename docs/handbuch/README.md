# Spielanalyse – Anwenderdokumentation (Phase 1)

**Stand:** 19.10.2026 · **Status:** Textfassung, Abgleich mit `index.html`; Screenshots und Videos folgen in Phase 2/3.

## Ziel und Leserführung

Die Dokumentation erklärt **zuerst die Arbeitsabläufe** und danach die einzelnen Bedienelemente. So finden Live-Scouter, Videoanalysten und Trainer ihren passenden Einstieg, ohne die gesamte Oberfläche kennen zu müssen.

## Inhaltsverzeichnis

1. **[Workflows](workflows.md)** – drei vollständige Arbeitsabläufe und Entscheidungshilfe
   - W1: ausschließlich Live Scouting
   - W2: Live Scouting mit anschließender Video-Nachanalyse
   - W3: ausschließlich Video Scouting
2. **[Bedienreferenz](bedienreferenz.md)** – Tabs, Zeitsteuerung, Synchronisation, Bearbeitung, Speicherung, Zeichnungen, Clips
3. **[Geräteguide](geraete.md)** – Smartphone Hoch-/Querformat, Tablet und PC; Schwerpunkt und Layout
4. Phase 2 (geplant): reale Ansichten des aktuellen Builds, beschriftete Screenshots, Schrittbilder; pro Bildschirmformat
5. Phase 3 (geplant): echte Bildschirmaufzeichnungen, kurze Workflow-Videos und Sprechertexte

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

## Nachweislage

Diese Fassung wurde mit den tatsächlich im aktuellen Repository vorhandenen UI-Bezeichnungen abgeglichen (`index.html`, Hauptbranch am Erstellungstag). Geräteeignung beschreibt Layout und beabsichtigte Nutzung, **keine durchgeführten Endgerätetests**. Bevor ein Screenshot oder eine Videoanleitung als verbindlich veröffentlicht wird, muss der dargestellte Flow im aktuellen Build praktisch durchlaufen werden.
