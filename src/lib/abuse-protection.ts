type RateLimitRule = {
  key: string;
  max: number;
  windowSec: number;
};

type MemoryEntry = {
  count: number;
  expiresAt: number;
};

const memoryRateState = new Map<string, MemoryEntry>();

function getEnvVar(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) {
    return fromProcess;
  }
  const fromMeta = (import.meta.env as Record<string, unknown>)[name];
  return typeof fromMeta === "string" ? fromMeta : undefined;
}

function shouldBypassCaptchaInDev(): boolean {
  return (
    import.meta.env.DEV &&
    (getEnvVar("HCAPTCHA_DEV_BYPASS") ?? "").toLowerCase() === "true"
  );
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function securityLog(
  type: "captcha_failed" | "rate_limited" | "honeypot_hit",
  context: Record<string, unknown>,
): void {
  console.warn(`[security] ${type}`, context);
}

async function kvIncrWithWindow(key: string, windowSec: number): Promise<number> {
  const baseUrl = getEnvVar("KV_REST_API_URL");
  const token = getEnvVar("KV_REST_API_TOKEN");

  if (!baseUrl || !token) {
    const now = Date.now();
    const hit = memoryRateState.get(key);
    if (!hit || hit.expiresAt <= now) {
      memoryRateState.set(key, {
        count: 1,
        expiresAt: now + windowSec * 1000,
      });
      return 1;
    }

    hit.count += 1;
    memoryRateState.set(key, hit);
    return hit.count;
  }

  const keySegment = key
    .split(":")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const incrRes = await fetch(`${baseUrl}/incr/${keySegment}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!incrRes.ok) {
    throw new Error(`KV incr failed with status ${incrRes.status}`);
  }

  const value = Number(await incrRes.text());
  if (!Number.isFinite(value)) {
    throw new Error("KV incr returned non-numeric value.");
  }

  if (value === 1) {
    await fetch(`${baseUrl}/expire/${keySegment}/${windowSec}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return value;
}

export async function enforceSignupRateLimit(
  ip: string,
  eventId: string,
): Promise<void> {
  const rules: RateLimitRule[] = [
    { key: `ip:min:${ip}`, max: 5, windowSec: 60 },
    { key: `ip:hour:${ip}`, max: 30, windowSec: 3600 },
    { key: `event:hour:${eventId}:${ip}`, max: 12, windowSec: 3600 },
  ];

  for (const rule of rules) {
    const count = await kvIncrWithWindow(`signup:rl:${rule.key}`, rule.windowSec);
    if (count > rule.max) {
      throw new Error("RATE_LIMITED");
    }
  }
}

export async function verifyHCaptcha(
  tokenRaw: unknown,
  remoteIp: string,
): Promise<void> {
  if (shouldBypassCaptchaInDev()) {
    return;
  }

  const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
  if (!token) {
    throw new Error("CAPTCHA_MISSING");
  }

  const secret = getEnvVar("HCAPTCHA_SECRET_KEY");
  if (!secret) {
    throw new Error("CAPTCHA_CONFIG_MISSING");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: remoteIp,
  });

  const response = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("CAPTCHA_VERIFY_UNAVAILABLE");
  }

  const result = (await response.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (!result.success) {
    throw new Error("CAPTCHA_INVALID");
  }
}

export function mapSecurityErrorToResponse(error: unknown): {
  status: number;
  message: string;
  type?: "captcha_failed" | "rate_limited";
} | null {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "RATE_LIMITED") {
    return {
      status: 429,
      message:
        "Zu viele Versuche in kurzer Zeit. Bitte warten Sie kurz und versuchen es erneut.",
      type: "rate_limited",
    };
  }

  if (
    error.message === "CAPTCHA_MISSING" ||
    error.message === "CAPTCHA_INVALID" ||
    error.message === "CAPTCHA_VERIFY_UNAVAILABLE" ||
    error.message === "CAPTCHA_CONFIG_MISSING"
  ) {
    return {
      status: 403,
      message:
        "Die Sicherheitspruefung ist fehlgeschlagen. Bitte bestaetigen Sie das Captcha und versuchen es erneut.",
      type: "captcha_failed",
    };
  }

  return null;
}

export function getHCaptchaSiteKeyForRender(): string {
  return getEnvVar("HCAPTCHA_SITE_KEY") ?? "";
}

export function isCaptchaBypassEnabledForDevRender(): boolean {
  return shouldBypassCaptchaInDev();
}

export async function createIpFingerprint(ipRaw: string): Promise<string> {
  const ip = ipRaw.trim().toLowerCase();
  if (!ip || ip === "unknown") {
    return "unknown";
  }

  const salt = getEnvVar("IP_FINGERPRINT_SALT") ?? "";
  const input = `${ip}|${salt}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex.slice(0, 16);
}
