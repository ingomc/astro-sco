import { getCollection, getEntry } from "astro:content";
import { toAbsoluteDirectusAssetUrl } from "./hero-image";

type SourceMode = "astro" | "directus" | "auto";

export type SupportedCollection = "veranstaltungen" | "berichte" | "mitglieder" | "start" | "sportheim";

type VeranstaltungData = {
  title: string;
  description: string;
  pubDate: Date;
  eventDate: Date;
  location?: string;
  heroImage?: string;
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
  heroImage?: string;
  hidden: boolean;
  tags: string[];
  mapLocations?: { name: string; lat: number; lon: number; type?: string; osmUrl?: string; description?: string }[];
  mapZoom?: number;
  mapHeight?: string;
  galleryImages?: { src: string; alt: string }[];
  galleryColumns?: 2 | 3 | 4;
};

type MitgliederData = {
  name: string;
  position?: string;
  stammtisch: boolean;
  dart: boolean;
  email?: string;
  authorimage?: string;
};

type StartData = {
  title: string;
  order: number;
};

type SportheimData = {
  title: string;
  order?: number;
  legacyId?: string;
};

type EntryDataByCollection = {
  veranstaltungen: VeranstaltungData;
  berichte: BerichtData;
  mitglieder: MitgliederData;
  start: StartData;
  sportheim: SportheimData;
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
  const rawMode = (import.meta.env.CONTENT_SOURCE || process.env.CONTENT_SOURCE || "directus").toLowerCase();
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

function isLikelyHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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

  if (parsed.pathname.endsWith("/directus") || parsed.pathname.endsWith("/directus/")) {
    const withoutDirectus = new URL(parsed.toString());
    withoutDirectus.pathname = withoutDirectus.pathname.replace(/\/directus\/?$/, "/");

    return unique([
      ensureTrailingSlash(parsed.toString()),
      ensureTrailingSlash(withoutDirectus.toString()),
    ]);
  }

  return [ensureTrailingSlash(parsed.toString())];
}

function getDirectusConfig(): DirectusConfig | null {
  const mcpValue = import.meta.env.MCP || process.env.MCP;
  const mcpUrl = isLikelyHttpUrl(mcpValue) ? mcpValue : undefined;
  const mcpToken = mcpValue && !mcpUrl ? mcpValue : undefined;

  const rawBaseUrl = import.meta.env.DIRECTUS_URL
    || import.meta.env.DIRECTUS_BASE_URL
    || import.meta.env.DIRECTUS_PUBLIC_URL
    || process.env.DIRECTUS_URL
    || process.env.DIRECTUS_BASE_URL
    || process.env.DIRECTUS_PUBLIC_URL
    || mcpUrl;

  const token = import.meta.env.DIRECTUS_TOKEN
    || import.meta.env.DIRECTUS_ACCESS_TOKEN
    || import.meta.env.MCP_TOKEN
    || process.env.DIRECTUS_TOKEN
    || process.env.DIRECTUS_ACCESS_TOKEN
    || process.env.MCP_TOKEN
    || mcpToken
    || import.meta.env.ADMIN_EXPORT_TOKEN
    || process.env.ADMIN_EXPORT_TOKEN;
  const explicitApiUrl = import.meta.env.DIRECTUS_API_URL || process.env.DIRECTUS_API_URL;

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

function toJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  return value;
}

function toMapLocations(value: unknown): BerichtData["mapLocations"] {
  const parsed = toJsonValue(value);
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const locations: NonNullable<BerichtData["mapLocations"]> = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const valueObj = item as Record<string, unknown>;
    const name = toStringOrUndefined(valueObj.name);
    const lat = toNumberOrUndefined(valueObj.lat);
    const lon = toNumberOrUndefined(valueObj.lon);

    if (!name || lat === undefined || lon === undefined) {
      continue;
    }

    locations.push({
      name,
      lat,
      lon,
      type: toStringOrUndefined(valueObj.type),
      osmUrl: toStringOrUndefined(valueObj.osmUrl),
      description: toStringOrUndefined(valueObj.description),
    });
  }

  return locations.length > 0 ? locations : undefined;
}

function toGalleryImages(value: unknown): BerichtData["galleryImages"] {
  const parsed = toJsonValue(value);
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const images: NonNullable<BerichtData["galleryImages"]> = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const valueObj = item as Record<string, unknown>;
    const src = toStringOrUndefined(valueObj.src);
    const alt = toStringOrUndefined(valueObj.alt);
    if (!src || !alt) {
      continue;
    }

    images.push({ src: toAbsoluteDirectusAssetUrl(src), alt });
  }

  return images.length > 0 ? images : undefined;
}

function toGalleryColumns(value: unknown): BerichtData["galleryColumns"] {
  const parsed = toNumberOrUndefined(value);
  if (parsed === 2 || parsed === 3 || parsed === 4) {
    return parsed;
  }
  return undefined;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function toRequiredNumber(value: unknown, field: string, collection: SupportedCollection, slug: string): number {
  const parsed = toNumberOrUndefined(value);
  if (parsed === undefined) {
    throw new TypeError(`Missing required numeric field '${field}' in ${collection}/${slug}`);
  }
  return parsed;
}

function extractDirectusFileId(value: unknown): string | undefined {
  const raw = toStringOrUndefined(value);
  if (!raw) {
    return undefined;
  }

  const directIdMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.exec(raw);
  if (directIdMatch) {
    return raw;
  }

  const pathMatch = /\/assets\/([^/?#]+)/i.exec(raw);
  const fromPath = pathMatch?.[1];
  if (fromPath && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fromPath)) {
    return fromPath;
  }

  return undefined;
}

function resolveHeroImageValue(item: Record<string, unknown>): string | undefined {
  const relationValue = item.hero_image_file;

  if (relationValue && typeof relationValue === "object") {
    const relationObject = relationValue as Record<string, unknown>;
    const relationId = extractDirectusFileId(relationObject.id);
    if (relationId) {
      return `/assets/${relationId}`;
    }
  }

  const relationId = extractDirectusFileId(relationValue);
  if (relationId) {
    return `/assets/${relationId}`;
  }

  return toStringOrUndefined(item.hero_image);
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
        description: toStringOrUndefined(item.description) || "",
        pubDate: toDate(item.pub_date, "pub_date", collection, slug),
        eventDate: toDate(item.event_date, "event_date", collection, slug),
        location: toStringOrUndefined(item.location),
        heroImage: resolveHeroImageValue(item),
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
        heroImage: resolveHeroImageValue(item),
        hidden: toBoolean(item.hidden, false),
        tags: toStringArray(item.tags),
        mapLocations: toMapLocations(item.map_locations),
        mapZoom: toNumberOrUndefined(item.map_zoom),
        mapHeight: toStringOrUndefined(item.map_height),
        galleryImages: toGalleryImages(item.gallery_images),
        galleryColumns: toGalleryColumns(item.gallery_columns),
      },
    };
    return mapped as ContentEntry<K>;
  }

  if (collection === "start") {
    const mapped: ContentEntry<"start"> = {
      slug,
      collection,
      source: "directus",
      body: toStringOrUndefined(item.body),
      contentFormat: toStringOrUndefined(item.content_format),
      sourcePath: toStringOrUndefined(item.source_path),
      data: {
        title: toRequiredString(item.title, "title", collection, slug),
        order: toRequiredNumber(item.order, "order", collection, slug),
      },
    };
    return mapped as ContentEntry<K>;
  }

  if (collection === "sportheim") {
    const mapped: ContentEntry<"sportheim"> = {
      slug,
      collection,
      source: "directus",
      body: toStringOrUndefined(item.body),
      contentFormat: toStringOrUndefined(item.content_format),
      sourcePath: toStringOrUndefined(item.source_path),
      data: {
        title: toRequiredString(item.title, "title", collection, slug),
        order: toNumberOrUndefined(item.order),
        legacyId: toStringOrUndefined(item.legacy_id),
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
    throw new Error(
      "Directus env missing. Provide URL via DIRECTUS_URL, DIRECTUS_BASE_URL, DIRECTUS_PUBLIC_URL, or MCP (URL), and token via DIRECTUS_TOKEN, ADMIN_EXPORT_TOKEN, or MCP_TOKEN.",
    );
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

  if (collection === "start") {
    const entries = await getCollection("start");
    return entries.map((entry) => ({
      slug: entry.slug,
      collection,
      source: "astro",
      body: entry.body,
      contentFormat: "markdown",
      data: {
        title: entry.data.title,
        order: Number(entry.data.order),
      },
    })) as ContentEntry<K>[];
  }

  if (collection === "sportheim") {
    const entries = await getCollection("sportheim");
    return entries.map((entry) => ({
      slug: entry.slug,
      collection,
      source: "astro",
      body: entry.body,
      contentFormat: "markdown",
      data: {
        title: entry.data.title,
        order: entry.data.order === undefined || entry.data.order === null
          ? undefined
          : Number(entry.data.order),
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

export type SiteSettings = {
  site_title: string;
  site_description?: string;
  default_og_image?: string;
  posts: {
    front_limit: number;
    author: string;
    thumb: string;
  };
  phone?: string;
  email?: string;
  address_street?: string;
  address_city?: string;
  payment_methods?: string[];
  opening_hours?: string[];
  regular_events?: { time: string; label: string }[];
  use_winter_mode: boolean;
  use_winter_stage: boolean;
  logo_normal?: string;
  logo_winter?: string;
};

async function loadSettingsFromAstro(): Promise<SiteSettings> {
  const entry = await getEntry("settings", "settings");
  if (!entry) {
    throw new Error("Local settings entry not found in content/settings/settings.json");
  }
  return {
    site_title: entry.data.site_title,
    site_description: entry.data.site_description,
    default_og_image: entry.data.default_og_image,
    posts: {
      front_limit: entry.data.posts.front_limit,
      author: entry.data.posts.author,
      thumb: entry.data.posts.thumb,
    },
    phone: entry.data.phone,
    email: entry.data.email,
    address_street: entry.data.address_street,
    address_city: entry.data.address_city,
    payment_methods: entry.data.payment_methods,
    opening_hours: entry.data.opening_hours,
    regular_events: entry.data.regular_events,
    use_winter_mode: entry.data.use_winter_mode ?? false,
    use_winter_stage: entry.data.use_winter_stage ?? false,
    logo_normal: entry.data.logo_normal,
    logo_winter: entry.data.logo_winter,
  };
}

function resolveFileValue(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const id = extractDirectusFileId(obj.id);
    if (id) {
      return `/assets/${id}`;
    }
  }

  const id = extractDirectusFileId(value);
  if (id) {
    return `/assets/${id}`;
  }

  return undefined;
}

function toRegularEvents(value: unknown): SiteSettings["regular_events"] {
  const parsed = toJsonValue(value);
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const events: NonNullable<SiteSettings["regular_events"]> = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const valueObj = item as Record<string, unknown>;
    const time = toStringOrUndefined(valueObj.time);
    const label = toStringOrUndefined(valueObj.label);

    if (time && label) {
      events.push({ time, label });
    }
  }

  return events.length > 0 ? events : undefined;
}

function toPaymentMethodsArray(value: unknown): string[] {
  const parsed = toJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => {
      if (item && typeof item === "object") {
        return toStringOrUndefined((item as Record<string, unknown>).name);
      }
      return toStringOrUndefined(item);
    })
    .filter((item): item is string => item !== undefined);
}

function toOpeningHoursArray(value: unknown): string[] {
  const parsed = toJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => {
      if (item && typeof item === "object") {
        return toStringOrUndefined((item as Record<string, unknown>).hour);
      }
      return toStringOrUndefined(item);
    })
    .filter((item): item is string => item !== undefined);
}

async function loadSettingsFromDirectus(): Promise<SiteSettings> {
  const config = getDirectusConfig();
  if (!config) {
    throw new Error("Directus env missing");
  }

  const raw = await directusGet("/items/settings", {
    fields: ["*"],
  }, config);

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid response format for Directus settings");
  }

  const item = raw as Record<string, unknown>;

  return {
    site_title: toRequiredString(item.site_title, "site_title", "settings" as any, "settings"),
    site_description: toStringOrUndefined(item.site_description),
    default_og_image: resolveFileValue(item.default_og_image),
    posts: {
      front_limit: toRequiredNumber(item.posts_front_limit, "posts_front_limit", "settings" as any, "settings"),
      author: toRequiredString(item.posts_author, "posts_author", "settings" as any, "settings"),
      thumb: toRequiredString(item.posts_thumb, "posts_thumb", "settings" as any, "settings"),
    },
    phone: toStringOrUndefined(item.phone),
    email: toStringOrUndefined(item.email),
    address_street: toStringOrUndefined(item.address_street),
    address_city: toStringOrUndefined(item.address_city),
    payment_methods: toPaymentMethodsArray(item.payment_methods),
    opening_hours: toOpeningHoursArray(item.opening_hours),
    regular_events: toRegularEvents(item.regular_events),
    use_winter_mode: toBoolean(item.use_winter_mode, false),
    use_winter_stage: toBoolean(item.use_winter_stage, false),
    logo_normal: resolveFileValue(item.logo_normal),
    logo_winter: resolveFileValue(item.logo_winter),
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const sourceMode = getSourceMode();

  if (sourceMode === "astro") {
    return loadSettingsFromAstro();
  }

  if (sourceMode === "directus") {
    return loadSettingsFromDirectus();
  }

  try {
    return await loadSettingsFromDirectus();
  } catch (error) {
    warnOnce(`Directus settings unavailable, falling back to astro: ${error instanceof Error ? error.message : String(error)}`);
    return loadSettingsFromAstro();
  }
}

export type DrinkPrice = {
  size: string;
  unit: string;
  price: string;
};

export type DrinkItem = {
  name: string;
  prices: DrinkPrice[];
};

export type DrinkCategory = {
  name: string;
  icon?: string;
  drinks: DrinkItem[];
};

async function loadDrinksFromAstro(): Promise<DrinkCategory[]> {
  const entry = await getEntry("getraenkekarte", "getraenkekarte");
  if (!entry) {
    throw new Error("Local drinks menu not found in content/getraenkekarte/getraenkekarte.json");
  }
  return entry.data as DrinkCategory[];
}

async function loadDrinksFromDirectus(): Promise<DrinkCategory[]> {
  const config = getDirectusConfig();
  if (!config) {
    throw new Error("Directus env missing");
  }

  const rawCategories = await directusGet("/items/drink_categories", {
    fields: ["*", "drinks.*"],
    sort: ["sort"],
    deep: {
      drinks: {
        _sort: ["sort"],
      },
    },
  }, config);

  if (!Array.isArray(rawCategories)) {
    throw new Error("Invalid response format for Directus drink categories");
  }

  return rawCategories.map((cat: any) => {
    const rawDrinks = Array.isArray(cat.drinks) ? cat.drinks : [];
    
    const drinks: DrinkItem[] = rawDrinks.map((drink: any) => {
      const rawPrices = toJsonValue(drink.prices);
      const prices: DrinkPrice[] = (Array.isArray(rawPrices) ? rawPrices : [])
        .map((p: any) => ({
          size: toStringOrUndefined(p?.size) || "",
          unit: toStringOrUndefined(p?.unit) || "",
          price: toStringOrUndefined(p?.price) || "",
        }))
        .filter((p) => p.size && p.unit && p.price);

      return {
        name: toStringOrUndefined(drink.name) || "",
        prices,
      };
    }).filter((d: any) => d.name);

    return {
      name: toStringOrUndefined(cat.name) || "",
      icon: toStringOrUndefined(cat.icon),
      drinks,
    };
  }).filter((c: any) => c.name);
}

export async function getDrinksMenu(): Promise<DrinkCategory[]> {
  const sourceMode = getSourceMode();

  if (sourceMode === "astro") {
    return loadDrinksFromAstro();
  }

  if (sourceMode === "directus") {
    return loadDrinksFromDirectus();
  }

  try {
    return await loadDrinksFromDirectus();
  } catch (error) {
    warnOnce(`Directus drinks menu unavailable, falling back to astro: ${error instanceof Error ? error.message : String(error)}`);
    return loadDrinksFromAstro();
  }
}
