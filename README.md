# SCO Website

## Design System (Public Site)

Die zentrale UI-Governance liegt hier:

- `docs/design-system/DESIGN-TOKENS.md`
- `docs/design-system/DESIGN-SYSTEM.md`
- `docs/design-system/COMPONENT-PATTERNS.md`
- `docs/design-system/CONTRIBUTING-UI.md`

Diese Dokumente sind die Single Source of Truth fuer neue Public-UI-Features (z. B. Bestellsystem).

```text
TODO:

 - [ ] Mobile Menu
 - [ ] Gallery auf der Veranstaltungsseite
 - [ ] Startseite
 - [ ] Startseiten Beiträge
 - [ ] Veranstaltungen Übersicht
 - [ ] Mitglieder
 - [ ] Datenschutz
 - [ ] Impressum
 - [ ] Vercel deployment mit analytics?

Netlify CMS
 https://okaycloud.de/manage-and-display-authors-with-netlifycms-and-gatsby/
 https://decapcms.org/docs/beta-features/#working-with-a-local-git-repository

## Inspiration
https://infallible-varahamihira-058515.netlify.app/projects/2021-08-14-new-office-spaces-in-central-kopenhagen/


## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:3000`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Local Neon setup (safe)

For the event signup API we recommend two separate DB URLs:

- `DATABASE_URL`: shared/staging/production target
- `LOCAL_DATABASE_URL`: your personal local dev database

In local dev (`npm run dev`), the app automatically prefers `LOCAL_DATABASE_URL`
if present. This prevents accidental writes to shared data.

1. Copy `.env.example` to `.env.local`
2. Fill in your local Neon (or local Postgres) URL in `LOCAL_DATABASE_URL`
3. Set `ADMIN_EXPORT_TOKEN` for local admin routes

Example:

```env
DATABASE_URL=postgresql://...
LOCAL_DATABASE_URL=postgresql://...
ADMIN_EXPORT_TOKEN=local-dev-token
DB_DRIVER=neon
```

Admin endpoints:

- `/admin/event-signups?token=<ADMIN_EXPORT_TOKEN>`
- `/admin/event-signups/kerwa-2026?token=<ADMIN_EXPORT_TOKEN>`
- `/admin/event-signups/system/open-notes?token=<ADMIN_EXPORT_TOKEN>`
- `/api/admin/event-signups.csv?token=<ADMIN_EXPORT_TOKEN>&eventId=kerwa-2026`

Second event example (`registration` mode):

```yaml
signup:
  enabled: true
  eventId: dartturnier-2026
  mode: registration
  deadline: 2026-11-10T22:59:00.000Z
  capacity: 48
  maxPartySize: 1
  notesLabel: Frage an die Orga (optional)
  notesPlaceholder: Z. B. Teamwunsch oder kurze Rueckfrage
```

For `registration`, no `items` are needed. Capacity blocks additional
registrations once reserved seats exceed the limit.
All modes support an optional `notes` text input in the form (for allergies
or short questions), which is included in admin views and CSV export.

## Signup Security v1

Public signup requests are protected by:

- hCaptcha (fail-closed)
- Rate limits (`5/min` per IP, `30/h` per IP, `12/h` per event+IP)
- Honeypot + server-side abuse logging (`captcha_failed`, `rate_limited`, `honeypot_hit`)

Required environment variables:

```env
HCAPTCHA_SITE_KEY=...
HCAPTCHA_SECRET_KEY=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
IP_FINGERPRINT_SALT=...
```

Local-only optional bypass:

```env
HCAPTCHA_DEV_BYPASS=true
```

`HCAPTCHA_DEV_BYPASS` is only honored in local `DEV` mode and should never be
enabled for preview/production.

For abuse analysis, each signup stores a masked (hashed) IP fingerprint
(`ip_fingerprint`), never the raw IP.
