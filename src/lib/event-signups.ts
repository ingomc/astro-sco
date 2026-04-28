export const SIGNUP_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export type EventSignupMode = "registration" | "order" | "both";

export type EventSignupItemConfig = {
  id: string;
  label: string;
  max?: number;
};

export type EventSignupConfig = {
  eventId: string;
  mode: EventSignupMode;
  deadline: Date;
  capacity?: number;
  items?: EventSignupItemConfig[];
};

export type EventSignupInput = {
  eventId?: unknown;
  name?: unknown;
  email?: unknown;
  partySize?: unknown;
  items?: unknown;
  website?: unknown;
};

export type EventRegistrationItem = {
  registrationId: string;
  itemId: string;
  label: string;
  quantity: number;
};

export type EventRegistration = {
  id: string;
  eventId: string;
  createdAt: string;
  name: string;
  email: string;
  kind: EventSignupMode;
  partySize: number;
  totalItems: number;
};

export type EventSignupWithItems = EventRegistration & {
  items: EventRegistrationItem[];
};

export class EventSignupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventSignupValidationError";
  }
}

export function createRegistrationId(): string {
  const values = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(
    values,
    (value) => SIGNUP_ID_ALPHABET[value % SIGNUP_ID_ALPHABET.length],
  ).join("");
}

export function isSignupOpen(config: EventSignupConfig, now = new Date()) {
  return now.getTime() <= new Date(config.deadline).getTime();
}

function parseInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function getItemPayload(input: EventSignupInput): Record<string, unknown> {
  return input.items && typeof input.items === "object"
    ? (input.items as Record<string, unknown>)
    : {};
}

export function parseEventSignupInput(
  input: EventSignupInput,
  config: EventSignupConfig,
): {
  name: string;
  email: string;
  partySize: number;
  items: EventRegistrationItem[];
  totalItems: number;
  isSpam: boolean;
} {
  const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const website = typeof input.website === "string" ? input.website.trim() : "";

  if (eventId !== config.eventId) {
    throw new EventSignupValidationError(
      "Die Veranstaltung konnte nicht zugeordnet werden.",
    );
  }

  if (!name) {
    throw new EventSignupValidationError("Bitte geben Sie einen Namen ein.");
  }

  if (name.length > 100) {
    throw new EventSignupValidationError("Der Name ist zu lang.");
  }

  if (!email) {
    throw new EventSignupValidationError("Bitte geben Sie eine E-Mail ein.");
  }

  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new EventSignupValidationError(
      "Bitte geben Sie eine gültige E-Mail ein.",
    );
  }

  const partySize = parseInteger(input.partySize, 1);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 99) {
    throw new EventSignupValidationError(
      "Bitte geben Sie eine gültige Personenzahl ein.",
    );
  }

  const itemPayload = getItemPayload(input);
  const configuredItems = config.items ?? [];
  const items =
    config.mode === "registration"
      ? []
      : configuredItems
          .map((item) => {
            const quantity = parseInteger(itemPayload[item.id], 0);
            const max = item.max ?? 99;

            if (!Number.isInteger(quantity) || quantity < 0 || quantity > max) {
              throw new EventSignupValidationError(
                "Bitte geben Sie gültige Anzahlen ein.",
              );
            }

            return {
              registrationId: "",
              itemId: item.id,
              label: item.label,
              quantity,
            };
          })
          .filter((item) => item.quantity > 0);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (config.mode === "order" && totalItems < 1) {
    throw new EventSignupValidationError(
      "Bitte wählen Sie mindestens eine Position aus.",
    );
  }

  if (totalItems > 99) {
    throw new EventSignupValidationError(
      "Bitte wählen Sie maximal 99 Positionen pro Formular.",
    );
  }

  return {
    name,
    email,
    partySize,
    items,
    totalItems,
    isSpam: website.length > 0,
  };
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\n\r;]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function formatSignupItems(items: EventRegistrationItem[]): string {
  return items.map((item) => `${item.quantity}x ${item.label}`).join(" | ");
}

export function buildEventSignupsCsv(signups: EventSignupWithItems[]): string {
  const header = [
    "Zeit",
    "Event",
    "Typ",
    "Name",
    "E-Mail",
    "Personen",
    "Auswahl",
    "Gesamt",
    "ID",
  ];

  const rows = signups.map((signup) => [
    signup.createdAt,
    signup.eventId,
    signup.kind,
    signup.name,
    signup.email,
    signup.partySize,
    formatSignupItems(signup.items),
    signup.totalItems,
    signup.id,
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\r\n");

  return `\uFEFF${csv}\r\n`;
}
