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
  const withRewrittenSources = html.replace(/\bsrc=(["'])([^"']+)\1/gi, (fullMatch, quote, rawUrl) => {
    if (typeof rawUrl !== "string") {
      return fullMatch;
    }

    const avifUrl = toAvifDirectusAssetUrl(rawUrl);
    try {
      const parsed = new URL(avifUrl);
      if (!parsed.searchParams.has("width")) {
        parsed.searchParams.set("width", "800");
      }
      return `src=${quote}${parsed.toString()}${quote}`;
    } catch {
      return `src=${quote}${avifUrl}${quote}`;
    }
  });

  const withRewrittenLinks = withRewrittenSources.replace(/\bhref=(["'])([^"']+)\1/gi, (fullMatch, quote, rawUrl) => {
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
