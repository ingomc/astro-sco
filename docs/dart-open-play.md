# Dart-Sonntagstraining: öffentliche Anmeldung

Die Website zeigt die Anmeldung unter `/darts/anmelden/` und verlinkt darauf
direkt unter dem Darts-Header sowie auf der Startseite. Die Seite sendet keine
Directus-Zugangsdaten an den Browser. Sie spricht ausschließlich den
Custom-Endpoint `GET /dart-open-play` und `POST /dart-open-play/registrations`
an.

Nach einem erfolgreichen POST öffnet die Website `/darts/danke/` mit Termin,
Sportheim und Anmeldenummer. Die Bestätigung liegt nur im Session-Storage des
aktuellen Browser-Tabs; weder Name noch Kontaktdaten stehen in der URL oder im
Speicher. Ohne Bestätigung zeigt die Seite einen Link zurück zum Formular.

## Einmalige Einrichtung

1. Das produktive Directus läuft in einem separaten Dokploy-Compose-Template.
   Ein einmaliger Loader kopiert `package.json`, `dist/index.js` und
   `dist/logic.js` der Erweiterung `directus-extension-dart-open-play` aus dem
   veröffentlichten Repository in das gemeinsame Extensions-Volume. Exit-Code
   0 beim Loader ist normal. Nach einer Änderung muss auch der laufende
   Directus-Container neu gestartet werden, damit er die aktualisierte
   Erweiterung lädt. `GET /dart-open-play` muss danach `200` liefern.
2. Das Schema von `settings` und `event_dart_registrations` über die native
   [Directus-MCP-Schnittstelle](directus-migration.md#produktives-directus-per-mcp)
   prüfen. Nur fehlende Felder aus `scripts/directus/schema.mjs` anlegen. Ein
   pauschaler Sync der produktiven Sammlung ist dafür nicht nötig.
3. In der Directus-Singleton-Sammlung **Settings** `dart_open_play_enabled`
   aktivieren und `dart_open_play_time` auf `18:00` setzen. Beides lässt sich
   über das MCP-Werkzeug `items` aktualisieren. Die Werte wurden am 20.09.2026
   gesetzt; der öffentliche Endpoint meldete danach `open: true` für Sonntag,
   den 27.09.2026, 18:00 Uhr.
4. In Directus nur die benötigten Website-Origins erlauben:

   ```text
   DART_OPEN_PLAY_SITE_URL=https://www.sc-oberfuellbach.de
   DART_OPEN_PLAY_ALLOWED_ORIGINS=https://www.sc-oberfuellbach.de
   ```

   Für einen Vercel-Preview zusätzlich dessen konkrete `https://…vercel.app`
   Origin eintragen. In Produktion keine Wildcard verwenden.

5. Für Astro/Vercel `PUBLIC_DART_OPEN_PLAY_API_URL` auf
   `https://cms.dart.ingomc.de/dart-open-play` setzen. Fehlt die Variable,
   leitet der Build die URL aus `DIRECTUS_URL` ab.

## Verhalten und Schutz

- Der Server berechnet immer den nächsten Sonntag in `Europe/Berlin`; nach
  Trainingsbeginn wechselt er auf die Folgewoche.
- Die Serverzeit und nicht ein Browserwert bestimmt Termin, Titel und Ort.
- Die Anmeldung erfordert Name, Datenschutzzustimmung und mindestens eine
  Kontaktangabe. Die Handynummer steht im Formular zuerst; eine E-Mail-Adresse
  kann stattdessen oder zusätzlich angegeben werden. Die Angaben dienen nur
  Rückfragen und Terminänderungen zu dieser Anmeldung, nicht Werbung oder
  Newslettern.
- Meldet ein älterer Endpunkt noch keine `contactMethods` mit `phone`, bleibt
  das bisherige E-Mail-Pflichtfeld sichtbar. Nach dem Directus-Deploy wird die
  Handy-Anmeldung automatisch freigeschaltet.
- Honeypot, Origin-Allowlist, fünf Schreibversuche pro IP in 15 Minuten und
  eine Sperre gegen doppelte Handy- oder E-Mail-Anmeldungen für denselben Termin
  reduzieren Missbrauch.
- Die Registrierung wird mit `party_size = 1`, Status `new` und einer
  zufälligen Anmeldenummer in `event_dart_registrations` gespeichert.

## ntfy-Benachrichtigung

Wenn `DART_OPEN_PLAY_NTFY_URL` konfiguriert ist, sendet der Directus-Endpunkt
nach einer erfolgreich gespeicherten Anmeldung serverseitig eine Push-Nachricht
an das ntfy-Topic. Die öffentliche Konfiguration meldet dann
`notificationsEnabled: true`; nur dann zeigt das Formular den kurzen
Benachrichtigungshinweis. Die Nachricht
enthält Termin, Ort, Name, Anmeldenummer, vorhandene Handy- und E-Mail-Angaben
sowie optional den Hinweis (auf 500 Zeichen gekürzt; vollständig in Directus).
Weder Topic-Adresse noch Zugangstoken gelangen in den Browser.

In der Directus-Compose-Umgebung `DART_OPEN_PLAY_NTFY_URL` auf die vollständige
HTTPS-Topic-URL und bei geschütztem Topic `DART_OPEN_PLAY_NTFY_TOKEN` auf ein
reines Schreibtoken setzen. Die Erweiterung sendet per POST mit optionalem
Bearer-Token. Ein fehlendes Ziel deaktiviert die Benachrichtigung; bei einem
Zustellfehler bleibt die bereits gespeicherte Anmeldung erfolgreich und Directus
schreibt eine Warnung mit der Anmeldenummer, aber ohne Kontaktdaten oder
Topic-Adresse, ins Log. Das Topic muss für personenbezogene Daten vor
unbefugtem Lesen geschützt sein.

## Produktionsabgleich vom 20.09.2026

Die vorhandene Sammlung `event_dart_registrations` hatte zusätzlich das
versteckte Feld `ip_fingerprint` als Pflichtspalte ohne Standardwert. Der
Dart-Endpunkt schreibt dieses Feld nicht; deshalb beantwortete Directus eine
ansonsten gültige Anmeldung mit `500` und der allgemeinen Fehlermeldung. Über
die native MCP-Schnittstelle wurde für dieses Feld `schema.is_nullable` auf
`true` gesetzt. Außerdem wurde `name` von 100 auf 120 Zeichen erweitert, passend
zur Validierung der Erweiterung. Bestehende Anmeldungen blieben unverändert.

Danach lieferte ein vollständiger Test-POST `201`; der synthetische Datensatz
wurde anschließend wieder entfernt. Die bestehende Status-Auswahlliste in
Directus verwendet `new`, `confirmed` und `cancelled`. Die aktualisierte
Erweiterung schreibt `new`.

Für Handynummern wurde am 21.09.2026 in `event_dart_registrations` ein
optionales Textfeld `phone` (maximal 40 Zeichen) angelegt und `email` auf
optional gesetzt. Beide Änderungen wurden im produktiven Directus per MCP
zurückgelesen. Die aktualisierte Erweiterung wurde danach aus Commit
`e3cb728f3b65b4621f03970820ff9b671a207666` geladen. `GET /dart-open-play`
meldete `contactMethods: ["phone", "email"]`. Ein synthetischer POST nur mit
Handynummer lieferte `201` und wurde mit `email: null` und Status `new` über MCP
zurückgelesen; der Testdatensatz wurde direkt danach gelöscht.

## Dokploy-Rollout der Dart-Erweiterung

Das produktive Directus ist der eigene Raw-Compose-Dienst
`dart-directus-ss0lpg` in Dokploy unter `https://dok.ingomc.de/`. Die API liegt
unter `/api/` und verwendet den Header `x-api-key` mit dem lokalen,
nicht versionierten `DOKPLOY_API_KEY` aus `.env`. Die Compose-ID war am
21.09.2026 `U97AX6udPP_1TnoZti72r`; vor Änderungen per `compose.search` und
`compose.one` gegenprüfen.

1. Die drei `raw.githubusercontent.com/ingomc/astro-sco/<commit>/…`-URLs im
   bestehenden `composeFile` auf **denselben geprüften Commit** setzen und nur
   `composeFile` über `POST /api/compose.update` aktualisieren. Die drei Dateien
   sind `package.json`, `dist/index.js` und `dist/logic.js`. Vorher und nachher
   per `compose.one` prüfen, dass alle drei URLs stimmen und `env` unverändert
   bleibt.
2. `POST /api/compose.deploy` mit `freshVolumes: false` ausführen. Das erstellt
   den einmalig laufenden `dart_extension_loader` neu; `Exited (0)` ist der
   erwartete Erfolg. Im Deploy-Log prüfen, ob Directus selbst nur als `Running`
   aufgeführt wird.
3. Falls Directus nicht neu erstellt wurde, über
   `docker.getContainersByAppNameMatch?appName=dart-directus-ss0lpg&appType=docker-compose`
   die aktuelle ID von `dart-directus-ss0lpg-directus-1` ermitteln und nur
   diesen Container per `POST /api/docker.restartContainer` neu starten. Die
   Datenbank-, Cache- und Loader-Container nicht dafür neu starten.
4. Den öffentlichen Endpoint zurücklesen und die neue Funktion prüfen. Ein
   Website-Deploy allein aktualisiert den Directus-Prozess nicht.
