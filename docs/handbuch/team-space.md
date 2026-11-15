# Team Space – gemeinsame Saisons und Spiele

Der **Team Space** ist der dritte Einstieg auf der Startseite, neben
**Saison** und **Einzelspiel**. Die lokalen Arbeitsbereiche bleiben bestehen.
Im Team Space sehen die Spieler die vom Trainer ausdrücklich veröffentlichten
Saisons und Spiele. **Trainerinhalte sind bei der Veröffentlichung standardmäßig
freigegeben:** Dazu gehören Kommentare, Zeichnungen, Tags und Schlüsselmomente.
Nur als **„Privat – nicht veröffentlichen“** markierte Bestandteile bleiben
lokal. Spieler können die Cloud nicht selbst aktualisieren.

## Für Spieler

1. **Start → Team Space → Team Space verbinden** wählen. Den Einladungslink
   aus Safari oder einer Nachricht kopieren. In der installierten PWA
   **Link aus Zwischenablage einfügen** auswählen (alternativ manuell
   einfügen) und mit **Mit Team Space verbinden** bestätigen.
   Die App prüft den Zugang, speichert die Verbindung und zeigt danach auf
   der **Startseite** eine Erfolgsmeldung. Es werden noch keine Spiele
   heruntergeladen oder vorhandene Daten überschrieben.
2. Unter **Start → Team Space → Team Space laden** werden bereits auf diesem
   Gerät verbundene Team Spaces aufgelistet. Den gewünschten Team Space
   mit **Laden** öffnen. Solange noch keine Verbindung besteht, wird
   ein Einstieg zum Verbinden angeboten. Unter **Schneller Wiedereinstieg**
   steht auch nach einem Neustart der zuletzt ausgewählte Team Space bereit.
3. Nach dem Öffnen eines Team Spaces zeigt die kompakte Spieleransicht nur den Teamnamen, verfügbare **Saisons** und auf Wunsch die einzelnen Spiele. IDs, Katalogversionen, Upload-Bestätigungen und Schlüssel werden dort nicht angezeigt. Unter **Saisons** die gewünschte veröffentlichte Saison auswählen.
   Ein Klick auf **Saison laden** übernimmt die **gesamte Saison mit den
   enthaltenen Spielen** als neue lokale Saison; andere lokale Saisons
   bleiben bestehen. Die importierte Saison kann danach über **Saison**
   geöffnet werden.
4. Die Zustände **Aktuell** und **Update verfügbar** zeigen, ob neue Daten
   bereitliegen. Bei Aktualisierungen erscheint eine Abgleichvorschau,
   damit persönliche Kommentare und Markierungen erhalten bleiben.
5. **Einzelspiele anzeigen** ist anfangs eingeklappt. Nur bei Bedarf öffnen,
   um einzelne Spiele separat zu importieren oder einer lokalen Saison
   zuzuordnen. Die zusätzliche Importziel-Auswahl erscheint erst dort.
6. Mit **Aktualisieren** wird die Online-Übersicht erneut abgerufen.
   Dafür ist eine Internetverbindung nötig; lokal importierte Saisons
   und Spiele bleiben auch ohne Internet nutzbar.

**Achtung:** Die persönlichen Ergänzungen werden nur auf dem Gerät
gespeichert. Für einen Gerätewechsel oder eine Neuinstallation zusätzlich
regelmäßig eine **private Sicherung** erstellen.

## Neues Trainerkonto (E-Mail und Passwort)

Zusätzlich zum bisherigen schlüsselbasierten Zugang gibt es einen
**optionalen, zentral freigegebenen Trainerzugang**. Er ist erst nutzbar,
nachdem Firebase Authentication in der Google Cloud eingerichtet ist.

1. **Start → Team Space → Team Space verbinden → Trainer anmelden oder registrieren → Trainerwerkzeuge → Trainerkonto · Registrierung und Saisonverwaltung** öffnen.
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
5. Als freigegebener Trainer kannst du **deine Team Spaces** anlegen und darin
   **leere Saisons (z. B. B-Jugend 2027/28)** erstellen.
6. Unter **Team Space → Saisons und Spiele veröffentlichen** kannst du
   **lokale Saisons und Einzelspiele** direkt mit dem angemeldeten
   E-Mail-Trainerkonto in **deine eigenen Team Spaces** hochladen.
   Ein zusätzlicher Veröffentlichungsschlüssel ist dafür nicht nötig.
7. Beim Hochladen einer bestehenden Saison eine **Online-Zielsaison**
   auswählen, falls im Space schon eine leere Saison angelegt wurde.
   Andernfalls wird ein neuer Saisoneintrag erstellt. Für Einzelspiele
   kann ebenfalls eine bestehende Online-Saison als Ziel gewählt werden.
8. In derselben Oberfläche können Administratoren Traineranträge
   freigeben und Konten sperren. Für Sonderfälle und externe Redaktions-
   Workflows kann ein Administrator weiterhin einen separaten
   **Veröffentlichungs-Schlüssel** ausstellen.

Der Firebase-Zugang und die bisherigen schlüsselbasierten Team Spaces
bleiben getrennt. Die Firebase-Schreibberechtigung wird auf dem Server für
jeden Upload anhand der freigegebenen Identität und der Space-Zuordnung
geprüft; Spieler-Einladungen verleihen weiterhin nur Leserechte. Schon vorhandene Einladungen, lokale Spiele und
Kommentare werden nicht verändert.

Das Passwort wird in der Spielanalyse nicht gespeichert. Ein
Sitzungstoken wird nur bis zum Schließen der Browser-Registerkarte
gespeichert. Die E-Mail-Identität wird durch Firebase überprüft,
die Trainerfreigabe durch einen Administrator erteilt.

## Für Trainer – neuen Team Space erstellen

1. **Start → Team Space → Team Space verbinden → Trainer anmelden oder registrieren → Klassische Schlüsselverwaltung öffnen** wählen. Die Schlüsselverwaltung ist nicht Bestandteil der normalen Spieleransicht.
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


## Versionsvergleich: Lokal gegen Team Space

Unter **Start → Team Space → Team Space laden → Aktualisieren** wird der
Cloud-Katalog abgerufen. Für Trainer wird zusätzlich **Veröffentlichungsstand
meiner Spiele** berechnet. Dafür vergleicht die App lokale Spielstände auf
diesem Gerät mit ihren veröffentlichten Gegenstücken, ohne ausdrücklich privat markierte
Anmerkungen zu berücksichtigen. Sie zeigt:

- **Identisch mit Cloud** – die freigegebenen Scoutingdaten stimmen überein
- **Lokal geändert** – seit dem letzten bekannten Cloud-Stand wurden
  Scoutingdaten geändert oder ergänzt
- **Cloud-Version neuer** – es gibt einen neueren Cloud-Stand; vor dem
  Hochladen erst die Unterschiede prüfen und eine lokale Sicherung erstellen
- **Noch nicht veröffentlicht** – für das lokale Spiel wurde im gewählten
  Team Space keine passende Cloud-Partie gefunden
- **Abweichend – Zuordnung prüfen** – eine eindeutige Versionszuordnung
  ist nicht möglich. Die App bietet keine ungesicherte Schnellfreigabe an.

In der Traineransicht kann beim verbundenen Team Space die
**Zusammenfassung der letzten Prüfung mit Datum/Uhrzeit** erscheinen. Diese Anzeige
ist ein **gespeicherter Prüfstand**, keine automatische Hintergrundprüfung:
für einen aktuellen Vergleich den Team Space öffnen und **Aktualisieren**
verwenden. Der detaillierte Vergleich lädt bei Bedarf die Cloud-Spiele mit
SHA-256-Prüfsumme, falls der Versions-Fingerabdruck nicht übereinstimmt.
Einzelne Spiele können unter **Zur Veröffentlichung** im
Veröffentlichungsdialog vorausgewählt werden; das Hochladen erfordert
weiterhin die Bestätigung des Trainers.

## Öffentliche Scoutingdaten und private Anmerkungen

Beim **bewussten Hochladen durch einen Trainer** (gesamte Saison oder
einzelnes Spiel) sind neue Scouting-Ereignisse, Spielstatistiken, Teams,
Kommentare, Zeichnungen, freie Tags, Highlights und Schlüsselmomente
**standardmäßig für alle Leser des Team Space freigegeben**.
Wer etwas nicht veröffentlichen möchte, markiert es am betreffenden
Element ausdrücklich **„Privat – nicht veröffentlichen“**:

- Beim Anlegen eines Schlüsselmoments: Kontrollkästchen am Marker;
  alternativ später im Event- oder Dateneditor
- Im Video-Tab: Kontrollkästchen beim Kommentar zum aktuellen Event
- Im Event-Editor: separate Schalter für Kommentare, Notizen,
  Highlight-Markierungen und freie Tags sowie für einzelne Zeichnungen
- Im Vollbild-Zeichenmodus: Zeichnung im Modus **Auswahl** markieren und
  dort **„Privat – nicht veröffentlichen“** aktivieren

Die App erstellt vor der Übertragung eine **Kopie mit den ausgewählten
Ausschlüssen**. Ein vollständig privat markierter Schlüsselmoment wird
nicht übertragen. Bei einer privaten Zeichnung bleibt der übrige
Eventinhalt unverändert. Die lokale Originaldatei bleibt erhalten.
Video-Dateien, lokale Quellpfade und Synchronisationsdaten werden nicht
in den Team Space hochgeladen. Für freigegebene Zeichnungen werden
die benötigten Zeichenkoordinaten und Zeitbereiche gespeichert.

Vor jedem Upload zeigt ein Bestätigungsdialog die Zahl der freigegebenen
Kommentare, Zeichnungen, Schlüsselmomente und Highlights sowie die
ausgeschlossenen Bestandteile. Das Hochladen erfordert weiterhin einen
berechtigten Trainer und eine ausdrückliche Bestätigung.

**Wichtig:** Jeder mit einem gültigen Spieler-Leseschlüssel kann alle
veröffentlichten Inhalte lesen. Die Freigabe ist keine individuelle
Berechtigung je Spieler. Eine nachträglich aktivierte Privat-Markierung
wirkt erst nach der **nächsten Veröffentlichung** und ersetzt nur die
aktuelle abrufbare Cloud-Fassung; ältere Cloud-Objektversionen können
intern bestehen bleiben und eine administrative Bereinigung erfordern.

Spieler-Lesezugänge besitzen keinerlei Veröffentlichungsberechtigung.

Die detaillierte Trainerverwaltung einschließlich Versionsvergleich bleibt
Spielern verborgen. Lokal gespeicherte Rollenbezeichnungen allein genügen
nicht zur Freigabe; Trainerrechte werden durch den Cloud-Dienst überprüft.

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
- Der Team Space lädt beim Öffnen und auf **Aktualisieren** die
  Versionsübersicht. Es gibt keine Hintergrund-/Push-Synchronisierung.
- Noch nicht enthalten: individuelle Spielerkonten, Einzelwiderruf
  bestimmter Spieler, Videodatei-Upload und automatische Hintergrundupdates.
- Die Cloud-Funktionen sind erst nach Einrichtung und Freigabe des
  neuen Cloud-Run-Dienstes nutzbar. Der bestehende Handball360-Proxy
  wird nicht automatisch umkonfiguriert.

Die Administratoranleitung für die Bereitstellung steht unter
[cloud-run-season-sync/README.md](../../cloud-run-season-sync/README.md).
