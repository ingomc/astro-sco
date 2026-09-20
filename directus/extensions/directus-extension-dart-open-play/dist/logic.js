import { randomBytes } from "node:crypto";

export const DART_OPEN_PLAY_EVENT_ID = "dart-open-play";
export const DART_OPEN_PLAY_EVENT_TITLE = "Offenes Sonntagstraining";
export const DART_OPEN_PLAY_LOCATION = "Sportheim Oberfüllbach";
export const DART_OPEN_PLAY_TIME_ZONE = "Europe/Berlin";
export const DART_OPEN_PLAY_DEFAULT_TIME = "18:00";

export class DartOpenPlayError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function formatter(options) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DART_OPEN_PLAY_TIME_ZONE,
    ...options,
  });
}

function dateParts(date) {
  const parts = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function timeZoneOffsetMs(date) {
  const parts = dateParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function berlinLocalTimeToUtc(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = guess - timeZoneOffsetMs(new Date(guess));
  const correctedOffset = timeZoneOffsetMs(new Date(utc));
  if (correctedOffset !== timeZoneOffsetMs(new Date(guess))) {
    utc = guess - correctedOffset;
  }
  return new Date(utc);
}

export function normalizeOpenPlayTime(value) {
  if (typeof value !== "string" || !value.trim()) {
    return DART_OPEN_PLAY_DEFAULT_TIME;
  }

  const normalized = value.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    return DART_OPEN_PLAY_DEFAULT_TIME;
  }

  return normalized;
}

function localizedDateLabel(date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: DART_OPEN_PLAY_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * The endpoint owns the appointment. A submitted form can therefore never
 * choose an old or arbitrary Sunday, even if its page was left open.
 */
export function getNextDartOpenPlaySlot(now = new Date(), configuredTime) {
  const time = normalizeOpenPlayTime(configuredTime);
  const [hour, minute] = time.split(":").map(Number);
  const berlin = dateParts(now);
  const today = new Date(Date.UTC(berlin.year, berlin.month - 1, berlin.day));
  let daysUntilSunday = (7 - today.getUTCDay()) % 7;

  let targetDate = new Date(today.getTime() + daysUntilSunday * 86400000);
  let at = berlinLocalTimeToUtc(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth() + 1,
    targetDate.getUTCDate(),
    hour,
    minute,
  );

  if (at.getTime() <= now.getTime()) {
    daysUntilSunday += 7;
    targetDate = new Date(today.getTime() + daysUntilSunday * 86400000);
    at = berlinLocalTimeToUtc(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth() + 1,
      targetDate.getUTCDate(),
      hour,
      minute,
    );
  }

  return {
    at: at.toISOString(),
    label: `${localizedDateLabel(at)}, ${time} Uhr`,
    time,
  };
}

export function createRegistrationId() {
  return `D${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function validateRegistrationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new DartOpenPlayError("INVALID_REQUEST", "Ungültige Anmeldedaten.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const phoneInput =
    typeof payload.phone === "string" ? payload.phone.trim() : "";
  const phone = phoneInput.replace(/[\s()./-]/g, "");
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const website =
    typeof payload.website === "string" ? payload.website.trim() : "";

  if (website) {
    throw new DartOpenPlayError(
      "INVALID_REQUEST",
      "Die Anmeldung konnte nicht verarbeitet werden.",
    );
  }
  if (name.length < 2 || name.length > 120) {
    throw new DartOpenPlayError(
      "INVALID_NAME",
      "Bitte gib einen Namen mit 2 bis 120 Zeichen an.",
    );
  }
  if (!email && !phone) {
    throw new DartOpenPlayError(
      "CONTACT_REQUIRED",
      "Bitte gib eine Handynummer oder E-Mail-Adresse an.",
    );
  }
  if (
    email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)
  ) {
    throw new DartOpenPlayError(
      "INVALID_EMAIL",
      "Bitte gib eine gültige E-Mail-Adresse an.",
    );
  }
  if (phoneInput && (phoneInput.length > 40 || !/^\+?\d{7,15}$/.test(phone))) {
    throw new DartOpenPlayError(
      "INVALID_PHONE",
      "Bitte gib eine gültige Handynummer an.",
    );
  }
  if (notes.length > 1000) {
    throw new DartOpenPlayError(
      "INVALID_NOTES",
      "Bitte kürze den Hinweis auf maximal 1000 Zeichen.",
    );
  }
  if (payload.privacyAccepted !== true) {
    throw new DartOpenPlayError(
      "PRIVACY_REQUIRED",
      "Bitte bestätige den Datenschutzhinweis.",
    );
  }

  return { name, email: email || null, phone: phone || null, notes };
}
