# Bedienreferenz der aktuellen PWA

Die Bezeichnungen orientieren sich am aktuellen `index.html`. Diese Referenz ergänzt den [Saison-/Einzelspiel-Einstieg](saison-workflow.md) und die [Scouting-Workflows](workflows.md), statt sie zu ersetzen.

## Setup
- **Neues Spiel:** Ein Spiel neu anlegen; im Dialog existiert die Option `Manuell anlegen`.
- **Spiel fortsetzen / Spiel laden:** Vorhandene JSON-Datei öffnen bzw. wiederverwenden; den angezeigten Spielstand prüfen.
- **Spiel aus Saison laden:** Im Setup-Tab eine Begegnung aus der lokal gespeicherten Saison auswählen. **Vorbereiten / fortsetzen** öffnet ein noch leeres oder ein zuvor im Live-Modus erfasstes Spiel; bereits mit offiziellen/Video-Ereignissen gefüllte Spiele werden über **Für Analyse öffnen** geladen. Die Verknüpfung zur Saison bleibt erhalten: Änderungen und Scouting-Ereignisse werden über die interne Spiel-ID automatisch im gleichen Saison-Datensatz gesichert; **Spiel speichern** schreibt sie ausdrücklich in den lokalen Saisonspeicher. Es entsteht dabei keine weitere JSON-Datei. **Kopie exportieren** erstellt weiterhin ein separates Backup. Für spätere Nutzung auf anderen Geräten das Saison-JSON bzw. Team-Archiv-ZIP exportieren. Der externe JSON-Import bleibt unabhängig.
- **Kader aus Handball360 aktualisieren (vor Spielbeginn):** Im Setup unter **Spiel aus Saison laden** das Saisonspiel auswählen und auf **Kader aus Handball360 aktualisieren** klicken. Die App nutzt die gespeicherte Match-ID und ruft die aktuell verfügbare offizielle Aufstellung ab. Die Vorschau zeigt für Heim und Gast gemeldete, entfernte und geänderte Spieler einschließlich Trikotnummern. Über **Offizielle Kader übernehmen** werden ausschließlich die Spielkader bestätigt; die globale Mannschaftssammlung bleibt unverändert. Fehlt eine offizielle Seite, wird deren bisheriger Kader beibehalten. Ist noch gar keine Aufstellung verfügbar, wird keine Änderung durchgeführt. Sobald Scouting-Ereignisse vorliegen, ist die automatische Kaderersetzung gesperrt, um Spielerzuordnungen zu schützen. Ein gleichzeitig bereits geöffnetes Saisonspiel wird mit aktualisiert, sodass Autospeichern die neuen Kader nicht überschreibt. Anschließend über **Vorbereiten / fortsetzen** das Live-Scouting öffnen und Trikotnummern kontrollieren.
- **Spieldaten übernehmen:** Import aus unterstützten Quellen (insbesondere Handball360); prüfe den übernommenen Kader und die Zuordnung Heim/Gast.
- **Teams/Kader:** Spieler manuell verwalten oder aus unterstützten Dateien übernehmen; Trikotnummern vor Scouting prüfen.
- **Datensicherung:** `Spiel speichern` aktualisiert ggf. eine geöffnete Datei, soweit der Browser das unterstützt; `Kopie exportieren` erzeugt eine neue JSON-Datei. iPhone/iPad können stattdessen Download/Teilen anbieten.

## Match: Ereignisse erfassen
- **Scouting-Modus:** `Live Scouting` / `Video Scouting`. Nach erstem Event ist Wechsel des Grundmodus gesperrt.
- **Bildschirmaufbau im Live Scouting:** Der Match-Tab zeigt **kein Videofenster und keine Ereignisliste**. Die volle Breite steht für Mannschaftsauswahl, Real-/Spielzeit, Ballbesitz und Ereigniserfassung zur Verfügung. Das letzte Event kann über **Letztes löschen** direkt neben der Ereignisanzahl rückgängig gemacht werden. Beim Wechsel zur **Video-Nachanalyse** oder zu **Video Scouting** werden Video und zugehörige Ereignisliste wieder eingeblendet.
- **Realzeit (Live Scouting):** **Vor dem ersten Event und vor der Spieluhr** über `▶ Realzeit starten` einschalten. Die Realzeit läuft unabhängig von der Spielzeit und ist die Grundlage für das spätere Synchronisieren und Anspringen von Events im Video. Solange das Video eine durchgehende Zeitachse hat, die Realzeit auch bei Spielunterbrechungen/Halbzeitpause weiterlaufen lassen; nicht versehentlich über `Nullen` zurücksetzen.
- **Spielzeit:** Erst **nach** Start der Realzeit über `▶ SPIELZEIT STARTEN` einschalten; Spielzeitkorrektur und Halbzeitwechsel betreffen die Spieluhr. Die App verweigert im Live-Modus den Start der Spieluhr, wenn die Realzeit nicht läuft; Ereignisse sollten ebenfalls nicht vorher erfasst werden.
- **Spieler & Aktiver Torwart:** Auswahl passend zur Szene; der verfügbare Ereignisfluss bestimmt die weiteren Felder.
- **Reihenfolge der Torwurf-Erfassung:** Im **Setup → Torwurf-Erfassung** lässt sich die Schützenauswahl für das aktuelle Spiel auf **Schütze zuerst** (Standard) oder **Schütze zuletzt (nach Hallensprecher)** setzen. Bei „zuletzt“ zuerst die eingestellten Wurfdetails, Torerfolg/Parade, ggf. Assist, Tags und Abwehrzuordnung erfassen; **erst danach den Schützen wählen**. Der Torabschluss wird anschließend mit dem ursprünglichen Ereigniszeitstempel gespeichert. Über **Unbekannt** kann man auch ohne Durchsage abschließen. Technische Fehler und Strafen behalten ihre bisherigen Abläufe.
- **Video:** `YouTube laden` oder `Lokales Video` (Dateiauswahl).
- **H1/H2:** Legt die Anpfiffposition im Video fest. Die beiden Sync-Schalter gehören zur Video-Zeitzuordnung und starten keine Live-Uhr.
- **Video-Nachanalyse starten:** Für vorhandene Live-Events; die Live-Zeitstempel bleiben unverändert.
- **Eventliste:** Ereignisse auswählen, Szenen aufsuchen und deren Details bearbeiten; in der Videoanalyse werden videonahe Events angezeigt.

## Analyse und Saison
- **Analyse:** Einzelspiel-Auswertungen, Team-/Spielervergleich, Filter; bietet `Gefilterte Szenen im Video` und `Analyse als PDF`.
- **Saison:** Mehrere Spiel-JSONs zusammen auswerten. Importierte unabhängige Originaldateien bleiben unverändert; direkt aus der Saison geöffnete Spiele werden dagegen mit dem lokalen Saisonarchiv synchronisiert. Der spätere Download per Saison-JSON oder ZIP bleibt ein separater Export.
- **Saison über Handball360 importieren:** Im Saison-Tab den Button öffnen, `https://www.handball.net/team/<ID>` oder die reine Team-ID sowie den Saisonzeitraum eingeben und auf **Spielplan laden** tippen. Für die zunächst selbst erfassten Spiele unter jeder passenden Begegnung **Manuelles Spiel zuordnen** wählen und die Verknüpfung bestätigen. Erst danach auf **Alle neuen auswählen (auch zukünftige)** und **Ausgewählte Spiele importieren** tippen. Bereits zugeordnete Spiele bleiben vom erneuten Import ausgeschlossen. Zukünftige Spiele werden als leere Partien angelegt, nach Möglichkeit mit bekannten vorläufigen Mannschaftskadern, und zunächst **nicht als gespielte Partien in die Statistik einbezogen**. Bei bestehenden Matches führt **Offizielle Daten aktualisieren** einen neuen Abruf aus: fehlende Metadaten/Spieler und – nur bei bislang leeren Ereignislisten – die offiziellen Ereignisse werden übernommen. Manuelle Ereignisse, Kommentare, Videos und Zeichnungen bleiben erhalten. Die automatische Dublettenerkennung ist nur eine Hilfestellung, manuelle Zuordnungen müssen kontrolliert werden.
- **Einschränkungen offizieller Statistiken:** handball.net stellt u. a. Tore, Strafen und Kader bereit, jedoch keine vollständige eigene Wurfzonen-/Paraden-/Abwehranalyse. Die Statistik aus ausschließlich offiziellen Ereignissen entsprechend vorsichtig interpretieren. Der Team-Spielplan-Abruf verwendet interne, nicht öffentlich zugesicherte Web-Endpunkte.
- **Spielerzuordnung:** Gleichnamige Spieler werden bei eindeutiger Identität unabhängig von Trikotnummern aggregiert; abweichende Schreibweisen über **Spieler zusammenführen** manuell zuordnen.
- **Team-Archiv (ZIP) exportieren:** Im Feld **Archiv-Mannschaft (jahrgangsunabhängig)** einen dauerhaft verwendeten Ordnernamen festlegen, z. B. `TSV Kronshagen mB`. Das ZIP enthält `TSV_Kronshagen_mB/Heimteam_vs_Gastteam_<Match-ID>/spiel.json` sowie die leeren Unterordner `videos/` und `exports/`. Die Ordnernamen enthalten **Heim- und Gastmannschaft in Spielreihenfolge** sowie die eindeutige Match-ID, beispielsweise `TSV_Kronshagen_vs_Gast_378112`. Die Namen werden für Dateipfade bereinigt. Bei Spielen ohne offizielle Match-ID steht am Ende ein `manuell_`-Schlüssel aus der internen Spiel-ID. Eine Indexdatei `Saison_2026_27_index.json` liegt direkt im Mannschaftsordner. Es gibt **keinen Saison- oder Handball360-Team-ID-Unterordner**; mehrere Saisonexporte können so bei der lokalen Ablage in denselben Mannschaftsordner entpackt werden. Die ZIP-Datei enthält **noch keine MP4-Videos**; diese können später in die vorgesehenen Unterordner kopiert werden. Der ZIP-Download ist für Browser ohne Ordner-Schreibzugriff vorgesehen. Die normale **Saison exportieren**-Funktion bleibt zusätzlich erhalten.

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
