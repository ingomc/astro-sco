# Directus Migration Commands

This project now includes migration scripts to provision Directus schema and import Astro content.

## Required Environment Variables

- DIRECTUS_URL
  - Supports MCP endpoint URL (for example: <https://cms.dart.ingomc.de/mcp>).
  - The scripts automatically try both API roots:
    - with /directus prefix
    - without /directus prefix
- DIRECTUS_TOKEN
  - Preferred token variable.
- MCP
  - Fallback token variable if DIRECTUS_TOKEN is not set.
- DIRECTUS_API_URL (optional)
  - Force a specific Directus REST API root if auto-detection is not correct.
- CONTENT_SOURCE (optional)
  - Controls read-path behavior for migrated pages.
  - Values:
    - auto (default): try Directus, fallback to Astro content on failure.
    - directus: require Directus for migrated collections.
    - astro: force local Astro content.

## Commands

- npm run directus:provision
  - Create missing collections and fields from scripts/directus/schema.mjs.
- npm run directus:provision:sync
  - Also patches existing collection/field metadata.
- npm run directus:import:dry
  - Dry-run import from src/content into Directus.
  - Reads existing records and reports create/update counts.
- npm run directus:import
  - Applies upserts to Directus.
- npm run directus:import:assets:dry
  - Dry-run import plus relative body-image rewrite simulation.
- npm run directus:import:assets
  - Apply import plus relative body-image upload and markdown rewrite.

## Current Scope

Provisioned collections:

- veranstaltungen
- berichte
- mitglieder
- start
- sportheim
- settings

Importer behavior:

- Parses markdown and mdx frontmatter + body.
- Preserves Astro-like slugs from file paths.
- Upserts content collections by slug.
- Upserts singleton settings from src/content/settings/settings.json.
- Can rewrite relative body image references to Directus asset paths when --rewrite-assets is enabled.

Read-path behavior (implemented):

- Migrated list/feed/detail metadata reads via adapter in src/lib/content-source.ts.
- Detail pages now render markdown bodies directly from Directus content_format=markdown.
- MDX and unsupported body formats still fallback to local Astro render for stability.
- Hero images are resolved through a shared helper, supporting both local /assets files and Directus asset URLs.

## Known Gaps

- Hero image frontmatter values are still imported as strings and not converted to Directus file relations.
- MDX component semantics are preserved as raw body content; execution/rendering adaptation is still pending.
- Start and sportheim body rendering are not yet migrated to direct Directus body rendering.
