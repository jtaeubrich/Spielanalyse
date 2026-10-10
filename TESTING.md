# Automatisierte Tests

Die Testbasis besteht aus zwei Ebenen:

- **Vitest** prüft stabile Referenzdaten und fachliche Regressionen.
- **Playwright** prüft zentrale Bedienabläufe im echten Browser auf Desktop und mobilem Viewport.

## Referenzspiele

### HKN-Referenzspiel

`tests/fixtures/hkn_reference.json`

Die Fixture basiert auf dem korrigierten Spiel HSG Herzhorn/Kollmar/Neuendorf gegen das anonymisierte eigene Team. Sie hält unter anderem fest:

- 25 Minuten pro Halbzeit
- 15 Heimspieler / 14 Gastspieler
- 136 erfasste Ereignisse
- Endstand 26:35
- 61 Tore
- 19 Paraden
- 17 Fehlwürfe
- 25 technische Fehler
- 5 Zwei-Minuten-Strafen

### Handball360-Referenz

`tests/fixtures/handball360_378107.json`

Die Fixture enthält einen aufgezeichneten offiziellen Handball360-Eventdatensatz. Der Live-Cloud-Run-Proxy wird in den automatischen Browsertests bewusst **nicht** angesprochen. Playwright simuliert seine Antwort mit der Fixture. Dadurch bleiben die Regressionstests reproduzierbar und verursachen keine Cloud-Run-Aufrufe.

## Lokal ausführen

Einmalig:

```powershell
npm install
npx playwright install chromium
```

Unit-/Regressionstests:

```powershell
npm run test:unit
```

Browsertests:

```powershell
npm run test:e2e
```

Alles:

```powershell
npm test
```

## GitHub Actions

Bei jedem Push auf `main` und bei Pull Requests werden die Tests automatisch ausgeführt. Die GitHub-Pages-Veröffentlichung startet erst, wenn Unit- und Browsertests erfolgreich waren.

## Nächste Ausbaustufen

Weitere Saison-JSONs können später als zusätzliche Fixtures ergänzt werden. Danach sollten insbesondere Saisonaggregation, Spielerzuordnung über mehrere Spiele, Torwartkennzahlen und Durchschnitts-/Absolutmodus als feste Regressionstests ergänzt werden.
