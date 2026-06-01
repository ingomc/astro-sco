import type { ImageMetadata } from "astro";

type ImageModuleLoader = () => Promise<{ default: ImageMetadata }>;

type ImageMap = Record<string, ImageModuleLoader>;

const DIRECTUS_FILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DirectusAssetTransform = {
  width?: number;
  height?: number;
  quality?: number;
  fit?: "cover" | "contain" | "inside" | "outside";
};

export type HeroImageResolution =
  | { kind: "none" }
  | { kind: "local"; loader: ImageModuleLoader }
  | { kind: "remote"; src: string };

function ensureTrailingSlash(urlString: string): string {
  const parsed = new URL(urlString);
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}

export function resolveDirectusPublicBase(): string | null {
  const raw = import.meta.env.DIRECTUS_PUBLIC_URL
    || import.meta.env.DIRECTUS_URL
    || import.meta.env.DIRECTUS_BASE_URL
    || import.meta.env.MCP
    || process.env.DIRECTUS_PUBLIC_URL
    || process.env.DIRECTUS_URL
    || process.env.DIRECTUS_BASE_URL
    || process.env.MCP;
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname.endsWith("/mcp")) {
      parsed.pathname = `${parsed.pathname.slice(0, -4)}/`;
    }
    if (parsed.pathname.endsWith("/directus/")) {
      parsed.pathname = parsed.pathname.slice(0, -9) || "/";
    }

    return ensureTrailingSlash(parsed.toString()).slice(0, -1);
  } catch {
    return null;
  }
}

export function isDirectusAssetPath(path: string): boolean {
  if (!path.startsWith("/assets/")) {
    return false;
  }

  const fileId = path.slice("/assets/".length).split(/[/?#]/)[0];
  return DIRECTUS_FILE_ID_RE.test(fileId);
}

function resolveDirectusAssetUrl(path: string): URL | null {
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      return isDirectusAssetPath(parsed.pathname) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (!isDirectusAssetPath(path)) {
    return null;
  }

  const base = resolveDirectusPublicBase();
  if (!base) {
    return null;
  }

  try {
    return new URL(path, `${base}/`);
  } catch {
    return null;
  }
}

export function toAbsoluteDirectusAssetUrl(path: string): string {
  const directusAssetUrl = resolveDirectusAssetUrl(path);
  return directusAssetUrl ? directusAssetUrl.toString() : path;
}

export function toAvifDirectusAssetUrl(path: string): string {
  const directusAssetUrl = resolveDirectusAssetUrl(path);
  if (!directusAssetUrl) {
    return path;
  }

  directusAssetUrl.searchParams.set("format", "avif");
  return directusAssetUrl.toString();
}

export function toOptimizedDirectusAssetUrl(path: string, transform: DirectusAssetTransform): string {
  const directusAssetUrl = resolveDirectusAssetUrl(path);
  if (!directusAssetUrl) {
    return path;
  }

  if (typeof transform.width === "number" && Number.isFinite(transform.width) && transform.width > 0) {
    directusAssetUrl.searchParams.set("width", String(Math.round(transform.width)));
  }

  if (typeof transform.height === "number" && Number.isFinite(transform.height) && transform.height > 0) {
    directusAssetUrl.searchParams.set("height", String(Math.round(transform.height)));
  }

  if (typeof transform.quality === "number" && Number.isFinite(transform.quality) && transform.quality > 0) {
    directusAssetUrl.searchParams.set("quality", String(Math.round(transform.quality)));
  }

  if (transform.fit) {
    directusAssetUrl.searchParams.set("fit", transform.fit);
  }

  return directusAssetUrl.toString();
}

export function toMetaImageUrl(heroImage?: string): string | undefined {
  if (!heroImage) {
    return undefined;
  }

  return toAbsoluteDirectusAssetUrl(heroImage);
}

export function resolveHeroImage(heroImage: string | undefined, images: ImageMap): HeroImageResolution {
  if (!heroImage) {
    return { kind: "none" };
  }

  if (/^https?:\/\//i.test(heroImage)) {
    return { kind: "remote", src: toAvifDirectusAssetUrl(heroImage) };
  }

  const localKey = heroImage.startsWith("/") ? `/public${heroImage}` : heroImage;
  const loader = images[localKey];
  if (loader) {
    return {
      kind: "local",
      loader,
    };
  }

  const remoteFallback = toMetaImageUrl(heroImage);
  return {
    kind: "remote",
    src: toAvifDirectusAssetUrl(remoteFallback || heroImage),
  };
}
