import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { ContentEntry } from "./content-source";
import { toAbsoluteDirectusAssetUrl, toAvifDirectusAssetUrl } from "./hero-image";

type RenderableDirectusEntry = ContentEntry<"veranstaltungen" | "berichte" | "start" | "sportheim">;

let markdownProcessorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

function getMarkdownProcessor() {
  markdownProcessorPromise ??= createMarkdownProcessor();
  return markdownProcessorPromise;
}

export function canRenderDirectusMarkdown(
  entry: RenderableDirectusEntry,
): boolean {
  return (
    entry.source === "directus" &&
    entry.contentFormat === "markdown" &&
    typeof entry.body === "string" &&
    entry.body.length > 0
  );
}

export function canRenderDirectusBody(
  entry: RenderableDirectusEntry,
): boolean {
  if (entry.source !== "directus") {
    return false;
  }

  if (typeof entry.body !== "string" || entry.body.length === 0) {
    return false;
  }

  if (!entry.contentFormat) {
    return true;
  }

  return entry.contentFormat === "markdown" || entry.contentFormat === "html";
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const processor = await getMarkdownProcessor();
  const rendered = await processor.render(markdown, {});
  return rendered.code;
}

function rewriteDirectusAssetLinks(html: string): string {
  // 1. Rewrite <img> tags to be fully responsive
  const withResponsiveImages = html.replace(/<img\b([^>]*)\bsrc=(["'])([^"'\s>]+)\2([^>]*)/gi, (fullMatch, beforeSrc, quote, rawUrl, afterSrc) => {
    if (typeof rawUrl !== "string") {
      return fullMatch;
    }

    const avifUrlBase = toAvifDirectusAssetUrl(rawUrl);
    try {
      const parsed = new URL(avifUrlBase);
      // Remove any existing width parameters from the base URL
      parsed.searchParams.delete("width");
      const baseWithAvif = parsed.toString();

      // Construct srcset for different widths
      const srcset = `${baseWithAvif}&width=400 400w, ${baseWithAvif}&width=800 800w, ${baseWithAvif}&width=1200 1200w`;
      
      // Default src is 800px width
      parsed.searchParams.set("width", "800");
      const defaultSrc = parsed.toString();

      // Return rewritten <img> tag
      return `<img${beforeSrc}src=${quote}${defaultSrc}${quote} srcset=${quote}${srcset}${quote} sizes=${quote}(max-width: 768px) 100vw, 800px${quote}${afterSrc}`;
    } catch {
      return `src=${quote}${avifUrlBase}${quote}`;
    }
  });

  // 2. Rewrite remaining href links
  const withRewrittenLinks = withResponsiveImages.replace(/\bhref=(["'])([^"']+)\1/gi, (fullMatch, quote, rawUrl) => {
    if (typeof rawUrl !== "string") {
      return fullMatch;
    }

    const rewritten = toAbsoluteDirectusAssetUrl(rawUrl);
    return `href=${quote}${rewritten}${quote}`;
  });

  return withRewrittenLinks;
}

export async function renderDirectusBodyToHtml(
  entry: RenderableDirectusEntry,
): Promise<string | null> {
  if (!canRenderDirectusBody(entry)) {
    return null;
  }

  if (entry.contentFormat === "markdown") {
    const rendered = await renderMarkdownToHtml(entry.body || "");
    return rewriteDirectusAssetLinks(rendered);
  }

  return rewriteDirectusAssetLinks(entry.body || "");
}
