# Handball360 Cloud Run Proxy

Kleiner Google-Cloud-Run-Proxy fuer die Spielanalyse-PWA. Er stellt dieselbe JSON-Struktur bereit wie der bisherige Cloudflare Worker und liest fuer eine Match-ID vier Dokumente von handball.net:

- Match-Metadaten
- Events
- Lineups
- Additional Info (optional; 404 wird als leere Antwort behandelt)

## API

```text
GET /match/<MATCH_ID>
GET /?match=<MATCH_ID>
```

Beide Varianten erwarten:

```http
Authorization: Bearer <API_TOKEN>
```

Beispiel:

```bash
curl "https://DEINE-CLOUD-RUN-URL/match/378110" \
  -H "Authorization: Bearer DEIN_TOKEN"
```

Die Antwort hat absichtlich dieselbe Struktur wie beim bisherigen Worker:

```json
{
  "match_id": "378110",
  "match_url": "https://www.handball.net/match/378110",
  "match": {},
  "events": {},
  "lineups": {},
  "additional_info": {}
}
```

Damit kann die Spielanalyse ohne Parser-Aenderung zwischen den Backends wechseln.

## Spielplan einer Mannschaft (neuer Endpunkt)

```http
GET /team/85814/matches?from=2026-07-01&to=2027-06-30
Authorization: Bearer <API_TOKEN>
```

Die Antwort enthält `teamId`, `dateFrom`, `dateTo`, `total` und `matches` (Match-ID, Datum, Heim/Gast, Wettbewerbsinformationen und vorhandenes Ergebnis). Der Proxy liest nur Match-Metadaten und lädt **keine** Aufstellungen oder Ereignisse für den gesamten Spielplan vorab. Er paginiert selbst (50 Spiele pro Seite, höchstens zehn Seiten), prüft Teamzugehörigkeit und Vollständigkeit und akzeptiert ausschließlich numerische Team-IDs sowie begrenzte Datumsbereiche von maximal 400 Tagen.

Die Saisonanalyse verwendet den Spielplan nur als **Vorschau**. Erst nach Auswahl ruft die PWA bestehende `/match/<ID>`-Endpunkte für die gewünschten Spiele ab und wandelt deren Daten in einzelne Saisonspiele um. Bereits vorhandene Spiele werden nicht verändert; auch bei später verfügbaren offiziellen Ereignissen erfolgt **kein automatischer Merge in manuell bearbeitete Spiele**. Zukünftige Spiele werden standardmäßig abgewählt und bei manueller Übernahme aus der Statistik herausgenommen, solange keine offiziellen Ereignisse vorhanden sind.

**Hinweis:** `/api/new/matches?team_id=...` ist ein interner, nicht offiziell zugesicherter Endpunkt der handball.net-Webseite. Technische Erreichbarkeit bedeutet nicht, dass ein dauerhafter Zugang gestattet oder stabil ist. Für produktive Nutzung den Zugang und zulässige Abrufmengen mit dem DHB klären.

## Voraussetzungen

- Google-Cloud-Projekt mit aktivierter Abrechnung
- installierte und angemeldete Google Cloud CLI
- aktivierte Cloud Run API und Cloud Build API

Einmalig:

```bash
gcloud auth login
gcloud config set project DEIN_PROJEKT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Deployment

Im Verzeichnis `cloud-run-proxy`:

```bash
gcloud run deploy handball360-proxy \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars ALLOWED_ORIGINS=https://jtaeubrich.github.io \
  --set-env-vars API_TOKEN=DEIN_TOKEN
```

Cloud Run gibt nach dem Deployment die Service-URL aus.

### Lokale Entwicklung zusaetzlich erlauben

```bash
gcloud run services update handball360-proxy \
  --region europe-west1 \
  --set-env-vars "^@^ALLOWED_ORIGINS=https://jtaeubrich.github.io,http://localhost:5173@API_TOKEN=DEIN_TOKEN"
```

Der alternative Trennzeichenmodus `^@^` ist notwendig, weil `ALLOWED_ORIGINS` selbst ein Komma enthaelt.

## Test

```bash
curl "https://DEINE-CLOUD-RUN-URL/match/378110" \
  -H "Authorization: Bearer DEIN_TOKEN"
```

Erwartet werden die Top-Level-Felder:

```text
match_id
match_url
match
events
lineups
additional_info
```

## Einbindung in Spielanalyse

Nach erfolgreichem Test muss in `index.html` nur die Backend-URL ausgetauscht werden:

```js
const HANDBALL_NET_WORKER = "https://DEINE-CLOUD-RUN-URL";
```

Der bestehende PWA-Aufruf `/match/<ID>` kann unveraendert bleiben.

## Sicherheit

Der Cloud-Run-Service muss fuer eine Browser-PWA oeffentlich per HTTPS erreichbar sein. Der Bearer-Token liegt deshalb letztlich im Browser und ist **kein echtes Geheimnis**. Er verhindert einfache Fremdnutzung, ersetzt aber keine starke Benutzer-Authentifizierung.

Die CORS-Konfiguration beschraenkt Browseraufrufe auf die in `ALLOWED_ORIGINS` eingetragenen Origins. CORS allein ist ebenfalls keine Authentifizierung.

Fuer den produktiven Betrieb:

1. Keine Test-Tokens im Quellcode ablegen.
2. `API_TOKEN` mindestens als Cloud-Run-Environment-Variable setzen; besser spaeter ueber Secret Manager bereitstellen.
3. `ALLOWED_ORIGINS` nur auf die tatsaechlich benoetigten Frontend-Origins begrenzen.
4. Cloud-Run-Logs bei Upstream-Fehlern pruefen.

## Hinweis zu handball.net

Der Proxy setzt fuer jeden Upstream-Aufruf:

```text
Referer: https://www.handball.net/match/<MATCH_ID>
User-Agent: AutoNaming/2.0
Accept: application/json
```

Die verwendeten handball.net-Endpunkte sind nicht Teil einer von uns kontrollierten API. Aenderungen auf Seiten von handball.net koennen deshalb Anpassungen am Proxy erforderlich machen.

## Vereinslogos

`GET /logo?url=<URL-ENCODED-LOGO-URL>` ruft ausschliesslich HTTPS-Vereinslogos vom Host `handball360.isquad.de` und dem Pfad `/images/afiliacion_clubs/<NUMMER>/square_<NAME>.(jpg|jpeg|png|webp)` ab. Der Endpunkt nutzt den bestehenden Bearer-Token und dieselbe CORS-Origin-Liste; maximale Bildgroesse: 1 MB. Es gibt keine frei waehlbaren Upstream-Hosts.

## Smartphone-Deployment ueber GitHub Actions

Workflow: `.github/workflows/deploy-proxy.yml` (manuell, `workflow_dispatch`). Repository-Variablen in GitHub unter Settings > Secrets and variables > Actions > Variables anlegen:

- `GCP_PROJECT_ID`: Google-Cloud-Projekt-ID.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: vollstaendiger Workload-Identity-Provider-Ressourcenname.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: E-Mail-Adresse des Deploy-Service-Accounts.

In Google Cloud muss der GitHub-OIDC-Provider auf dieses Repository und den gewuenschten Branch beschraenkt werden. Fuer `gcloud run deploy --source` benoetigt das Deployment-Dienstkonto insbesondere `roles/run.sourceDeveloper`, `roles/serviceusage.serviceUsageConsumer`, passende Artifact-Registry-Schreibrechte und `roles/iam.serviceAccountUser` auf dem Cloud-Run-Runtime-Dienstkonto. Das Build-Dienstkonto benoetigt `roles/run.builder` (ggf. weitere Berechtigungen entsprechend der tatsaechlichen Projektkonfiguration). Zusaetzliche Rollen wie `roles/run.admin`, `roles/run.developer` oder `roles/artifactregistry.editor` sind nicht pauschal erforderlich: Vor dem Entfernen geerbte Bindings und tatsaechliche Anforderungen pruefen und danach einen erneuten Deploy testen. IAM-Bindings werden nicht durch diesen GitHub-Workflow geaendert. Beim Deploy die bisherigen Service-Environment-Variablen `ALLOWED_ORIGINS` und `API_TOKEN` beibehalten; der Workflow setzt sie nicht neu.

Auf dem Smartphone: GitHub > Spielanalyse > Actions > Deploy Handball360 Proxy > Run workflow > main. Erst nach erfolgreichem Deployment funktioniert die neue Logo-Route der PWA.
