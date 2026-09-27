import { getPublicDirectusApiUrl } from "./public-directus-api";

/**
 * Returns the public Directus endpoint used by the Dart training signup.
 *
 * An explicit public URL wins so preview deployments can point at a staging
 * Directus instance. The regular Directus URL is a safe fallback: it is a
 * public CMS host, unlike the build token that never leaves the server.
 */
export function getDartOpenPlayApiUrl(): string {
  return getPublicDirectusApiUrl(
    "dart-open-play",
    "PUBLIC_DART_OPEN_PLAY_API_URL",
  );
}
