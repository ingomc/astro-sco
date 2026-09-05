import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const allowContentEdits = args.includes("--allow") || process.env.ALLOW_CONTENT_EDITS === "true";
const stagedOnly = args.includes("--staged");

function getArgValue(name) {
  const entry = args.find((arg) => arg.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : undefined;
}

function runGit(command) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getChangedFiles() {
  if (stagedOnly) {
    const output = runGit("git diff --cached --name-only");
    return output ? output.split("\n").filter(Boolean) : [];
  }

  const explicitBase = getArgValue("--base") || process.env.BASE_REF;
  const baseCandidates = explicitBase
    ? [explicitBase]
    : ["origin/main", "main", "origin/master", "master"];

  for (const baseRef of baseCandidates) {
    try {
      const output = runGit(`git diff --name-only ${baseRef}...HEAD`);
      return output ? output.split("\n").filter(Boolean) : [];
    } catch {
      // Try next base candidate.
    }
  }

  const fallback = runGit("git diff --name-only HEAD~1 HEAD");
  return fallback ? fallback.split("\n").filter(Boolean) : [];
}

function isEditorialContentPath(filePath) {
  return filePath.startsWith("src/content/");
}

function main() {
  if (allowContentEdits) {
    console.log("[guard:content] Content edits explicitly allowed by flag/env.");
    return;
  }

  let changedFiles;
  try {
    changedFiles = getChangedFiles();
  } catch (error) {
    console.error("[guard:content] Failed to inspect git changes.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const blocked = changedFiles.filter(isEditorialContentPath);
  if (blocked.length === 0) {
    console.log("[guard:content] No editorial content changes detected.");
    return;
  }

  console.error("[guard:content] Editorial content changes detected under src/content/.");
  console.error("[guard:content] In CMS-only mode, edit content in Directus instead of repository files.");
  for (const filePath of blocked) {
    console.error(`- ${filePath}`);
  }
  console.error("[guard:content] If this is an intentional migration/backfill, rerun with --allow or ALLOW_CONTENT_EDITS=true.");
  process.exit(1);
}

main();
