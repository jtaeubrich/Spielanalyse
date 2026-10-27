# Vom Einzelspiel zur gesamten Saison

Die Spielanalyse unterstützt zwei organisatorische Einstiege. Die eigentliche Ereigniserfassung erfolgt anschließend in denselben drei Workflows [W1 (Live), W2 (Live + Video) und W3 (Video)](workflows.md).

## Welcher Einstieg ist richtig?

| Situation | Einstieg | Speicherung |
|---|---|---|
| Einzelne Begegnung ohne Saisonverknüpfung | **Setup → Neues Spiel** oder **Spiel laden (JSON)** | Eigenständige Spiel-JSON; **Spiel speichern** aktualisiert die geöffnete Datei, sofern der Browser dies ermöglicht, oder bietet einen Download |
| Begegnung der verwalteten Saison | **Setup → Spiel aus Saison laden** | Änderungen werden unter der bestehenden Saisonspiel-ID lokal im Saisonarchiv aktualisiert; **Spiel speichern** sichert diesen Datensatz |
| Nachanalyse einer Saisonbegegnung | **Setup → Spiel aus Saison laden → Für Analyse öffnen** | Dieselbe Saisonbegegnung, keine zusätzliche Kopie |
| Dateien zur Archivierung/Übertragung | **Setup → Saison → Saison exportieren** oder **Team-Archiv (ZIP) exportieren** | Exportierte Momentaufnahme; kein automatischer Abgleich mit früher heruntergeladenen Dateien |

## Fehlende Schützen mit dem nuLiga-Spielbericht ergänzen

Ist ein bereits live gescoutetes Spiel Teil der Saison, lässt sich der offizielle Bericht direkt am vorhandenen Saisonspiel abgleichen:

1. Das Live-Spiel zunächst **speichern**, danach unter **Setup → Saison → Saison exportieren** eine JSON-Sicherung erstellen.
2. Unter **Setup → Saison** die richtige Saison aktivieren und **Saisonspiele** aufklappen.
3. Bei der betreffenden Begegnung **Protokollabgleich** wählen. Das funktioniert für manuell erstellte und Handball360-verknüpfte Spiele ebenso wie für nuLiga-Spiele.
4. Die vollständige nuLiga-**Spielbericht-URL** eingeben oder die HTML-Datei auswählen, dann **Offizielles Protokoll laden und vergleichen**.
5. Die Vorschau vergleicht eigene unzugeordnete Tore und Strafereignisse mit der offiziellen Liste nach Mannschaft, Ereignistyp, Spielstand und Spielzeit. Eindeutige Treffer sind vorausgewählt; Vorschläge nur nach Zeitnähe müssen ausdrücklich geprüft werden.
6. Nicht passende Vorschläge abwählen oder pro Ereignis einen anderen passenden offiziellen Eintrag auswählen. Es darf niemals derselbe offizielle Eintrag mehreren eigenen Ereignissen zugeordnet werden.
7. **Kader, Protokoll und ausgewählte Schützen übernehmen** tippen und den Bestätigungsdialog akzeptieren.

Die Übernahme ergänzt **ausschließlich Spieler-ID, Nummer und Namen** an ausgewählten bereits vorhandenen Scouting-Ereignissen. Eigene Wurfpositionen, Wurfziele, Kommentare, Ereignisanzahl, Spielstand und ursprüngliche Zeit-/Videoangaben bleiben erhalten. Offizielle Ereignisse werden zur späteren Kontrolle **separat** gespeichert und nicht als zusätzliche Tore gezählt. Wenn kein Spieler eindeutig aus dem offiziellen Kader hervorgeht, wird keine Spielerzuordnung vorgenommen. Ein erneuter Import zeigt nur noch Ereignisse ohne Spielerzuordnung.

**Wichtig:** Vor dem Bestätigen Spielnummer, Heim-/Gastseite und Mannschaften prüfen. Bei einem manuell bzw. über Handball360 angelegten Spiel fragt die App ausdrücklich nach, ob die nuLiga-Spielnummer dieser Begegnung zugeordnet werden darf. Es erfolgt keine automatische Korrektur von Ereignistypen, Zeiten, Toren oder bereits eingetragenen Schützen.

## Eine Saison erstmals einrichten

![Saisonspielplan in der echten PWA – anonymisierte Demodaten](images/generated/season-import-preview-desktop.jpg)

1. **Saison** öffnen und **Saison über Handball360 importieren** wählen.
2. Mannschaftslink eingeben, z. B. [Team 85814, Phase 13580](https://www.handball.net/team/85814?phaseId=13580), und Saisonzeitraum prüfen.
3. Über **Spielplan laden** die Begegnungen abrufen. Der Import zeigt zu jeder Begegnung Datum, Mannschaften und Status.
4. **Bereits manuell erfasste Spiele zuerst zuordnen.** Bei **Möglicherweise vorhanden** das richtige vorhandene Spiel wählen und **Manuelles Spiel zuordnen** bestätigen. Dadurch bleibt das ursprüngliche Scouting erhalten und erhält seine offizielle Match-ID.
5. Erst anschließend **Alle neuen auswählen (auch zukünftige)** und **Ausgewählte Spiele importieren**. Die noch nicht gespielten Partien bleiben ohne Ereignisse und sind zunächst aus der Saisonstatistik abgewählt.
6. **Mein Team für die Saison** und **Archiv-Mannschaft** prüfen. Die dauerhaft verwendete Archiv-Mannschaft bestimmt den obersten Ordner des ZIP-Exports, nicht die jährlich wechselnde Handball360-Team-ID.

**Achtung:** Handball360 liefert nicht alle handballspezifischen Auswertungen der Spielanalyse. Insbesondere Wurfpositionen, Wurfziele und vollständige Torhüterstatistiken können aus reinen offiziellen Ereignissen fehlen. Bereits selbst gescoutete Ereignisse werden bei der offiziellen Aktualisierung nicht ungefragt ersetzt.

## Saisonverwaltung und Analysebereiche (aktuelle Navigation)

Die Verwaltung der geladenen Saison befindet sich unter **Setup → Saison** und ist von der **Saisonanalyse** getrennt. Unter **Setup → Einzelspiel** werden weiterhin einzelne Matches angelegt, mit Kader und Spielzeit vorbereitet oder zum Scouting geöffnet.

Unter **Setup → Saison → Gespeicherte Saisons** lassen sich mehrere Saisons getrennt auf demselben Gerät verwalten. Mit **+ Neue Saison** entsteht eine weitere, zunächst leere Saison; über die Auswahl kann man zwischen vorhandenen Saisons wechseln, ohne deren Spiele zu vermischen. Die bisherige lokal gespeicherte Saison wird beim ersten Start in die neue Saisonbibliothek übernommen. Ein **Saison-JSON-Import** erzeugt ebenfalls einen eigenen gespeicherten Saisoneintrag. **Saison leeren** entfernt nur die Spiele der ausgewählten Saison; andere lokal gespeicherte Saisons bleiben erhalten. Zur Sicherung auf anderen Geräten weiterhin **Saison exportieren** oder **Team-Archiv (ZIP) exportieren** verwenden. Die lokale Saisonbibliothek wird nicht zwischen Geräten synchronisiert.

Der Haupttab **Analyse** zeigt das **Einzelspiel**. Sein Dropdown **Einzelspiel auswählen** bietet die geladenen Saisonbegegnungen oder das aktuelle Match an. Die Auswahl verändert **nicht** das aktive Live-Scouting-Spiel, die Spielzeit oder das Video. Für die Videonachanalyse eines anderen Spiels muss es unter **Setup → Einzelspiel → Spiel aus Saison laden** ausdrücklich geöffnet werden. Der separate Haupttab **Saisonanalyse** zeigt ausschließlich spielübergreifende Auswertungen der ausgewählten Saisonspiele.

## nuLiga-Demonstration: Saison per Online-Link

Unter **Setup → Saison** steht **nuLiga HTML-Demo** mit einer **Online-Link-Anbindung** bereit. Der Prototyp ruft nur auf Benutzeraktion die jeweils öffentliche nuLiga-Seite über den bestehenden Cloud-Run-Proxy ab. Er speichert keine separaten HTML-Dateien, crawlt nicht im Hintergrund und nutzt keine Zugangsdaten.

1. **Setup → Saison → nuLiga HTML-Demo** wählen und einen öffentlichen Mannschaftslink einfügen, beispielsweise HC Bremen / HVNB 2026/27.
2. **Spielplan online laden** wählen. Bei einer Teamseite mit Staffelreferenz wird die zugehörige öffentliche Gesamtspielplan-Seite einmalig angefordert. Die Begegnungen werden als Vorschau mit Datum, Spielnummer und Gegner angezeigt.
3. Neue Saisonspiele markieren und mit **Ausgewählte Saisonspiele anlegen** übernehmen. Bereits vorhandene nuLiga-Spielnummern werden nicht doppelt importiert. Unbespielte Partien bleiben zunächst ohne Ereignisse und aus der Statistik abgewählt.
4. Ein Saisonspiel zum Abgleich auswählen. Wenn aus dem Spielplan eine passende Spielbericht-URL bekannt ist, steht sie im Feld **Online-Spielbericht-URL**. Andernfalls die öffentliche Bericht-URL selbst einfügen.
5. Über **Bericht online laden und abgleichen** den einzelnen öffentlichen Bericht einlesen. Verfügbare Kader und offizielle Ereignisse werden übernommen. Bereits selbst gescoutete Ereignisse, Kommentare und Video bleiben unverändert; die offiziellen Ereignisse werden dann separat unter `officialData.nuLigaEvents` abgelegt.

Ein versteckter optionaler Dateiimport unter **Optional: lokal vorhandene HTML-Seite verwenden** bleibt als Reserve erhalten, ist aber für den Online-Ablauf nicht nötig.

**Technische Grenzen:** Der Online-Abruf erfolgt über `/nuliga/html` des bestehenden Cloud-Run-Proxys mit fest begrenztem nuLiga-HVNB-Host, öffentlichen Seitenpfaden, maximaler Antwortgröße und Zeitlimit. Er kann trotzdem an Änderungen des HTML-Aufbaus, CORS/Proxy-Fehlern, Server-Sperren oder Weiterleitungen scheitern. Für eine produktive, dauerhafte automatische Datennutzung sind die Bedingungen von nuLiga und HVNB zu klären.


## Ein Saisonspiel im Setup vorbereiten

![Setup: Saisonspiel auswählen und vorbereiten – Desktop](images/generated/setup-season-game-desktop.jpg)

[Smartphoneansicht](images/generated/setup-season-game-mobile.jpg)

1. Im **Setup** unter **Spiel aus Saison laden** die gewünschte Begegnung auswählen.
2. Bei noch nicht begonnenen Spielen **Vorbereiten / fortsetzen** nutzen. Bei bereits importierten offiziellen oder Videoereignissen **Für Analyse öffnen** wählen.
3. Heim/Gast, Spielzeit und Trikotnummern kontrollieren. Kader sind für jedes Spiel einzeln gespeichert.
4. Für den Spieltag etwa 30 Minuten vor Anpfiff die aktuellen Meldungen aus Handball360 abrufen (nächster Abschnitt).
5. Anschließend im **Match**-Tab W1, W2 oder W3 durchführen. Für Live-Scouting **unbedingt vor dem ersten Event zuerst Realzeit starten, dann Spielzeit starten**.

**Wichtig:** Das aus der Saison geöffnete Spiel bleibt mit dem Saison-Datensatz verknüpft. Eigene Änderungen sollen nicht zusätzlich über einen unabhängigen JSON-Import in die Saison eingefügt werden; das könnte eine zweite Version erzeugen.

## Kurz vor Anpfiff: bestätigte Spielkader übernehmen

![Offizieller Kadervergleich – Desktop](images/generated/setup-lineup-review-desktop.jpg)

[Smartphoneansicht](images/generated/setup-lineup-review-mobile.jpg)

1. Saisonbegegnung im Setup auswählen und **Kader aus Handball360 aktualisieren** drücken.
2. Der Dialog zeigt für Heim und Gast neue Spieler, nicht mehr gemeldete Spieler und Änderungen etwa an Trikotnummern.
3. **Offizielle Kader übernehmen** bestätigt die Aktualisierung. Über **Abbrechen** bleibt alles wie bisher.
4. Fehlende offizielle Aufstellungen ersetzen vorhandene Kader **nicht**. Ein erneut ausgeführter Abruf ist möglich, sobald die Meldung vorliegt.
5. **Auch bereits gescoutete Saisonspiele können abgeglichen werden:** Statt den bestehenden Kader zu ersetzen, werden offizielle Spieler nur bei eindeutiger Zuordnung mit stabilen lokalen Spieler-IDs aktualisiert. Nicht gemeldete historische Spieler, Ereignisse, Videos und Kommentare bleiben erhalten; neue Spieler werden ergänzt. Unterschiede vor der Bestätigung prüfen. Bei fehlender Match-ID unter **Setup → Saison** zuerst **Manuelles Spiel zuordnen** durchführen.

Der Kadervergleich ändert nur den jeweiligen Spielkader, nicht die globale Mannschaftssammlung. Ein bereits geöffnetes und mit der Saison verbundenes Spiel wird ebenfalls synchronisiert.

## Saison auswerten und sichern

![Saisonspiel-Liste (Desktop)](images/generated/season-overview-desktop.jpg)

[Smartphoneansicht](images/generated/season-overview-mobile.jpg)

Die **Saisonanalyse** berücksichtigt nur die ausdrücklich ausgewählten Spiele. Künftige Begegnungen mit leerer Ereignisliste zählen daher nicht mit. Die Filter ermöglichen Team-, Spieler- und Ereignisauswertungen über mehrere Spiele.

![Saison-Kennzahlen und Filter in der PWA – Demowerte](images/generated/season-analytics-desktop.jpg)

**Sicherung:** Über **Saison exportieren** entsteht eine JSON-Datei mit der aktuellen Saison. Über **Team-Archiv (ZIP) exportieren** entsteht zusätzlich eine Ordnerstruktur mit einer vollständigen `spiel.json` pro Begegnung:

```text
TSV_Kronshagen_mB/
├── TSV_Kronshagen_vs_SG_Flensburg-Handewitt_II_378112/
│   ├── spiel.json
│   ├── videos/
│   └── exports/
└── Saison_2026_27_index.json
```

Auch **manuell erfasste und später zugeordnete Spiele** werden in dieses ZIP aufgenommen. Videoverweise und Zeichnungsdaten sind Teil der Spiel-JSON, aber die eigentlichen MP4-Videos werden **noch nicht** ins ZIP eingebettet. Das ZIP ist eine Momentaufnahme: Nach weiteren Änderungen muss es erneut exportiert werden.

## Hinweise zu den Screenshots

Die Screenshots stammen aus der **echten Spielanalyse-PWA** (Playwright/Chromium). Als Grundlage dienen die 18 Spieltermine, Begegnungen und Match-IDs der Saison 2026/27. **Alle dargestellten Spieler und alle Ereignis-/Statistikwerte sind anonymisierte Demo-Daten**, nicht die personenbezogenen Scouting-Daten des Vereins. Der Handball360-Spielplan und der Kaderabruf werden bei der automatischen Aufnahme simuliert; hierfür ist kein Live-Abruf öffentlicher Schnittstellen erforderlich. Auf iPhone/iPad können Datei- und Speicherdialoge anders aussehen.
