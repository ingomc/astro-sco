# Essensvorbestellungen

Die Essensvorbestellung ist für beliebige Einträge aus `veranstaltungen`
verwendbar. Sie wird nicht über öffentliche Directus-Collection-Rechte
betrieben: Nur die Erweiterung unter `/food-preorders` darf Reservierungen
anlegen oder ändern.

## Einmaliges Deployment

1. Das Directus-Image mit [directus/Dockerfile](../directus/Dockerfile) bauen.
   Es enthält den öffentlichen Endpunkt und die tägliche
   Anonymisierungs-Erweiterung.
2. Die Collections und Beziehungen in Staging und Produktion anlegen:

   ```sh
   DIRECTUS_URL=https://cms.example.de \
   DIRECTUS_TOKEN=<admin-token> \
   pnpm run directus:provision:sync
   ```

3. Im Directus-Container konfigurieren:

   ```env
   ORDER_SITE_URL=https://www.sc-oberfuellbach.de
   ORDER_ALLOWED_ORIGINS=https://www.sc-oberfuellbach.de
   TZ=Europe/Berlin
   CORS_ENABLED=true
   CORS_ORIGIN=https://www.sc-oberfuellbach.de
   ```

   Für Staging-Previews darf `ORDER_ALLOWED_ORIGINS=*` und `CORS_ORIGIN=true`
   verwendet werden. Das ist ausschließlich für die Testumgebung vorgesehen.

4. Die vorhandene Directus-SMTP-Konfiguration mit einer Testreservierung
   prüfen. Der Absender muss zustellbar sein; die Erweiterung verwendet
   Directus' `MailService`.

   Für ein ausschließlich internes Test-CMS darf vorübergehend
   `ORDER_TEST_MODE=true` gesetzt werden. Dann wird kein E-Mail-Versand
   ausgelöst und die Reservierung im Browser direkt bestätigt. Diese Variable
   darf niemals in Staging oder Produktion aktiviert werden.

5. Die Astro-Anwendung mit diesem Build-Argument bereitstellen:

   ```env
   PUBLIC_FOOD_ORDERS_API_URL=https://cms.example.de/food-preorders
   ```

## Eine Veranstaltung einrichten

1. Im Directus-Content-Modul unter **Food Orderings** einen Eintrag erstellen,
   das zugehörige Event verknüpfen, Bestellschluss setzen und erst danach
   `active` aktivieren.
2. Unter **Food Dishes** die Gerichte mit Beschreibung, Allergenen, Preis in
   Cent und Kontingent anlegen. Inaktive Gerichte sind nicht bestellbar.
3. Die Veranstaltungsseite öffnen. Das Menü lädt zur Laufzeit; ein Astro-Build
   ist nach Änderungen an Gerichten, Kontingenten oder Bestellschluss nicht
   erforderlich.

## Organisation am Veranstaltungstag

- **Food Reservations** enthält die Reservierungen inklusive Status.
- Für die Küche in **Food Reservation Lines** nach `ordering` und
  `status = confirmed` filtern und die sichtbaren Spalten als CSV exportieren.
  Die Daten sind flach: Reservierungsnummer, Name, E-Mail, Gericht, Menge und
  Preis stehen jeweils in einer Zeile.
- Bestellungen werden erst nach dem Klick auf den E-Mail-Link als `confirmed`
  gezählt. Änderungs- und Stornolinks gelten nur bis zum Bestellschluss.
- Die tägliche Retention-Erweiterung anonymisiert Kunden- und Token-Daten
  30 Tage nach dem Event. Mengen und Gerichtsstatistiken bleiben erhalten.

## Sicherheitsregeln

- Für `food_orderings`, `food_dishes`, `food_reservations` und
  `food_reservation_lines` der Public Role keinerlei Rechte geben.
- Der Endpunkt prüft erlaubte Origins, Honeypot, Eingaben, Bestellschluss und
  Gerichtskontingente. Öffentliche Schreibvorgänge sind auf fünf Anfragen je
  IP-Adresse in 15 Minuten begrenzt.
- Die Bestätigungs- und Verwaltungslinks enthalten zufällige Tokens; Directus
  speichert ausschließlich deren SHA-256-Hash.
