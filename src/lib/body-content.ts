import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { ContentEntry } from "./content-source";

type RenderableDirectusEntry = ContentEntry<"veranstaltungen" | "berichte" | "start" | "sportheim">;

let markdownProcessorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

function getMarkdownProcessor() {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor();
  }
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

export async function renderDirectusBodyToHtml(
  entry: RenderableDirectusEntry,
): Promise<string | null> {
  if (!canRenderDirectusBody(entry)) {
    return null;
  }

  if (entry.contentFormat === "markdown") {
    return renderMarkdownToHtml(entry.body || "");
  }

  return entry.body || null;
}
