import type { ImageMetadata } from "astro";

type ImageModuleLoader = () => Promise<{ default: ImageMetadata }>;

type ImageMap = Record<string, ImageModuleLoader>;

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

function resolveDirectusPublicBase(): string | null {
  const raw = process.env.DIRECTUS_PUBLIC_URL || process.env.DIRECTUS_URL || process.env.DIRECTUS_BASE_URL;
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

export function toMetaImageUrl(heroImage?: string): string | undefined {
  if (!heroImage) {
    return undefined;
  }

  if (/^https?:\/\//i.test(heroImage)) {
    return heroImage;
  }

  if (heroImage.startsWith("/assets/")) {
    const base = resolveDirectusPublicBase();
    if (base) {
      return `${base}${heroImage}`;
    }
  }

  return heroImage;
}

export function resolveHeroImage(heroImage: string | undefined, images: ImageMap): HeroImageResolution {
  if (!heroImage) {
    return { kind: "none" };
  }

  if (/^https?:\/\//i.test(heroImage)) {
    return { kind: "remote", src: heroImage };
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
    src: remoteFallback || heroImage,
  };
}
