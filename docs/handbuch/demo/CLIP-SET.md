# Dokumentationsclips über den Spielanalyse-Companion

Diese Datei beschreibt das reproduzierbare Video-Testset zur bebilderten Dokumentation. **Es werden keine Videodateien veröffentlicht.**

## Fertiges Companion-Manifest

[companion-documentation-manifest.json](companion-documentation-manifest.json)

Das Manifest verwendet **das tatsächlich von `Spielanalyse-Companion/main.py` unterstützte Format** `handball-match-flow-clip-upload-manifest`. Es definiert fünf getrennte Ausgabe-MP4-Dateien, jeweils mit einem zusammenhängenden `start/end`-Segment und leeren `playlistTargets`. Es ist ausdrücklich kein Auftrag für einen YouTube-Upload.

| MP4-Datei | Quelle: Anfang–Ende (Videozeit) | Länge | Gezeigte Aktion |
|---|---:|---:|---|
| `doku_01_live_tor.mp4` | 00:54.524–01:09.524 | 15 s | Tor bei Spielzeit 01:03 |
| `doku_02_abwehr_situation.mp4` | 04:03.105–04:30.985 | 27,9 s | Tor bei 04:11 und Schlüsselmoment bei 04:18 |
| `doku_03_parade_gegenstoss.mp4` | 05:14.809–05:40.104 | 25,3 s | Parade bei 05:21, Gegenstoßtor bei 05:30 |
| `doku_04_highlight.mp4` | 19:27.057–19:45.057 | 18 s | Highlight-Tor bei Spielzeit 16:52 |
| `doku_05_zweite_halbzeit.mp4` | 32:17.234–33:07.299 | 50,1 s | Parade bei 25:17 und Tor bei 25:42 |

**Wichtig: Videozeit ist nicht Spielzeit.** Die Videozeiten sind aus der gespeicherten H1/H2-Synchronisation und `realTime` der Live-Ereignisse berechnet. Sie beziehen sich auf die ursprünglich synchronisierte Aufnahme, **nicht automatisch auf jede andere lokale MP4**. Insbesondere bei Sportlounge-Downloads mit geändertem Vorspann, Werbung oder Schnitten muss der Zeitversatz zuerst geprüft werden.

## Companion ausführen

1. Das JSON-Manifest herunterladen und beispielsweise in den `jobs/`-Ordner des privaten Companion-Repositories legen.
2. Im Companion-Ordner in der vorhandenen Python-Umgebung zunächst nur prüfen:

```powershell
python main.py jobs/companion-documentation-manifest.json --video "D:\Videos\referenzspiel.mp4" --dry-run
```

3. Die Zuordnung mit dem lokalen Video prüfen: Die erste Toraktion soll im Quellvideo um **01:04.5** liegen, die Parade/Gegenstoß-Sequenz um **05:25/05:32** und der erste Halbzeit-2-Beleg bei **32:29.2**. Bei einem konstanten Versatz alle `segments` entsprechend anpassen; bei unterschiedlich geschnittenen Videos ist eine neue Synchronisation nötig.
4. Wenn das passt, ausschließlich lokal rendern:

```powershell
python main.py jobs/companion-documentation-manifest.json --video "D:\Videos\referenzspiel.mp4" --render-only
```

Die fünf Dateien werden im konfigurierten `output/` abgelegt; weder YouTube noch eine Playlist wird dabei angesprochen.

## Für spätere Playwright-Screenshots

Das Manifest enthält in `documentationEvents` pro Ereignis `videoTime` (Position im Quellvideo) und `clipTime` (Position in der neuen kurzen MP4). Beispiel: Der Treffer bei Spielzeit 01:03 liegt im ersten Demo-Clip bei **00:10**. Die Demo-JSON muss beim Anzeigen der geschnittenen MP4 auf die neue Clip-Zeitachse umgerechnet werden. **Keine unveränderten H1/H2-Originalanker mit einer geschnittenen MP4 verwenden.**

## Ablage und Rechte

`jtaeubrich/Spielanalyse` ist **öffentlich**. Keine echten Aufnahmen erkennbarer minderjähriger Spieler in dieses Repository stellen, solange Veröffentlichung und Nutzungsrechte nicht geklärt sind. Geeignet ist ein eigenes privates Medien-Repository (mit Git LFS für größere MP4s), aus dem ein berechtigter Screenshot-Workflow die Clips herunterladen kann. Auch daraus erzeugte Screenshots mit erkennbaren Spielern dürfen nicht ungeprüft öffentlich verfügbar werden.

## Technische Kompatibilitätsnotiz

Der aktuelle PWA-Export bezeichnet sein Clip-Manifest an einer Stelle als `handball-spielanalyse-clip-upload-manifest`, der Companion akzeptiert dagegen `handball-match-flow-clip-upload-manifest`. Das **hier erzeugte** Dokumentationsmanifest verwendet bereits den im Companion akzeptierten Wert. Die abweichenden Kennungen sollten separat vereinheitlicht werden, wenn wir die regulären PWA-Manifeste durch den Companion schicken wollen.
