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

## Neues Trainerkonto (E-Mail und Passwort)

Zusätzlich zum bisherigen schlüsselbasierten Zugang gibt es einen
**optionalen, zentral freigegebenen Trainerzugang**. Er ist erst nutzbar,
nachdem Firebase Authentication in der Google Cloud eingerichtet ist.

1. **Start → Team Space → Trainerkonto · Registrierung und Saisonverwaltung**
   öffnen.
2. Mit E-Mail-Adresse und Passwort **Registrieren**, anschließend die
   Bestätigungs-E-Mail öffnen und auf **E-Mail-Bestätigung prüfen** klicken.
3. **Trainerfreigabe beantragen**. Die bestätigte E-Mail-Adresse allein
   berechtigt noch nicht zur Team- oder Saisonerstellung.
4. Ein Administrator prüft den Antrag und gibt die Trainerrolle frei.
   **Ausnahme: erster Administrator.** Wenn noch keine Administration besteht,
   erscheint nach dem Antrag **Ersten Administrator freischalten**. Dort kann
   der erste Administrator einmalig mit dem **zentralen Team-Space-
   Registrierungsschlüssel** sein bestätigtes E-Mail-Konto freischalten,
   ohne Firebase-UIDs oder Cloud-Run-Variablen manuell einzutragen. Der
   Schlüssel darf nicht mit anderen Trainern geteilt werden. Weitere
   Administratorübernahmen über diesen Weg sind gesperrt.
5. Als freigegebener Trainer kannst du **einen Team Space selbst anlegen**
   und darin **leere Saisons (z. B. B-Jugend 2027/28)** erstellen.
6. Du bekommst den üblichen **Einladungslink für Spieler**, aber
   **keinen Spiel-Veröffentlichungsschlüssel**. Das neue Trainerkonto
   darf keine Spiele erstellen oder in die Cloud hochladen.
7. In derselben Oberfläche können Administratoren Traineranträge
   freigeben und Konten sperren.
8. Falls später Spiele in eine Saison geladen werden sollen, kann ein
   Administrator über die **Team-Space-ID** einen gesonderten
   **Veröffentlichungs-Schlüssel** für eine zentrale Redaktion ausstellen.
   Dieser Schlüssel ist nicht Bestandteil des normalen Trainerkontos und
   muss separat sicher aufbewahrt werden.

Der Firebase-Zugang und die bisherigen schlüsselbasierten Team Spaces
bleiben getrennt. Schon vorhandene Einladungen, lokale Spiele und
Kommentare werden nicht verändert.

Das Passwort wird in der Spielanalyse nicht gespeichert. Ein
Sitzungstoken wird nur bis zum Schließen der Browser-Registerkarte
gespeichert. Die E-Mail-Identität wird durch Firebase überprüft,
die Trainerfreigabe durch einen Administrator erteilt.

## Für Trainer – neuen Team Space erstellen

1. **Start → Team Space → Team Space verbinden oder verwalten** öffnen.
2. Den Cloud-Run-Dienst, Teamnamen und den **zentralen Registrierungsschlüssel**
   eingeben. Dieser Schlüssel wird nur zur Erstellung neuer Team Spaces benutzt
   (bei älteren Saison-Cloud-Bereichen bleibt er vorerst auch deren Legacy-Schlüssel).
3. **Team Space erstellen** anklicken. Der Server erzeugt zwei **unterschiedliche,
   zufällige Schlüssel**: einen Trainer-Schlüssel (Schreibrechte für genau diesen
   Space) und einen Spieler-Schlüssel (Leserechte für genau diesen Space).
4. Den **neuen Trainer-Schlüssel sofort in einem Passwortmanager sichern**.
   Er wird nur bei der Erstellung bzw. Rotation ausgegeben und **nicht dauerhaft
   in der Spielanalyse gespeichert**. Wird er verloren, ist ohne administrativen
   Eingriff keine weitere Veröffentlichung möglich.
5. Den **Einladungslink** mit dem Spieler-Leseschlüssel nur an berechtigte
   Mannschaftsmitglieder geben. Der Trainer-Schlüssel darf niemals in den
   Spieler-Link eingefügt werden.
6. Im Abschnitt **Saisons und Spiele veröffentlichen** den individuellen
   Trainer-Schlüssel eingeben und die gewünschte Saison bzw. das Einzelspiel
   veröffentlichen. Das funktioniert unabhängig von anderen Team Spaces.
7. Mit **Trainer-Schlüssel erneuern** kann ein alter Trainerschlüssel ungültig
   gemacht werden; die Leseschlüssel der Spieler bleiben dabei gültig.
   Mit **Leseschlüssel erneuern** werden dagegen alte Einladungen ungültig.

## Bestehende Team Spaces migrieren oder auf einem weiteren Gerät verwalten

- Alte Team Spaces ohne individuellen Trainer-Schlüssel werden im Katalog als
  Legacy-Zugang erkannt. **Vorhandenen Team Space übernehmen** erzeugt nach
  Eingabe des zentralen Registrierungsschlüssels einmalig einen eigenen
  Trainer-Schlüssel. Danach kann der alte zentrale Schlüssel **nicht mehr**
  für diesen Team Space veröffentlichen. Einladungen, IDs, Saisons, Spiele
  und lokale Kommentare bleiben dabei unverändert.
- Auf einem **zweiten Trainergerät** zunächst den normalen Spieler-Link öffnen,
  danach den individuellen Trainer-Schlüssel eingeben und auf
  **Trainerzugang aktivieren** klicken. Der Trainer-Schlüssel wird nicht
  auf dem Gerät gespeichert; er muss zum Veröffentlichen wieder eingegeben werden.
- Bis zur Übernahme können alte Team Spaces vorübergehend noch mit dem
  bisherigen zentralen Schlüssel beschrieben werden. Deshalb ist die Migration
  für alle vorhandenen Team Spaces empfehlenswert.


**Hinweis zur Freigabe:** Veröffentlicht wird der vom Trainer ausdrücklich
ausgewählte Spielstand. Der Trainer sollte prüfen, ob darin Informationen
enthalten sind, die nicht für die gesamte Mannschaft bestimmt sind.
Spieler-Lesezugänge besitzen keinerlei Veröffentlichungsberechtigung.

## Technischer Stand und Grenzen

- Originales Spiel-JSON v1 und Saison-JSON v1 bleiben unverändert.
- Die Cloud-Schnittstelle führt pro Space einen privaten Katalog mit stabilen
  Spiel-IDs, separaten Versionsnummern pro Spiel und Saison, einem
  widerrufbaren Leser- und einem widerrufbaren Trainer-Schlüssel.
- In Google Cloud Storage werden **nur SHA-256-Hashes** beider Space-Schlüssel
  gespeichert. Die ursprünglichen Schlüssel erscheinen einmalig in der
  verschlüsselten HTTPS-API-Antwort bzw. im Einladungslink, nicht im Metadatensatz.
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
