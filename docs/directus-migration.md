# Directus Migration Commands

This project now includes migration scripts to provision Directus schema and import Astro content.

## Required Environment Variables

- DIRECTUS_URL
  - Preferred base URL variable.
  - Supports MCP endpoint URL (for example: <https://cms.dart.ingomc.de/mcp>).
  - The scripts automatically try both API roots:
    - with /directus prefix
    - without /directus prefix
- DIRECTUS_BASE_URL
  - Alias to DIRECTUS_URL.
- DIRECTUS_PUBLIC_URL
  - Optional shared base URL used for runtime asset URLs.
- MCP
  - If this value is an http(s) URL, it is used as Directus base URL fallback.
- DIRECTUS_TOKEN
  - Preferred token variable.
- ADMIN_EXPORT_TOKEN
  - Token fallback commonly used in this project.
- MCP_TOKEN
  - Optional explicit token variable.
- DIRECTUS_API_URL (optional)
  - Force a specific Directus REST API root if auto-detection is not correct.
- CONTENT_SOURCE (optional)
  - Controls read-path behavior for migrated pages.
  - Values:
    - directus (default): use Directus as primary source for migrated collections.
    - auto: try Directus, fallback to Astro content on failure.
    - astro: force local Astro content.

## Commands

- npm run directus:provision
  - Create missing collections and fields from scripts/directus/schema.mjs.
- npm run directus:provision:sync
  - Also patches existing collection/field metadata.
  - Required when updating editor interfaces/visibility (for example body WYSIWYG, legacy field hiding).
- npm run directus:import:dry
  - Dry-run import from src/content into Directus.
  - Reads existing records and reports create/update counts.
- npm run directus:import
  - Applies upserts to Directus.
- npm run directus:import:assets:dry
  - Dry-run import plus relative body-image rewrite simulation.
- npm run directus:import:assets
  - Apply import plus relative body-image upload and markdown rewrite.
- npm run directus:seed:dry
  - Dry-run seed/backfill mode that does not overwrite existing Directus items.
- npm run directus:seed
  - Apply seed/backfill mode without overwriting existing Directus items.
- npm run directus:seed:assets:dry
  - Dry-run seed/backfill mode with body-image rewrite enabled.
- npm run directus:seed:assets
  - Apply seed/backfill mode with body-image rewrite and no-overwrite behavior.
- npm run directus:cleanup:dry
  - Dry-run check of local src/content markdown files against Directus slug parity.
- npm run directus:cleanup
  - Deletes local src/content markdown/mdx files only when matching Directus slug exists.
- npm run guard:content
  - Fails when editorial files under src/content are changed in the current branch.
- npm run guard:content:staged
  - Same guard for staged changes only (pre-commit friendly).

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
- Supports no-overwrite mode (--no-overwrite-existing) for CMS-only operation after initial migration.
- Backfills hero_image_file relation by mapping Directus asset IDs or uploading local hero assets when possible.

Read-path behavior (implemented):

- Migrated list/feed/detail metadata reads via adapter in src/lib/content-source.ts.
- Start and sportheim pages now read and render markdown bodies through the adapter path.
- Detail pages now render direct Directus body content for content_format=html and content_format=markdown.
- Detail pages no longer use local Astro fallback rendering.
- Hero images are resolved through a shared helper, supporting both local /assets files and Directus asset URLs.
- Adapter mapping now prefers hero_image_file relation (Directus file) and falls back to legacy hero_image string.

## Known Gaps

- Hero backfill can upload local hero assets automatically, but external hero URLs remain external and are not converted into Directus file relations.
- MDX component semantics are preserved as raw body content; execution/rendering adaptation is still pending.

## Editor UX Notes

- body is configured as a rich text HTML editor field for CMS authoring.
- hero_image_file is provisioned with a file-image interface and explicit relation target to directus_files.
- hero_image (legacy string path) stays hidden in forms and is only used as temporary migration fallback.

## CMS-Only Operating Rules

- Editorial content is maintained in Directus.
- Repository content files under src/content should not be edited for daily content updates.
- Use guard:content in CI (and optionally guard:content:staged locally) to prevent accidental content edits.
- Use directus:seed* commands for one-time seeding/backfills without overwriting CMS-managed records.
- Use directus:cleanup* to retire local content files after parity checks.
