function valueFromEnvironment(name: string): string | undefined {
  const value = import.meta.env[name] ?? process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getPublicDirectusApiUrl(
  endpoint: string,
  publicUrlVariable: string,
): string {
  const configured = valueFromEnvironment(publicUrlVariable);
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
    return new URL(endpoint, base).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
