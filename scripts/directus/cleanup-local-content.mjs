import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { directusRequest, getDirectusBaseUrl } from "./client.mjs";

const args = process.argv.slice(2);
const applyChanges = args.includes("--apply");
const dryRun = !applyChanges;

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

const collectionConfig = [
  {
    name: "veranstaltungen",
    pattern: "src/content/veranstaltungen/**/*.{md,mdx}",
    root: path.join(workspaceRoot, "src", "content", "veranstaltungen"),
  },
  {
    name: "berichte",
    pattern: "src/content/berichte/**/*.{md,mdx}",
    root: path.join(workspaceRoot, "src", "content", "berichte"),
  },
  {
    name: "mitglieder",
    pattern: "src/content/mitglieder/**/*.{md,mdx}",
    root: path.join(workspaceRoot, "src", "content", "mitglieder"),
  },
  {
    name: "start",
    pattern: "src/content/start/**/*.{md,mdx}",
    root: path.join(workspaceRoot, "src", "content", "start"),
  },
  {
    name: "sportheim",
    pattern: "src/content/sportheim/**/*.{md,mdx}",
    root: path.join(workspaceRoot, "src", "content", "sportheim"),
  },
];

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function toSlug(relativePath) {
  return normalizePath(relativePath).replace(/\.(md|mdx)$/i, "");
}

async function itemExistsBySlug(collectionName, slug) {
  const matches = await directusRequest(`/items/${collectionName}`, {
    query: {
      fields: ["id", "slug"],
      limit: 1,
      filter: {
        slug: {
          _eq: slug,
        },
      },
    },
  });

  return Array.isArray(matches) && matches.length > 0;
}

async function removeEmptyParentDirs(filePath, stopAt) {
  let current = path.dirname(filePath);

  while (current.startsWith(stopAt) && current !== stopAt) {
    const entries = await fs.readdir(current);
    if (entries.length > 0) {
      break;
    }
    await fs.rmdir(current);
    current = path.dirname(current);
  }
}

async function cleanupCollection(config, counters, warnings) {
  const filePaths = await fg(config.pattern, {
    cwd: workspaceRoot,
    absolute: true,
    dot: false,
  });

  for (const filePath of filePaths) {
    const relativePath = normalizePath(path.relative(config.root, filePath));
    const slug = toSlug(relativePath);

    const exists = await itemExistsBySlug(config.name, slug);
    if (!exists) {
      warnings.push(`skip delete (missing in Directus): ${config.name}/${slug}`);
      counters.skippedMissing += 1;
      continue;
    }

    if (dryRun) {
      counters.plannedDeletes += 1;
      continue;
    }

    await fs.unlink(filePath);
    await removeEmptyParentDirs(filePath, config.root);
    counters.deleted += 1;
  }
}

async function main() {
  const counters = {
    plannedDeletes: 0,
    deleted: 0,
    skippedMissing: 0,
  };
  const warnings = [];

  console.log(`Checking local content cleanup against ${getDirectusBaseUrl()}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);

  for (const config of collectionConfig) {
    if (selectedCollections && !selectedCollections.has(config.name)) {
      continue;
    }

    console.log(`\nCollection: ${config.name}`);
    await cleanupCollection(config, counters, warnings);
  }

  console.log("\nCleanup summary:");
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
  console.error("Local content cleanup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
