# Bedienreferenz der aktuellen PWA

Die Bezeichnungen orientieren sich am aktuellen `index.html`. Diese Referenz ergänzt die [Workflows](workflows.md), statt sie zu ersetzen.

## Setup
- **Neues Spiel:** Ein Spiel neu anlegen; im Dialog existiert die Option `Manuell anlegen`.
- **Spiel fortsetzen / Spiel laden:** Vorhandene JSON-Datei öffnen bzw. wiederverwenden; den angezeigten Spielstand prüfen.
- **Spieldaten übernehmen:** Import aus unterstützten Quellen (insbesondere Handball360); prüfe den übernommenen Kader und die Zuordnung Heim/Gast.
- **Teams/Kader:** Spieler manuell verwalten oder aus unterstützten Dateien übernehmen; Trikotnummern vor Scouting prüfen.
- **Datensicherung:** `Spiel speichern` aktualisiert ggf. eine geöffnete Datei, soweit der Browser das unterstützt; `Kopie exportieren` erzeugt eine neue JSON-Datei. iPhone/iPad können stattdessen Download/Teilen anbieten.

## Match: Ereignisse erfassen
- **Scouting-Modus:** `Live Scouting` / `Video Scouting`. Nach erstem Event ist Wechsel des Grundmodus gesperrt.
- **Realzeit (Live Scouting):** **Vor dem ersten Event und vor der Spieluhr** über `▶ Realzeit starten` einschalten. Die Realzeit läuft unabhängig von der Spielzeit und ist die Grundlage für das spätere Synchronisieren und Anspringen von Events im Video. Solange das Video eine durchgehende Zeitachse hat, die Realzeit auch bei Spielunterbrechungen/Halbzeitpause weiterlaufen lassen; nicht versehentlich über `Nullen` zurücksetzen.
- **Spielzeit:** Erst **nach** Start der Realzeit über `▶ SPIELZEIT STARTEN` einschalten; Spielzeitkorrektur und Halbzeitwechsel betreffen die Spieluhr. Die App verweigert im Live-Modus den Start der Spieluhr, wenn die Realzeit nicht läuft; Ereignisse sollten ebenfalls nicht vorher erfasst werden.
- **Spieler & Aktiver Torwart:** Auswahl passend zur Szene; der verfügbare Ereignisfluss bestimmt die weiteren Felder.
- **Video:** `YouTube laden` oder `Lokales Video` (Dateiauswahl).
- **H1/H2:** Legt die Anpfiffposition im Video fest. Die beiden Sync-Schalter gehören zur Video-Zeitzuordnung und starten keine Live-Uhr.
- **Video-Nachanalyse starten:** Für vorhandene Live-Events; die Live-Zeitstempel bleiben unverändert.
- **Eventliste:** Ereignisse auswählen, Szenen aufsuchen und deren Details bearbeiten; in der Videoanalyse werden videonahe Events angezeigt.

## Analyse und Saison
- **Analyse:** Einzelspiel-Auswertungen, Team-/Spielervergleich, Filter; bietet `Gefilterte Szenen im Video` und `Analyse als PDF`.
- **Saison:** Mehrere Spiel-JSONs zusammen auswerten; Quelldateien laut UI-Hinweis werden dabei nicht geändert. Das Saison-Team ist getrennt von Heim/Gast der einzelnen Spiele.

## Video
- **Aufgabe:** Video ansehen, Eventfilter nutzen, Clips vorbereiten und exportieren.
- **Zeitleiste/Steuerung:** Geschwindigkeit, Abspielposition, Zeitsprünge und Sync-H1/H2.
- **Zeichnungen:** Im Kontext eines Ereignisses erstellt und bearbeitet; `Zeichnungen anzeigen` steuert die Sichtbarkeit.
- **Vollbild zeichnen:** Zeichenmodus und Video-Wiedergabe bewusst umschalten; bestehende Objekte können ausgewählt und bearbeitet werden.
- **Clips:** Vor-/Nachlauf und Auswahl der Events prüfen, bevor Clips exportiert werden. Der Video-Tab ist nicht der primäre Ort, um völlig neue Spielevents zu erfassen.

## Daten editieren
- Bestehende Events bearbeiten, einschließlich Zeitangaben und Details.
- Zusätzlich vorhanden: **ACTA-Abgleich** für den Vergleich mit einem DHB-ACTA-Spielbericht.
- Jede Korrektur erst nach Kontrolle der zugrunde liegenden Video-/Spielzeit speichern.

## Was wir bewusst nicht behaupten
- Keine automatische millisekundengenaue Synchronisation bei Unterbrechungen.
- Kein integrierter Sportlounge-Login oder Streaming-Player.
- Kein aktiver nuLiga-Import.
- Keine garantiert identischen Browser-Dateidialoge auf iOS, iPadOS und Desktop.
