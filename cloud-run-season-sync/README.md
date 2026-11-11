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

- Backend: node --test cloud-run-season-sync/api.test.js
- Client: npx vitest run tests/season-sync-client.test.js
- Browser: npx playwright test tests/e2e/season-cloud.spec.js
- GitHub-Workflow *Test Season Sync* führt Backend/Client-Tests aus;
  Deploy Season Sync wird nur manuell ausgelöst.

Nicht enthalten: automatische Hintergrundupdates, individuelle
Spielerkonten, Videodatei-Synchronisierung und ein Produktionsnachweis
gegen einen bereits bereitgestellten Cloud-Bucket.
