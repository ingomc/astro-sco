# Dart-Sonntagstraining: öffentliche Anmeldung

Die Website zeigt die Anmeldung unter `/darts/anmelden/` und verlinkt darauf
direkt unter dem Darts-Header sowie auf der Startseite. Die Seite sendet keine
Directus-Zugangsdaten an den Browser. Sie spricht ausschließlich den
Custom-Endpoint `GET /dart-open-play` und `POST /dart-open-play/registrations`
an.

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
- Die Anmeldung erfordert Name, E-Mail-Adresse und Datenschutzzustimmung.
- Honeypot, Origin-Allowlist, fünf Schreibversuche pro IP in 15 Minuten und
  eine Sperre gegen doppelte E-Mail-Anmeldungen für denselben Termin reduzieren
  Missbrauch.
- Die Registrierung wird mit `party_size = 1`, Status `Neu` und einer
  zufälligen Anmeldenummer in `event_dart_registrations` gespeichert.
