export function isAdminAuthorized(request: Request): boolean {
  const metaToken = (import.meta.env as Record<string, unknown>)[
    "ADMIN_EXPORT_TOKEN"
  ];
  const configuredToken =
    process.env.ADMIN_EXPORT_TOKEN ??
    (typeof metaToken === "string" ? metaToken : undefined) ??
    (import.meta.env.DEV ? "local" : "");

  if (!configuredToken) {
    return false;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  return queryToken === configuredToken || headerToken === configuredToken;
}
