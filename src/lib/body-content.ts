import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { ContentEntry } from "./content-source";

let markdownProcessorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;

function getMarkdownProcessor() {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor();
  }
  return markdownProcessorPromise;
}

export function canRenderDirectusMarkdown(entry: ContentEntry<"veranstaltungen" | "berichte">): boolean {
  return (
    entry.source === "directus" &&
    entry.contentFormat === "markdown" &&
    typeof entry.body === "string" &&
    entry.body.length > 0
  );
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const processor = await getMarkdownProcessor();
  const rendered = await processor.render(markdown, {});
  return rendered.code;
}
