import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import { directusRequest, getAssetPathForFileId, getDirectusBaseUrl } from "./client.mjs";

const args = process.argv.slice(2);
const applyChanges = args.includes("--apply");
const dryRun = args.includes("--dry-run") || !applyChanges;
const rewriteAssets = args.includes("--rewrite-assets");

function getArgValue(name) {
  const entry = args.find((arg) => arg.startsWith(`${name}=`));
  if (!entry) {
    return undefined;
  }
  return entry.slice(name.length + 1);
}

const collectionFilterArg = getArgValue("--collections") || getArgValue("--collection");
const selectedCollections = collectionFilterArg
  ? new Set(collectionFilterArg.split(",").map((item) => item.trim()).filter(Boolean))
  : null;

const workspaceRoot = process.cwd();
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function ensureString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function ensureOptionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value);
}

function ensureBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
}

function ensureDate(value, fieldName, sourcePath) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Invalid date in ${sourcePath}: ${fieldName}=${String(value)}`);
  }
  return parsed.toISOString();
}

function ensureStringArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [String(value)];
}

function toSlug(relativePath) {
  return normalizePath(relativePath).replace(/\.(md|mdx)$/i, "");
}

function isRelativeAssetRef(ref) {
  if (!ref) {
    return false;
  }

  const normalized = ref.trim();
  return (
    !normalized.startsWith("http://") &&
    !normalized.startsWith("https://") &&
    !normalized.startsWith("/") &&
    !normalized.startsWith("#")
  );
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function stripQueryAndHash(ref) {
  const index = ref.search(/[?#]/);
  return index === -1 ? ref : ref.slice(0, index);
}

function normalizeImageUrlToken(token) {
  if (token.startsWith("<") && token.endsWith(">")) {
    return token.slice(1, -1);
  }
  return token;
}

function extractDirectusFileId(value) {
  const normalized = ensureOptionalString(value);
  if (!normalized) {
    return null;
  }

  if (UUID_V4_REGEX.test(normalized)) {
    return normalized;
  }

  const pathMatch = /\/assets\/([^/?#]+)/i.exec(normalized);
  if (!pathMatch) {
    return null;
  }

  const candidate = pathMatch[1];
  return UUID_V4_REGEX.test(candidate) ? candidate : null;
}

function parseMarkdownImageTarget(target) {
  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\S+)([\s\S]*)$/);
  if (!match) {
    return null;
  }

  return {
    urlToken: match[1],
    suffix: match[2] || "",
  };
}

function inferMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function buildAssetTitle(sourcePath, absoluteAssetPath) {
  const relativeAssetPath = normalizePath(path.relative(workspaceRoot, absoluteAssetPath));
  return `import:${sourcePath}:${relativeAssetPath}`;
}

async function findExistingAssetByTitle(assetTitle) {
  const matches = await directusRequest("/files", {
    query: {
      fields: ["id", "title"],
      limit: 1,
      filter: {
        title: {
          _eq: assetTitle,
        },
      },
    },
  });

  return Array.isArray(matches) && matches.length > 0 ? matches[0] : null;
}

async function uploadAssetFile(absoluteAssetPath, assetTitle) {
  const fileBuffer = await fs.readFile(absoluteAssetPath);
  const mimeType = inferMimeType(absoluteAssetPath);
  const fileName = path.basename(absoluteAssetPath);

  const form = new FormData();
  form.append("title", assetTitle);
  form.append("filename_download", fileName);
  form.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);

  return directusRequest("/files", {
    method: "POST",
    body: form,
    contentType: "form",
  });
}

async function ensureAssetForRelativeRef(options) {
  const {
    sourceFilePath,
    sourcePath,
    relativeRef,
    counters,
    warnings,
    assetCache,
  } = options;

  const normalizedRef = normalizeImageUrlToken(relativeRef);
  const refWithoutQuery = stripQueryAndHash(normalizedRef);
  const absoluteAssetPath = path.resolve(path.dirname(sourceFilePath), refWithoutQuery);
  const cacheKey = normalizePath(absoluteAssetPath);

  if (assetCache.has(cacheKey)) {
    counters.assetsCached += 1;
    return assetCache.get(cacheKey);
  }

  if (!(await fileExists(absoluteAssetPath))) {
    warnings.push(`missing relative body asset in ${sourcePath}: ${relativeRef}`);
    counters.assetsMissing += 1;
    assetCache.set(cacheKey, null);
    return null;
  }

  if (dryRun) {
    const dryRunPath = `/assets/DRYRUN-${path.basename(absoluteAssetPath)}`;
    counters.assetsPlannedUpload += 1;
    assetCache.set(cacheKey, dryRunPath);
    return dryRunPath;
  }

  const assetTitle = buildAssetTitle(sourcePath, absoluteAssetPath);
  const existing = await findExistingAssetByTitle(assetTitle);
  if (existing?.id) {
    const existingPath = getAssetPathForFileId(existing.id);
    counters.assetsReused += 1;
    assetCache.set(cacheKey, existingPath);
    return existingPath;
  }

  const uploaded = await uploadAssetFile(absoluteAssetPath, assetTitle);
  if (!uploaded?.id) {
    warnings.push(`asset upload returned no id for ${sourcePath}: ${relativeRef}`);
    counters.assetsMissing += 1;
    assetCache.set(cacheKey, null);
    return null;
  }

  const uploadedPath = getAssetPathForFileId(uploaded.id);
  counters.assetsUploaded += 1;
  assetCache.set(cacheKey, uploadedPath);
  return uploadedPath;
}

async function rewriteBodyAssetReferences(options) {
  const {
    body,
    sourceFilePath,
    sourcePath,
    counters,
    warnings,
    assetCache,
  } = options;

  const regex = /(!\[[^\]]*\]\()([^)]+)(\))/g;
  let rewrittenBody = "";
  let cursor = 0;
  let match = regex.exec(body);

  while (match) {
    rewrittenBody += body.slice(cursor, match.index);

    const parsedTarget = parseMarkdownImageTarget(match[2]);
    let replacement = match[0];

    if (parsedTarget && isRelativeAssetRef(parsedTarget.urlToken)) {
      counters.relativeBodyRefs += 1;

      if (rewriteAssets) {
        const assetPath = await ensureAssetForRelativeRef({
          sourceFilePath,
          sourcePath,
          relativeRef: parsedTarget.urlToken,
          counters,
          warnings,
          assetCache,
        });

        if (assetPath) {
          replacement = `${match[1]}${assetPath}${parsedTarget.suffix}${match[3]}`;
          counters.bodyRefsRewritten += 1;
        }
      } else {
        warnings.push(`relative body asset in ${sourcePath}: ${parsedTarget.urlToken}`);
      }
    }

    rewrittenBody += replacement;
    cursor = regex.lastIndex;
    match = regex.exec(body);
  }

  rewrittenBody += body.slice(cursor);
  return rewrittenBody;
}

function createCommonPayload(filePath, frontmatter, body, extension) {
  const relativeFilePath = normalizePath(path.relative(workspaceRoot, filePath));
  const extensionFormat = extension.toLowerCase() === ".mdx" ? "mdx" : "markdown";

  return {
    slug: toSlug(path.relative(path.join(workspaceRoot, "src", "content", frontmatter.__collection), filePath)),
    body,
    content_format: extensionFormat,
    source_path: relativeFilePath,
  };
}

const collectionConfig = [
  {
    name: "veranstaltungen",
    pattern: "src/content/veranstaltungen/**/*.{md,mdx}",
    transform: (filePath, parsed) => {
      const extension = path.extname(filePath);
      const fm = {
        ...parsed.data,
        __collection: "veranstaltungen",
      };

      const heroImage = ensureOptionalString(fm.heroImage);
      const heroImageFileId = extractDirectusFileId(heroImage);
      const heroImageAlt = ensureOptionalString(fm.heroImageAlt);

      const payload = {
        ...createCommonPayload(filePath, fm, parsed.content, extension),
        title: ensureString(fm.title),
        description: ensureString(fm.description),
        pub_date: ensureDate(fm.pubDate, "pubDate", filePath),
        event_date: ensureDate(fm.eventDate, "eventDate", filePath),
        location: ensureOptionalString(fm.location),
        hero_image: heroImage,
        cta: ensureOptionalString(fm.cta),
        featured: ensureBoolean(fm.featured, false),
        hidden: ensureBoolean(fm.hidden, false),
        tags: ensureStringArray(fm.tags),
      };

      if (heroImageFileId) {
        payload.hero_image_file = heroImageFileId;
      }

      if (heroImageAlt) {
        payload.hero_image_alt = heroImageAlt;
      }

      return payload;
    },
  },
  {
    name: "berichte",
    pattern: "src/content/berichte/**/*.{md,mdx}",
    transform: (filePath, parsed) => {
      const extension = path.extname(filePath);
      const fm = {
        ...parsed.data,
        __collection: "berichte",
      };

      const heroImage = ensureOptionalString(fm.heroImage);
      const heroImageFileId = extractDirectusFileId(heroImage);
      const heroImageAlt = ensureOptionalString(fm.heroImageAlt);

      const payload = {
        ...createCommonPayload(filePath, fm, parsed.content, extension),
        title: ensureString(fm.title),
        description: ensureOptionalString(fm.description),
        pub_date: ensureDate(fm.pubDate, "pubDate", filePath),
        event_date: ensureDate(fm.eventDate, "eventDate", filePath),
        location: ensureOptionalString(fm.location),
        hero_image: heroImage,
        hidden: ensureBoolean(fm.hidden, false),
        tags: ensureStringArray(fm.tags),
      };

      if (heroImageFileId) {
        payload.hero_image_file = heroImageFileId;
      }

      if (heroImageAlt) {
        payload.hero_image_alt = heroImageAlt;
      }

      return payload;
    },
  },
  {
    name: "mitglieder",
    pattern: "src/content/mitglieder/**/*.{md,mdx}",
    transform: (filePath, parsed) => {
      const extension = path.extname(filePath);
      const fm = {
        ...parsed.data,
        __collection: "mitglieder",
      };
      return {
        ...createCommonPayload(filePath, fm, parsed.content, extension),
        name: ensureString(fm.name),
        position: ensureOptionalString(fm.position),
        stammtisch: ensureBoolean(fm.stammtisch, false),
        dart: ensureBoolean(fm.dart, false),
        email: ensureOptionalString(fm.email),
        authorimage: ensureOptionalString(fm.authorimage),
      };
    },
  },
  {
    name: "start",
    pattern: "src/content/start/**/*.{md,mdx}",
    transform: (filePath, parsed) => {
      const extension = path.extname(filePath);
      const fm = {
        ...parsed.data,
        __collection: "start",
      };
      return {
        ...createCommonPayload(filePath, fm, parsed.content, extension),
        title: ensureString(fm.title),
        order: Number(fm.order),
      };
    },
  },
  {
    name: "sportheim",
    pattern: "src/content/sportheim/**/*.{md,mdx}",
    transform: (filePath, parsed) => {
      const extension = path.extname(filePath);
      const fm = {
        ...parsed.data,
        __collection: "sportheim",
      };
      return {
        ...createCommonPayload(filePath, fm, parsed.content, extension),
        title: ensureString(fm.title),
        order: fm.order === undefined || fm.order === null ? null : Number(fm.order),
        legacy_id: ensureOptionalString(fm.id),
      };
    },
  },
];

async function upsertBySlug(collectionName, payload, counters) {
  const matches = await directusRequest(`/items/${collectionName}`, {
    query: {
      fields: ["id", "slug"],
      limit: 1,
      filter: {
        slug: {
          _eq: payload.slug,
        },
      },
    },
  });

  const existing = Array.isArray(matches) && matches.length > 0 ? matches[0] : null;

  if (!existing) {
    if (!dryRun) {
      await directusRequest(`/items/${collectionName}`, {
        method: "POST",
        body: payload,
      });
    }
    counters.created += 1;
    return;
  }

  if (!dryRun) {
    await directusRequest(`/items/${collectionName}/${existing.id}`, {
      method: "PATCH",
      body: payload,
    });
  }
  counters.updated += 1;
}

function validatePayload(collectionName, payload, filePath) {
  const issues = [];

  if (!payload.slug) {
    issues.push("missing slug");
  }

  if (collectionName === "start" && !Number.isFinite(payload.order)) {
    issues.push("invalid numeric order");
  }

  return issues.map((issue) => `${filePath}: ${issue}`);
}

async function importCollection(config, counters, warnings, assetCache) {
  const filePaths = await fg(config.pattern, {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
  });

  for (const filePath of filePaths) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = matter(raw);

    let payload;
    try {
      payload = config.transform(filePath, parsed);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      warnings.push(`transform failed: ${text}`);
      counters.skipped += 1;
      continue;
    }

    const payloadIssues = validatePayload(config.name, payload, normalizePath(path.relative(workspaceRoot, filePath)));
    if (payloadIssues.length > 0) {
      warnings.push(...payloadIssues);
      counters.skipped += 1;
      continue;
    }

    payload.body = await rewriteBodyAssetReferences({
      body: payload.body,
      sourceFilePath: filePath,
      sourcePath: payload.source_path,
      counters,
      warnings,
      assetCache,
    });

    await upsertBySlug(config.name, payload, counters);
  }
}

async function importSettings(counters, warnings) {
  const settingsPath = path.join(workspaceRoot, "src", "content", "settings", "settings.json");
  const raw = await fs.readFile(settingsPath, "utf8");
  const parsed = JSON.parse(raw);

  const payload = {
    site_title: ensureString(parsed.site_title),
    posts_front_limit: Number(parsed.posts?.front_limit),
    posts_author: ensureString(parsed.posts?.author),
    posts_thumb: ensureString(parsed.posts?.thumb),
  };

  if (!Number.isFinite(payload.posts_front_limit)) {
    warnings.push("settings.json: posts.front_limit is not numeric");
    counters.settingsSkipped += 1;
    return;
  }

  const existing = await directusRequest("/items/settings", {
    allow404: true,
  });
  const hasExisting = Array.isArray(existing)
    ? existing.length > 0
    : Boolean(existing && typeof existing === "object");

  if (!dryRun) {
    await directusRequest("/items/settings", {
      method: "PATCH",
      body: payload,
    });
  }

  if (hasExisting) {
    counters.settingsUpdated += 1;
    return;
  }

  counters.settingsCreated += 1;
}

async function main() {
  const counters = {
    created: 0,
    updated: 0,
    skipped: 0,
    relativeBodyRefs: 0,
    bodyRefsRewritten: 0,
    assetsPlannedUpload: 0,
    assetsUploaded: 0,
    assetsReused: 0,
    assetsCached: 0,
    assetsMissing: 0,
    settingsCreated: 0,
    settingsUpdated: 0,
    settingsSkipped: 0,
  };
  const warnings = [];
  const assetCache = new Map();

  console.log(`Importing content to ${getDirectusBaseUrl()}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Asset rewrite: ${rewriteAssets ? "enabled" : "disabled"}`);

  for (const config of collectionConfig) {
    if (selectedCollections && !selectedCollections.has(config.name)) {
      continue;
    }

    console.log(`\nCollection: ${config.name}`);
    await importCollection(config, counters, warnings, assetCache);
  }

  if (!selectedCollections || selectedCollections.has("settings")) {
    console.log("\nCollection: settings");
    await importSettings(counters, warnings);
  }

  console.log("\nImport summary:");
  console.log(JSON.stringify(counters, null, 2));

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

try {
  await main();
} catch (error) {
  console.error("Content import failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
