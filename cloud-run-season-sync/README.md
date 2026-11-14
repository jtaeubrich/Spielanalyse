# Saison-Cloud: Einmal abonnieren, danach aktualisieren

Der neue Dienst ist vom Handball360-Proxy getrennt. Er speichert veröffentlichte
Saison-JSON-Dateien (Format v1 unverändert) mit Versionsnummer und SHA-256.
Der bestehende manuelle Datei-Abgleich bleibt als Offline-Fallback bestehen.

## Ablauf

Trainer: In der Spielanalyse die Saison verwalten, im Abschnitt Saison-Cloud
die Service-URL und den nur dem Trainer bekannten Veröffentlichungs-Token
eingeben, "Saison veröffentlichen" drücken und den erzeugten Leselink
mit der Mannschaft teilen.

Spieler: Einmal den Link auf dem Gerät öffnen, Saison hinzufügen,
anschließend auf "Saison online aktualisieren" tippen. Vorhandene lokale
Kommentare, Zeichnungen, Tags und persönliche Schlüsselmomente bleiben
im Geräte-Speicher. Es werden keine persönlichen Änderungen zum Trainer
zurückgeladen. Ein privater Backup-Export ist weiterhin wichtig, weil
lokal gespeicherte Anmerkungen bei Geräteverlust verloren gehen können.

Der Leselink ist eine weitergebbare Berechtigung. Nicht öffentlich posten.
"Leseschlüssel erneuern" macht bisherige Einladungen ungültig; ein
Einzelwiderruf pro Spieler ist noch nicht implementiert.


## Trainerregistrierung mit Firebase (optional, Version 3)

Die Firebase-Anmeldung ist standardmäßig **deaktiviert**. Ohne die im Folgenden
beschriebenen Einstellungen bleiben bisherige Cloud-Run-Dienste, Saison-Cloud-
Zugänge und Team-Space-Schlüssel funktionsfähig.

### Einrichtung im bestehenden GCP-Projekt

1. In der [Firebase Console](https://console.firebase.google.com/) das bereits
   vorhandene GCP-Projekt **spielanalyse-companion** zu Firebase hinzufügen,
   falls noch nicht geschehen. Kein zweites GCP-Projekt anlegen.
2. **Authentication → Sign-in method → E-Mail/Passwort** aktivieren.
   Unter **Projekteinstellungen → Allgemein** den **Web API Key**
   (Firebase Web API Key, öffentliches Konfigurationsmerkmal) ermitteln.
3. Unter **Google Cloud Run → handball-season-sync → Container /
   Variablen und Secrets** folgende **Runtime-Umgebungsvariablen** setzen:

       FIREBASE_PROJECT_ID=spielanalyse-companion
       FIREBASE_WEB_API_KEY=<Firebase Web API Key>

   Es ist **kein Service-Account-JSON und kein Firebase-Admin-Passwort** nötig;
   Firebase Admin SDK verwendet die bereits bestehende Runtime-Service-Identität.
   Der GitHub-Deploy-Workflow verwendet update-env-vars statt set-env-vars,
   damit diese Einstellungen bei weiteren Deployments erhalten bleiben.
4. Die Spielanalyse öffnen: **Start → Team Space → Trainerkonto**. Dort mit
   eigener E-Mail-Adresse registrieren, Bestätigungslink öffnen und
   **E-Mail-Bestätigung prüfen** betätigen.
5. Nach bestätigter E-Mail-Adresse **Trainerfreigabe beantragen**. Wenn noch
   kein Administrator eingerichtet ist, zeigt die Spielanalyse den Abschnitt
   **Ersten Administrator freischalten**. Dort **einmalig** den vorhandenen,
   zentralen Team-Space-Registrierungsschlüssel eingeben und die
   Administratorübernahme bestätigen. Die UID und die E-Mail-Adresse werden
   daraufhin in einer privaten GCS-Datei registriert. Der geheime Schlüssel
   wird dabei **nicht gespeichert**. Weder eine Firebase-UID noch eine
   Cloud-Run-Umgebungsvariable muss manuell kopiert werden.
6. Unter **Trainerfreigaben verwalten** weitere Anträge direkt in der App
   **Freigeben** oder **Sperren**. Spätere Administratorübernahmen mit dem
   zentralen Schlüssel werden serverseitig abgelehnt.

**Sicherheit der Ersteinrichtung:** Ein bestehender zentraler Registrierungsschlüssel
ist eine hochprivilegierte Berechtigung. Nur der gewünschte erste Administrator
darf ihn kennen; wurde er früher mit Trainern oder Dritten geteilt, zuerst
einen neuen geheimen Registrierungsschlüssel im Secret Manager setzen und
anschließend die Cloud-Run-Revision aktualisieren. Die Erstanmeldung ist
nur mit einem **verifizierten Firebase-Konto**, einem **bereits beantragten
Trainerzugang** und dem **richtigen zentralen Schlüssel** möglich. Der erste
Antrag wird per atomarer GCS-Objekterstellung festgeschrieben; weitere
Versuche, auch parallele, können nicht erneut die erste Rolle beanspruchen.
Ist bereits `TRAINER_ADMIN_UIDS` gesetzt, ist diese Einmalübernahme gesperrt.

**Optionale Wiederherstellung:** Bei Verlust des ursprünglichen
Administratorkontos kann eine berechtigte Person weiterhin
`TRAINER_ADMIN_UIDS` als gesonderte, serverseitige Notfallfreigabe
konfigurieren. Das ist **nicht** Bestandteil des normalen Anmeldeablaufs.

**Berechtigungen:** Jede bestätigte E-Mail kann einen Antrag stellen. Erst
die manuelle Freigabe gestattet das Anlegen von maximal fünf Team Spaces pro
Trainer. Darin lassen sich maximal 20 leere Saisons je Space anlegen.
Die normale Trainerkonto-API besitzt **keinen Endpunkt zur Erstellung oder Veröffentlichung
von Spielen**. Auch der zentrale Registrierungsschlüssel wird den neuen
Konten **nicht** ausgehändigt.

**Spätere Spielpflege:** Ein Administrator kann im Adminbereich für einen
konkreten Konto-Team-Space über die Team-Space-ID einmalig einen separaten
**Veröffentlichungs-Schlüssel** ausstellen oder erneuern. Dies geschieht nur
mit einer autorisierten Administrator-UID. Der Schlüssel wird nie dem normalen
Trainerkonto zugeschrieben oder in der Cloud im Klartext gespeichert.
Eine zentrale Redaktion kann damit die bestehenden Team-Space-Endpunkte zum
Hochladen von Spielen nutzen; die Trainer bleiben bei Saisonrechten.
Eine neue Ausstellung macht den früheren Veröffentlichungsschlüssel ungültig. Die bisherigen Team Spaces (Schlüssel v2) behalten
ihre bisherigen Funktionen und werden nicht stillschweigend umgewandelt.

**Speicher und Datenschutz:** Firebase verwaltet das Login und die
E-Mail-Bestätigung. Der private GCS-Bucket speichert E-Mail, Firebase-UID,
Freigabestatus, Zeitstempel und Team-Space-Zuordnungen unter
trainer-registry/. Die GCS-Objekte sind nicht öffentlich.
Der Browser hält das Firebase-Refresh-Token nur im Tab-Sitzungsspeicher;
das Passwort wird weder im Cloud-JSON noch im App-Speicher abgelegt.
Persönliche Kommentare und Video-Material werden durch die Anmeldung
nicht automatisch hochgeladen.

**Migrations-/Einladungsverhalten:** Neue Konto-Team-Spaces verwenden
authMode firebase und ein nicht ausgegebenes Trainer-Schlüsselgeheimnis,
wodurch weder der zentrale Schlüssel noch das einfache Trainerkonto
publish-game erreichen kann. Der einmalig erzeugte **Spieler-Leseschlüssel**
wird wie bisher auf dem Erstellungsgerät als Einladung gespeichert.
Auf weiteren Trainergeräten ist die Saisonverwaltung per E-Mail möglich;
das alte Einladungsgeheimnis wird nicht serverseitig im Klartext wiederhergestellt.
Leere Saisons sind im Team-Space-Katalog sichtbar, können aber erst mit
Inhalten sinnvoll lokal importiert werden.

**Fehlerbilder:** AUTH_NOT_CONFIGURED bei fehlender Konfiguration;
EMAIL_NOT_VERIFIED vor der E-Mail-Bestätigung;
TRAINER_NOT_APPROVED bei offenen/gesperrten Anträgen; 403 auf fremden
Team Spaces. Der Firebase Web API Key ist für Web-Clients vorgesehen,
nicht mit dem zentralen Secret-Manager-Token zu verwechseln.

## Team Spaces: getrennte Schlüssel pro Mannschaft (v2)

Die `/spaces`-API dient mehreren unabhängigen Team Spaces auf derselben
Cloud-Run-Instanz und demselben **privaten** GCS-Bucket.

- **Registrierung:** `POST /spaces/v2` erfordert den zentralen
  `TRAINER_PUBLISH_TOKEN` (aus dem Secret Manager) und
  `{"name":"...","authVersion":2}`. Die Registrierung ist bewusst
  **nicht anonym**; andernfalls wären beliebige kostenpflichtige
  Speicherbereiche anlegbar.
- **Schlüsselvergabe:** Der Dienst erzeugt eine UUID, einen zufälligen
  `trainerToken` mit Schreibrechten für **nur diesen Team Space** und einen
  unabhängigen `readToken` für Spieler. Beide werden **nur einmal** über HTTPS
  zurückgegeben. In Cloud Storage stehen ausschließlich deren SHA-256-Hashes.
  Der jeweilige Trainer-Schlüssel muss außerhalb der App sicher aufbewahrt
  werden, der Leser-Schlüssel darf nur an autorisierte Teammitglieder gehen.
- **Lesen:** Katalog, Saison- und Spiel-Downloads sind nur mit dem
  **Space-spezifischen** `readToken` zugänglich.
- **Schreiben:** `publish-season`, `publish-game`, `rotate-reader` und
  `rotate-trainer` erfordern den **Space-spezifischen** `trainerToken`;
  andere Teams und der zentrale Registrierungsschlüssel können damit nicht
  auf diesen Space schreiben.
- **Schlüsselverwaltung:** `POST /spaces/:id/verify-trainer` prüft den
  eingegebenen Trainer-Schlüssel (z. B. auf einem zweiten Gerät).
  `POST /spaces/:id/rotate-trainer` bzw. `rotate-reader` macht nur den
  jeweiligen bisherigen Schlüssel ungültig und gibt einmalig einen neuen aus.
- **Migration:** Vor der Umstellung angelegte Team Spaces ohne `trainerHash`
  akzeptieren vorübergehend den bisherigen zentralen Token. Mit
  `POST /spaces/:id/claim-trainer` (zentraler Token, nur einmal) entsteht ein
  Space-spezifischer Trainer-Schlüssel. Anschließend gelten ausschließlich die
  individuellen Berechtigungen. Vorhandene Saisons, Spielstände und
  Einladungslinks bleiben erhalten.
- **Legacy-Saison-Cloud:** Die bisherigen `/seasons`-Endpunkte bleiben zur
  Rückwärtskompatibilität bestehen. Für sie dient `TRAINER_PUBLISH_TOKEN`
  weiterhin als zentraler Veröffentlichungsschlüssel. Für Team Spaces ist er
  ein Registrierungsschlüssel bzw. ein temporärer Migrationsschlüssel.
- **Schutz alter App-Versionen:** `/spaces` akzeptiert ausschließlich
  `authVersion:2` und den v2-Endpunkt. Ältere App-Versionen könnten den einmaligen
  Trainer-Schlüssel nicht anzeigen und erhalten deshalb auf `/spaces` HTTP 426 statt
  einen unerreichbaren Space anzulegen.

**Wichtig:** Der Trainer-Schlüssel wird nur bei Erstellung, Migration oder
Rotation angezeigt und **nicht im Browser dauerhaft gespeichert**. Bei Verlust
kann der aktuelle Trainer ohne den alten Schlüssel keinen neuen erzeugen;
eine Wiederherstellung erfordert einen gesonderten administrativen Vorgang.
Der Einladungslink enthält nur den Lesezugang und sollte nicht öffentlich
geteilt werden. Individuelle Spielerkonten sind nicht Bestandteil dieses
Schlüsselmodells.

Vor dem Freigeben neuer Team Spaces immer **Backend und GitHub-Pages-PWA
gemeinsam aktualisieren**, danach den API- und Mobiltest ausführen.
Ein laufender Cloud-Run-Dienst wird vom manuellen Workflow aktualisiert,
nicht neu benannt.

## API

- POST /seasons: erstellt UUID und zufälligen Leseschlüssel (Trainer)
- POST /seasons/:id/publish: nimmt Saison-JSON und erwartete Version an (Trainer)
- POST /seasons/:id/rotate-reader: widerruft alten Leseschlüssel (Trainer)
- GET /seasons/:id/latest: Versionsstand und Prüfsumme (Leser)
- GET /seasons/:id/download: private JSON-Datei (Leser)
- GET /health: öffentlicher Dienststatus

Der Server erlaubt maximal 25 MB / 200 Spiele, prüft die Formatversion
und veröffentlicht jede Revision als unveränderliches Cloud-Storage-Objekt.
Konkurrierende Veröffentlichungen erhalten HTTP 409. Nur der Trainer-Token
darf schreiben. Lesetoken liegen im Cloud-Metadatensatz nur als SHA-256-Hash.
Der Trainer-Token wird nicht persistent im Browser gespeichert.

## Einmalige Google-Cloud-Einrichtung

1. In dem vorhandenen GCP-Projekt einen *privaten* Cloud-Storage-Bucket
   in europe-west1 anlegen, mit Uniform Bucket-Level Access und
   Public Access Prevention. Beispiel:
   
       gcloud storage buckets create gs://MEIN_SAISON_BUCKET --location=europe-west1 --uniform-bucket-level-access --public-access-prevention

2. Ein dediziertes Runtime-Dienstkonto erstellen. Diesem Dienstkonto
   roles/storage.objectAdmin nur für diesen Bucket erteilen.
3. Einen zufälligen Trainer-Token mit mindestens 32 Zeichen aus
   A-Z, a-z, 0-9, _ oder - erzeugen. Nur im Passwortmanager und im
   Google Secret Manager hinterlegen. Keine Tokens in GitHub einchecken.
   Der Runtime-Identität roles/secretmanager.secretAccessor nur für
   dieses Secret gewähren.
4. Die GitHub Actions Repository-Variablen setzen:
   GCP_PROJECT_ID, GCP_WORKLOAD_IDENTITY_PROVIDER und
   GCP_DEPLOY_SERVICE_ACCOUNT (wie beim vorhandenen Proxy),
   außerdem SEASON_SYNC_BUCKET (ohne gs://),
   SEASON_SYNC_RUNTIME_SERVICE_ACCOUNT (vollständige E-Mail),
   SEASON_SYNC_TRAINER_SECRET (nur Secret-Name, nicht Token-Wert).
5. Das GitHub-Deploy-Dienstkonto benötigt Cloud Run Deploy- und
   Build-Berechtigungen sowie roles/iam.serviceAccountUser auf
   dem dedizierten Runtime-Dienstkonto.
6. Workflow *Deploy Season Sync (manual)* in GitHub Actions
   manuell starten. Der vorhandene Handball360-Proxy wird
   dadurch nicht verändert.
7. Die Cloud-Run-URL abfragen:

       gcloud run services describe handball-season-sync --region=europe-west1 --format='value(status.url)'

   URL in der Saison-Cloud des Trainergeräts eintragen. Die Spieler
   brauchen keine separate Serverkonfiguration, da der
   Einladungslink diese enthält.

Die Cloud-Run-HTTPS-URL ist wegen der PWA öffentlich erreichbar.
Saisondaten sind trotzdem nur nach erfolgreicher API-Token-Prüfung
abrufbar. CORS ist auf https://jtaeubrich.github.io begrenzt.
Das ist kein Ersatz für Authentifizierung.

## Tests

- Backend: node --test cloud-run-season-sync/api.test.js cloud-run-season-sync/team-space-api.test.js
- Client: npx vitest run tests/season-sync-client.test.js tests/team-space-client.test.js
- Browser: npx playwright test tests/e2e/season-cloud.spec.js tests/e2e/team-space.spec.js
- GitHub-Workflow *Test Season Sync* führt Backend/Client-Tests aus;
  Deploy Season Sync wird nur manuell ausgelöst.

Nicht enthalten: automatische Hintergrundupdates, individuelle
Spielerkonten, Videodatei-Synchronisierung und ein Produktionsnachweis
gegen einen bereits bereitgestellten Cloud-Bucket.
