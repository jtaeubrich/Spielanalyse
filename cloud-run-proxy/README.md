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
