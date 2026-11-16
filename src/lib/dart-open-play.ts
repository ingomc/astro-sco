function valueFromEnvironment(name: string): string | undefined {
  const value = import.meta.env[name] ?? process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Returns the public Directus endpoint used by the Dart training signup.
 *
 * An explicit public URL wins so preview deployments can point at a staging
 * Directus instance. The regular Directus URL is a safe fallback: it is a
 * public CMS host, unlike the build token that never leaves the server.
 */
export function getDartOpenPlayApiUrl(): string {
  const configured = valueFromEnvironment("PUBLIC_DART_OPEN_PLAY_API_URL");
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const directusUrl =
    valueFromEnvironment("DIRECTUS_PUBLIC_URL") ??
    valueFromEnvironment("DIRECTUS_URL") ??
    valueFromEnvironment("DIRECTUS_BASE_URL");

  if (!directusUrl) {
    return "";
  }

  try {
    const base = new URL(
      directusUrl.endsWith("/") ? directusUrl : `${directusUrl}/`,
    );
    return new URL("dart-open-play", base).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
