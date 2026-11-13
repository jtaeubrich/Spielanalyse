# Team Space – gemeinsame Saisons und Spiele

Der **Team Space** ist der dritte Einstieg auf der Startseite, neben
**Saison** und **Einzelspiel**. Die lokalen Arbeitsbereiche bleiben bestehen.
Im Team Space sehen die Spieler die vom Trainer veröffentlichten Saisons
und einzelnen Spiele. Es werden **keine persönlichen Kommentare, Tags,
Zeichnungen, Schlüsselmomente oder eigenen Änderungen** in die Cloud
zurückgeschrieben.

## Für Spieler

1. **Start → Team Space** öffnen.
2. Einmal den Einladungslink vom Trainer in **Team Space verbinden oder verwalten**
   einfügen, oder den Link direkt öffnen. Der Zugang bleibt auf diesem Gerät.
3. In der Liste sind für jede Saison und jedes Spiel drei Zustände möglich:
   **Noch nicht importiert**, **Aktuell** oder **Update verfügbar**.
4. Eine Saison über **Importieren** auf das Gerät übernehmen. Spätere
   Veröffentlichungen erscheinen unter **Aktualisieren**. Vor der Übernahme
   erscheint die Abgleichvorschau: persönliche Markierungen bleiben lokal.
5. Ein einzelnes Spiel kann als **eigenständiges Einzelspiel** importiert
   oder mit **Zur Saison** einer lokal gespeicherten Saison zugeordnet
   werden. Bei erneutem Öffnen erkennt die App bereits importierte Spiele
   an ihren Kennungen, damit keine unbeabsichtigte zweite Kopie entsteht.
6. **Einzelspiel** und **Saison** auf der Startseite bleiben die gewohnten
   Bereiche zur Analyse. Importierte Einzelspiele stehen unter
   **Einzelspiel → Laden**.
7. Mit **Updates prüfen** wird der Katalog erneut abgerufen. Dafür ist
   eine Internetverbindung erforderlich. Lokal gespeicherte Spiele sind
   auch offline nutzbar.

**Achtung:** Die persönlichen Ergänzungen werden nur auf dem Gerät
gespeichert. Für einen Gerätewechsel oder eine Neuinstallation zusätzlich
regelmäßig eine **private Sicherung** erstellen.

## Für Trainer

1. **Start → Team Space → Team Space verbinden oder verwalten** öffnen.
2. Die URL des getrennten Handball-Saison-Cloud-Run-Dienstes,
   Teamnamen und den eigenen **Trainer-Schlüssel** eingeben.
3. **Team Space erstellen** anklicken und den erzeugten
   **Einladungslink** ausschließlich an die Mannschaft verteilen.
4. **Saisons und Spiele veröffentlichen** aufklappen:
   - Eine lokal gespeicherte Saison wählen und veröffentlichen.
   - Ein einzelnes lokales Spiel auswählen und separat veröffentlichen.
   - Optional ein Einzelspiel einer bereits im Team Space
     veröffentlichten Saison zuordnen.
5. Spätere Veröffentlichungen desselben Spiels bekommen einen neuen
   Versionsstand. Die Saison, zu der es gehört, meldet ebenfalls ein Update.
6. **Leseschlüssel erneuern** sperrt alle bisherigen Einladungen. Danach
   muss der neue Link an alle Spieler verteilt werden.

**Hinweis zur Freigabe:** Veröffentlicht wird der vom Trainer ausdrücklich
ausgewählte Spielstand. Der Trainer sollte prüfen, ob darin Informationen
enthalten sind, die nicht für die gesamte Mannschaft bestimmt sind.
Spieler-Lesezugänge besitzen keinerlei Veröffentlichungsberechtigung.

## Technischer Stand und Grenzen

- Originales Spiel-JSON v1 und Saison-JSON v1 bleiben unverändert.
- Die Cloud-Schnittstelle führt einen privaten Katalog mit stabilen
  Spiel-IDs, separaten Versionsnummern pro Spiel und Saison und einem
  widerrufbaren Team-Leseschlüssel.
- Auf den Endgeräten speichert die App nur die jeweiligen Zuordnungen
  und den letzten veröffentlichten Vergleichsstand.
- Der Team Space lädt beim Öffnen und auf **Updates prüfen** die
  Versionsübersicht. Es gibt keine Hintergrund-/Push-Synchronisierung.
- Noch nicht enthalten: individuelle Spielerkonten, Einzelwiderruf
  bestimmter Spieler, Videodatei-Upload und automatische Hintergrundupdates.
- Die Cloud-Funktionen sind erst nach Einrichtung und Freigabe des
  neuen Cloud-Run-Dienstes nutzbar. Der bestehende Handball360-Proxy
  wird nicht automatisch umkonfiguriert.

Die Administratoranleitung für die Bereitstellung steht unter
[cloud-run-season-sync/README.md](../../cloud-run-season-sync/README.md).
