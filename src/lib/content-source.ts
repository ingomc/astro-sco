import { getCollection } from "astro:content";

type SourceMode = "astro" | "directus" | "auto";

export type SupportedCollection = "veranstaltungen" | "berichte" | "mitglieder";

type VeranstaltungData = {
  title: string;
  description: string;
  pubDate: Date;
  eventDate: Date;
  location?: string;
  heroImage: string;
  cta?: string;
  featured: boolean;
  hidden: boolean;
  tags: string[];
};

type BerichtData = {
  title: string;
  description?: string;
  pubDate: Date;
  eventDate: Date;
  location?: string;
  heroImage: string;
  hidden: boolean;
  tags: string[];
};

type MitgliederData = {
  name: string;
  position?: string;
  stammtisch: boolean;
  dart: boolean;
  email?: string;
  authorimage?: string;
};

type EntryDataByCollection = {
  veranstaltungen: VeranstaltungData;
  berichte: BerichtData;
  mitglieder: MitgliederData;
};

export type ContentEntry<K extends SupportedCollection = SupportedCollection> = {
  slug: string;
  collection: K;
  data: EntryDataByCollection[K];
  source: "astro" | "directus";
  body?: string;
  contentFormat?: string;
  sourcePath?: string;
};

type DirectusConfig = {
  apiBaseUrls: string[];
  token: string;
};

const warnedMessages = new Set<string>();

function warnOnce(message: string) {
  if (warnedMessages.has(message)) {
    return;
  }
  warnedMessages.add(message);
  console.warn(`[content-source] ${message}`);
}

function getSourceMode(): SourceMode {
  const rawMode = (process.env.CONTENT_SOURCE || "auto").toLowerCase();
  if (rawMode === "astro" || rawMode === "directus" || rawMode === "auto") {
    return rawMode;
  }

  warnOnce(`Unknown CONTENT_SOURCE='${rawMode}', falling back to 'auto'.`);
  return "auto";
}

function ensureTrailingSlash(urlString: string): string {
  const parsed = new URL(urlString);
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function resolveApiBaseUrls(rawBaseUrl: string, explicitApiUrl?: string): string[] {
  if (explicitApiUrl) {
    return [ensureTrailingSlash(explicitApiUrl)];
  }

  const parsed = new URL(rawBaseUrl);
  if (parsed.pathname.endsWith("/mcp")) {
    const withoutMcp = new URL(parsed.toString());
    withoutMcp.pathname = `${withoutMcp.pathname.slice(0, -4)}/`;

    const withDirectusPrefix = new URL(withoutMcp.toString());
    withDirectusPrefix.pathname = `${withDirectusPrefix.pathname}directus/`;

    return unique([
      withDirectusPrefix.toString(),
      withoutMcp.toString(),
    ]);
  }

  return [ensureTrailingSlash(parsed.toString())];
}

function getDirectusConfig(): DirectusConfig | null {
  const rawBaseUrl = process.env.DIRECTUS_URL || process.env.DIRECTUS_BASE_URL;
  const token = process.env.DIRECTUS_TOKEN || process.env.MCP;
  const explicitApiUrl = process.env.DIRECTUS_API_URL;

  if (!rawBaseUrl || !token) {
    return null;
  }

  return {
    apiBaseUrls: resolveApiBaseUrls(rawBaseUrl, explicitApiUrl),
    token,
  };
}

function appendQueryParams(searchParams: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryParams(searchParams, `${key}[]`, item);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      appendQueryParams(searchParams, `${key}[${nestedKey}]`, nestedValue);
    }
    return;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    searchParams.append(key, String(value));
    return;
  }

  throw new TypeError(`Unsupported query param type for '${key}'`);
}

function shouldRetryWithFallback(response: Response, text: string, hasFallback: boolean): boolean {
  return hasFallback && response.status === 404 && text.includes("ROUTE_NOT_FOUND");
}

async function directusGet(pathname: string, query: Record<string, unknown>, config: DirectusConfig): Promise<unknown> {
  for (let i = 0; i < config.apiBaseUrls.length; i += 1) {
    const baseUrl = config.apiBaseUrls[i];
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const url = new URL(normalizedPath.slice(1), baseUrl);

    for (const [key, value] of Object.entries(query)) {
      appendQueryParams(url.searchParams, key, value);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    });

    const hasFallback = i < config.apiBaseUrls.length - 1;

    if (!response.ok) {
      const text = await response.text();
      if (shouldRetryWithFallback(response, text, hasFallback)) {
        continue;
      }
      throw new Error(`Directus GET ${pathname} failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    return payload?.data ?? payload;
  }

  throw new Error(`Directus GET ${pathname} failed: no reachable API base URL.`);
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function describeUnknownValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return "[non-primitive]";
}

function toRequiredString(value: unknown, field: string, collection: SupportedCollection, slug: string): string {
  const result = toStringOrUndefined(value);
  if (!result) {
    throw new TypeError(`Missing required field '${field}' in ${collection}/${slug}`);
  }
  return result;
}

function toDate(value: unknown, field: string, collection: SupportedCollection, slug: string): Date {
  const parsed = new Date(value as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Invalid date field '${field}' in ${collection}/${slug}: ${describeUnknownValue(value)}`);
  }
  return parsed;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
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
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }
        return null;
      })
      .filter((item): item is string => item !== null);
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const primitive = toStringOrUndefined(value);
  return primitive ? [primitive] : [];
}

function mapDirectusItem<K extends SupportedCollection>(
  collection: K,
  item: Record<string, unknown>,
): ContentEntry<K> | null {
  const slug = toStringOrUndefined(item.slug);
  if (!slug) {
    return null;
  }

  if (collection === "veranstaltungen") {
    const mapped: ContentEntry<"veranstaltungen"> = {
      slug,
      collection,
      source: "directus",
      body: toStringOrUndefined(item.body),
      contentFormat: toStringOrUndefined(item.content_format),
      sourcePath: toStringOrUndefined(item.source_path),
      data: {
        title: toRequiredString(item.title, "title", collection, slug),
        description: toRequiredString(item.description, "description", collection, slug),
        pubDate: toDate(item.pub_date, "pub_date", collection, slug),
        eventDate: toDate(item.event_date, "event_date", collection, slug),
        location: toStringOrUndefined(item.location),
        heroImage: toRequiredString(item.hero_image, "hero_image", collection, slug),
        cta: toStringOrUndefined(item.cta),
        featured: toBoolean(item.featured, false),
        hidden: toBoolean(item.hidden, false),
        tags: toStringArray(item.tags),
      },
    };
    return mapped as ContentEntry<K>;
  }

  if (collection === "berichte") {
    const mapped: ContentEntry<"berichte"> = {
      slug,
      collection,
      source: "directus",
      body: toStringOrUndefined(item.body),
      contentFormat: toStringOrUndefined(item.content_format),
      sourcePath: toStringOrUndefined(item.source_path),
      data: {
        title: toRequiredString(item.title, "title", collection, slug),
        description: toStringOrUndefined(item.description),
        pubDate: toDate(item.pub_date, "pub_date", collection, slug),
        eventDate: toDate(item.event_date, "event_date", collection, slug),
        location: toStringOrUndefined(item.location),
        heroImage: toRequiredString(item.hero_image, "hero_image", collection, slug),
        hidden: toBoolean(item.hidden, false),
        tags: toStringArray(item.tags),
      },
    };
    return mapped as ContentEntry<K>;
  }

  const mapped: ContentEntry<"mitglieder"> = {
    slug,
    collection: "mitglieder",
    source: "directus",
    body: toStringOrUndefined(item.body),
    contentFormat: toStringOrUndefined(item.content_format),
    sourcePath: toStringOrUndefined(item.source_path),
    data: {
      name: toRequiredString(item.name, "name", "mitglieder", slug),
      position: toStringOrUndefined(item.position),
      stammtisch: toBoolean(item.stammtisch, false),
      dart: toBoolean(item.dart, false),
      email: toStringOrUndefined(item.email),
      authorimage: toStringOrUndefined(item.authorimage),
    },
  };
  return mapped as ContentEntry<K>;
}

async function loadCollectionFromDirectus<K extends SupportedCollection>(collection: K): Promise<ContentEntry<K>[]> {
  const config = getDirectusConfig();
  if (!config) {
    throw new Error("DIRECTUS_URL (or DIRECTUS_BASE_URL) and token are required for directus mode.");
  }

  const raw = await directusGet(`/items/${collection}`, {
    fields: ["*"],
    limit: -1,
  }, config);

  if (!Array.isArray(raw)) {
    return [];
  }

  const mapped: ContentEntry<K>[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    try {
      const normalized = mapDirectusItem(collection, item as Record<string, unknown>);
      if (normalized) {
        mapped.push(normalized);
      }
    } catch (error) {
      warnOnce(error instanceof Error ? error.message : String(error));
    }
  }

  return mapped;
}

async function loadCollectionFromAstro<K extends SupportedCollection>(collection: K): Promise<ContentEntry<K>[]> {
  if (collection === "veranstaltungen") {
    const entries = await getCollection("veranstaltungen");
    return entries.map((entry) => ({
      slug: entry.slug,
      collection,
      source: "astro",
      data: {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: new Date(entry.data.pubDate),
        eventDate: new Date(entry.data.eventDate),
        location: entry.data.location,
        heroImage: entry.data.heroImage || "",
        cta: entry.data.cta,
        featured: Boolean(entry.data.featured),
        hidden: Boolean(entry.data.hidden),
        tags: entry.data.tags ?? [],
      },
    })) as ContentEntry<K>[];
  }

  if (collection === "berichte") {
    const entries = await getCollection("berichte");
    return entries.map((entry) => ({
      slug: entry.slug,
      collection,
      source: "astro",
      data: {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: new Date(entry.data.pubDate),
        eventDate: new Date(entry.data.eventDate),
        location: entry.data.location,
        heroImage: entry.data.heroImage || "",
        hidden: Boolean(entry.data.hidden),
        tags: entry.data.tags ?? [],
      },
    })) as ContentEntry<K>[];
  }

  const entries = await getCollection("mitglieder");
  return entries.map((entry) => ({
    slug: entry.slug,
    collection,
    source: "astro",
    data: {
      name: entry.data.name,
      position: entry.data.position,
      stammtisch: Boolean(entry.data.stammtisch),
      dart: Boolean(entry.data.dart),
      email: entry.data.email,
      authorimage: entry.data.authorimage,
    },
  })) as ContentEntry<K>[];
}

export async function getContentCollection<K extends SupportedCollection>(collection: K): Promise<ContentEntry<K>[]> {
  const sourceMode = getSourceMode();

  if (sourceMode === "astro") {
    return loadCollectionFromAstro(collection);
  }

  if (sourceMode === "directus") {
    return loadCollectionFromDirectus(collection);
  }

  try {
    return await loadCollectionFromDirectus(collection);
  } catch (error) {
    warnOnce(`Directus unavailable for '${collection}', falling back to astro: ${error instanceof Error ? error.message : String(error)}`);
    return loadCollectionFromAstro(collection);
  }
}
