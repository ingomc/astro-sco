# Staging-Umgebung (Dokploy + Directus + Astro)

Per-Branch-Previews auf einer eigenen Subdomain, plus ein dedizierter
Staging-Directus mit synthetischen Daten.

```
feat/* ──push──> Dokploy Preview Build ──>  https://<branch>.staging.sc-oberfuellbach.de
                                  │
                                  └──>  baut gegen DIRECTUS_URL=https://cms-staging.dart.ingomc.de

main   ──push──> Dokploy Prod Build    ──>  https://www.sc-oberfuellbach.de
                                  │
                                  └──>  baut gegen DIRECTUS_URL=https://cms.dart.ingomc.de
```

## 1. Repository-Vorbereitung (lokal)

Die nötigen Configs liegen bereits im Repo:

- `Dockerfile` – Multi-Stage-Build (Node 20 → nginx:alpine)
- `docker/nginx.conf` + `docker/security-headers.conf` – Runtime-Konfig
- `.dockerignore`
- `docker-compose.local.yml` – lokaler Test-Build
- `.env.example` – Vorlage für lokale `.env`
- `.nvmrc` – pinnt Node 20
- `astro.config.mjs` – liest `SITE_URL` + `EXTRA_IMAGE_DOMAINS` aus Env
- `src/components/BaseHead.astro` – JSON-LD nutzt `SITE_HOST`
- `src/layouts/App.astro` – `STAGING=1` schaltet Analytics aus, zeigt Banner

Lokal testen:

```sh
cp .env.example .env
# .env ausfüllen (DIRECTUS_URL, DIRECTUS_TOKEN)
docker compose -f docker-compose.local.yml up --build
# → http://localhost:8080
```

## 2. DNS

Im DNS-Provider deiner `sc-oberfuellbach.de`-Domain:

| Record | Wert | Zweck |
| --- | --- | --- |
| `A staging` | VPS-IP | Wildcard über Dokploy-Traefik |
| `CNAME *.staging` | `staging.sc-oberfuellbach.de` | Subdomains pro Branch |

Traefik in Dokploy terminiert TLS automatisch (Let's Encrypt). Du brauchst
für die Wildcard-Subdomain entweder einen DNS-01-Challenge oder ein
Multi-Domain-Zertifikat – in Dokploy unter "Domains" → "Generate Certificate"
für `*.staging.sc-oberfuellbach.de` einrichten (HTTP-01 funktioniert für
Wildcards nicht zuverlässig).

## 3. Staging-Directus aufsetzen

Auf dem VPS, in Dokploy ein zweiter Stack (`sco-cms-staging`) mit:

```yaml
# dokploy compose für cms-staging.dart.ingomc.de
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: directus
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: directus
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U directus"]
      interval: 10s
      timeout: 5s
      retries: 5

  directus:
    image: directus/directus:11
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      KEY: ${DIRECTUS_KEY}
      SECRET: ${DIRECTUS_SECRET}
      DB_CLIENT: pg
      DB_HOST: postgres
      DB_PORT: 5432
      DB_DATABASE: directus
      DB_USER: directus
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      WEBSOCKETS_ENABLED: "true"
    labels:
      - "traefik.http.routers.cms-staging.rule=Host(`cms-staging.dart.ingomc.de`)"
      - "traefik.http.routers.cms-staging.entrypoints=websecure"
      - "traefik.http.routers.cms-staging.tls.certresolver=letsencrypt"
      - "traefik.http.services.cms-staging.loadbalancer.server.port=8055"

volumes:
  postgres-data: {}
```

Direkt nach dem ersten Start das Schema provisionieren und mit Testdaten
befüllen (per SSH auf den Directus-Container oder via lokales `pnpm`):

```sh
# Schema identisch zu Prod anlegen
DIRECTUS_URL=https://cms-staging.dart.ingomc.de \
DIRECTUS_TOKEN=<admin-token> \
pnpm run directus:provision:sync

# Synthetische Inhalte seeden
pnpm run directus:seed:assets
```

Eigenes Static-Token für Astro-Builds anlegen
(Directus → Settings → Access Tokens → "Astro Build Read") und in Dokploy
als `DIRECTUS_TOKEN` hinterlegen.

## 4. Astro-App in Dokploy anlegen

Neue Application → Typ "Compose" oder "Docker Image". In den meisten
Dokploy-Versionen ist "Dockerfile" als Build-Quelle am einfachsten.

### 4.1 Production Build (`main` Branch)

| Feld | Wert |
| --- | --- |
| Source | GitHub: `ingomc/astro-sco` |
| Branch | `main` |
| Build method | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Domain | `www.sc-oberfuellbach.de` |
| HTTPS | Let's Encrypt |

**Build args:**

| Arg | Wert |
| --- | --- |
| `DIRECTUS_URL` | `https://cms.dart.ingomc.de` |
| `DIRECTUS_TOKEN` | (Static Read Token aus Prod-Directus) |
| `SITE_URL` | `https://www.sc-oberfuellbach.de/` |
| `SITE_HOST` | `sc-oberfuellbach.de` |
| `STAGING` | `0` |
| `EXTRA_IMAGE_DOMAINS` | (leer) |

Auto-Deploy: an, Webhook auf `push` zu `main`.

### 4.2 Preview Builds (`feat/*` Branches)

Dokploy unterstützt "Preview Deployments" pro Branch (siehe Dokploy-Docs
→ "Preview Deployments"). Aktivieren mit:

- Branch pattern: `feat/*` (oder `*` für alle, dann unter "ignore"
  `main` setzen)
- Domain template: `{{branch}}.staging.sc-oberfuellbach.de`
- Build args: identisch zu Prod, **aber**:
  - `DIRECTUS_URL=https://cms-staging.dart.ingomc.de`
  - `DIRECTUS_TOKEN=<staging-token>`
  - `SITE_URL=https://{{branch}}.staging.sc-oberfuellbach.de/`
  - `SITE_HOST={{branch}}.staging.sc-oberfuellbach.de`
  - `STAGING=1`
  - `EXTRA_IMAGE_DOMAINS=cms-staging.dart.ingomc.de`

Dokploy ersetzt `{{branch}}` in Domain-Templates automatisch. Für die
`SITE_URL`/`SITE_HOST`-Args musst du schauen, ob deine Dokploy-Version
Variable-Substitution in Build-Args unterstützt – falls nicht, setze
`SITE_URL` auf `https://staging.sc-oberfuellbach.de/` und akzeptiere,
dass canonical/sitemap-URLs in Previews auf eine einheitliche Staging-URL
zeigen (visuelles Testen ist trotzdem korrekt; nur die SEO-Metadaten
zeigen auf die Staging-Basis statt auf den konkreten Preview-Host).

## 5. Workflow

```sh
# Neue Feature-Branch
git checkout -b feat/neue-sektion

# ... Code ändern, committen
git commit -m "feat: neue Sektion"
git push origin feat/neue-sektion

# → Dokploy baut automatisch einen Preview
# → https://feat-neue-sektion.staging.sc-oberfuellbach.de
```

PR nach `main` mergen → automatischer Production-Build, Live unter
`https://www.sc-oberfuellbach.de`.

## 6. Direkter CMS-Zugriff

Das Staging-Directus läuft unter `https://cms-staging.dart.ingomc.de`.
Login mit den `ADMIN_EMAIL`/`ADMIN_PASSWORD` aus dem Staging-Stack.

## 7. Bekannte Einschränkungen

- **Canonical & Sitemap zeigen auf `SITE_URL`** (in Previews evtl. die
  falsche Host). Für eine SEO-konforme Vorschau müsste man
  `SITE_URL` zur Build-Zeit pro Preview injizieren (Dokploy-Preview-Args
  in neueren Versionen können das; sonst Workaround via eigenem
  Traefik-Middleware + Runtime-Header).
- **`/admin/`** (Decap CMS) ist im Build enthalten. Decap schreibt in den
  Branch `main` und ist nur für Prod gedacht. In Previews nicht benutzen
  (oder `public/admin/` per `STAGING=1` ausschließen, falls gewünscht).
- **Analytics & Speed-Insights** sind in `STAGING=1` deaktiviert. Eine
  kleine gelbe Banner-Leiste markiert die Staging-Umgebung.
- **Build-Zeit-Abhängigkeit zu Directus**: Jeder Preview-Build macht
  `fetch()`-Calls auf das Staging-CMS. Wenn das CMS offline ist, schlägt
  der Build fehl. Workaround: `CONTENT_SOURCE=astro` (dann aber nur lokale
  Markdown-Inhalte, von denen seit der Directus-Migration nur noch wenige
  da sind).
