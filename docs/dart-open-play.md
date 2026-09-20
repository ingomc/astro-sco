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
   veröffentlichten Repository in das gemeinsame Extensions-Volume. Directus
   startet nach erfolgreichem Loader-Lauf mit diesem Volume. `Exited (0)` beim
   Loader ist normal; Directus muss nach einer Änderung neu erstellt werden,
   damit es die Erweiterung lädt. `GET /dart-open-play` muss danach `200`
   liefern.
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
- Solange der produktive Endpunkt noch keine `contactMethods` mit `phone`
  meldet, bleibt das bisherige E-Mail-Pflichtfeld sichtbar. Erst nach dem
  Directus-Deploy wird die Handy-Anmeldung freigeschaltet.
- Honeypot, Origin-Allowlist, fünf Schreibversuche pro IP in 15 Minuten und
  eine Sperre gegen doppelte Handy- oder E-Mail-Anmeldungen für denselben Termin
  reduzieren Missbrauch.
- Die Registrierung wird mit `party_size = 1`, Status `new` und einer
  zufälligen Anmeldenummer in `event_dart_registrations` gespeichert.

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

Für Handynummern muss in `event_dart_registrations` ein optionales Textfeld
`phone` (maximal 40 Zeichen) angelegt und `email` auf optional gesetzt werden.
Diese beiden Schemaänderungen wurden am 21.09.2026 im produktiven Directus per
MCP durchgeführt und anschließend zurückgelesen.
Danach die drei Dateien der aktualisierten Erweiterung im separaten
Dokploy-Compose-Template laden und den Directus-Container neu erstellen. Ein
Website-Deploy allein kann den Directus-Endpunkt nicht aktualisieren.
