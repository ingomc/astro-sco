import "dotenv/config";

const mcpValue = process.env.MCP;
const mcpUrl = isLikelyHttpUrl(mcpValue) ? mcpValue : undefined;
const mcpToken = mcpValue && !mcpUrl ? mcpValue : undefined;

const rawBaseUrl = process.env.DIRECTUS_URL || process.env.DIRECTUS_BASE_URL || process.env.DIRECTUS_PUBLIC_URL || mcpUrl;
const explicitApiUrl = process.env.DIRECTUS_API_URL;
const token = process.env.DIRECTUS_TOKEN
  || process.env.DIRECTUS_ACCESS_TOKEN
  || process.env.MCP_TOKEN
  || mcpToken
  || process.env.ADMIN_EXPORT_TOKEN;

if (!rawBaseUrl) {
  throw new Error("Missing Directus URL in environment (DIRECTUS_URL, DIRECTUS_BASE_URL, DIRECTUS_PUBLIC_URL, or MCP URL).");
}

if (!token) {
  throw new Error("Missing Directus token in environment (DIRECTUS_TOKEN, DIRECTUS_ACCESS_TOKEN, ADMIN_EXPORT_TOKEN, or MCP_TOKEN).");
}

function isLikelyHttpUrl(value) {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function appendQueryParams(searchParams, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryParams(searchParams, `${key}[]`, item);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendQueryParams(searchParams, `${key}[${nestedKey}]`, nestedValue);
    }
    return;
  }

  searchParams.append(key, String(value));
}

function ensureTrailingSlash(urlString) {
  const parsed = new URL(urlString);
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}

function unique(values) {
  return [...new Set(values)];
}

function resolveApiBaseUrls() {
  if (explicitApiUrl) {
    return [ensureTrailingSlash(explicitApiUrl)];
  }

  const parsed = new URL(rawBaseUrl);
  if (parsed.pathname.endsWith("/mcp")) {
    const withoutMcp = new URL(parsed.toString());
    withoutMcp.pathname = `${withoutMcp.pathname.slice(0, -4)}/`;

    const withDirectusPrefix = new URL(withoutMcp.toString());
    withDirectusPrefix.pathname = `${withDirectusPrefix.pathname}directus/`;

    return [
      withDirectusPrefix.toString(),
      withoutMcp.toString(),
    ];
  }

  if (parsed.pathname.endsWith("/directus") || parsed.pathname.endsWith("/directus/")) {
    const withoutDirectus = new URL(parsed.toString());
    withoutDirectus.pathname = withoutDirectus.pathname.replace(/\/directus\/?$/, "/");

    return unique([
      ensureTrailingSlash(parsed.toString()),
      ensureTrailingSlash(withoutDirectus.toString()),
    ]);
  }

  return [ensureTrailingSlash(parsed.toString())];
}

const apiBaseUrls = resolveApiBaseUrls();

const assetBaseUrls = unique(
  apiBaseUrls.map((urlString) => {
    const parsed = new URL(urlString);

    if (parsed.pathname.endsWith("/directus/")) {
      parsed.pathname = parsed.pathname.slice(0, -9) || "/";
    }

    return ensureTrailingSlash(parsed.toString());
  }),
);

function buildRequestUrl(apiBaseUrl, pathname, query) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath.slice(1), apiBaseUrl);

  if (query && Object.keys(query).length > 0) {
    for (const [key, value] of Object.entries(query)) {
      appendQueryParams(url.searchParams, key, value);
    }
  }

  return url;
}

function buildRequestOptions(method, body, contentType, extraHeaders) {
  const safeExtraHeaders = extraHeaders ?? undefined;
  const headers = {
    Authorization: `Bearer ${token}`,
    ...safeExtraHeaders,
  };

  if (contentType !== "form") {
    headers["Content-Type"] = "application/json";
  }

  let requestBody;
  if (body !== undefined && body !== null) {
    if (contentType === "form") {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
    }
  }

  return {
    method,
    headers,
    body: requestBody,
  };
}

function shouldRetryWithFallback(response, text, hasFallback) {
  return hasFallback && response.status === 404 && text.includes("ROUTE_NOT_FOUND");
}

async function parseSuccessPayload(response) {
  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();
  return payload.data ?? payload;
}

async function executeRequest(apiBaseUrl, pathname, options) {
  const {
    method,
    query,
    body,
    contentType,
    headers,
  } = options;
  const url = buildRequestUrl(apiBaseUrl, pathname, query);
  const response = await fetch(url, buildRequestOptions(method, body, contentType, headers));
  return response;
}

export async function directusRequest(pathname, options = {}) {
  const {
    method = "GET",
    query,
    body,
    contentType = "json",
    headers,
    allow404 = false,
  } = options;

  for (let i = 0; i < apiBaseUrls.length; i += 1) {
    const response = await executeRequest(apiBaseUrls[i], pathname, {
      method,
      query,
      body,
      contentType,
      headers,
    });

    const hasFallback = i < apiBaseUrls.length - 1;

    if (response.status === 404) {
      const text = await response.text();

      if (shouldRetryWithFallback(response, text, hasFallback)) {
        continue;
      }

      if (allow404) {
        return null;
      }

      throw new Error(`Directus ${method} ${pathname} failed (${response.status}): ${text}`);
    }

    if (!response.ok) {
      const text = await response.text();

      if (shouldRetryWithFallback(response, text, hasFallback)) {
        continue;
      }

      throw new Error(`Directus ${method} ${pathname} failed (${response.status}): ${text}`);
    }

    return parseSuccessPayload(response);
  }

  throw new Error(`Directus ${method} ${pathname} failed: no reachable API base URL.`);
}

export function getDirectusBaseUrl() {
  return apiBaseUrls.join(" or ");
}

export function getAssetPathForFileId(fileId) {
  const firstAssetBase = new URL(assetBaseUrls[0]);
  const basePath = firstAssetBase.pathname.endsWith("/")
    ? firstAssetBase.pathname
    : `${firstAssetBase.pathname}/`;

  return `${basePath}assets/${fileId}`;
}
