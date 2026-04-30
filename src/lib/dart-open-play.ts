export type DartOpenPlaySlot = {
  slotAtIso: string;
  slotLabel: string;
};

const BERLIN_TIMEZONE = "Europe/Berlin";

function getBerlinDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayText = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    weekday: weekdayMap[weekdayText] ?? 0,
  };
}

function toUtcIsoFromBerlinDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const localeText = utcGuess.toLocaleString("sv-SE", {
    timeZone: BERLIN_TIMEZONE,
    hour12: false,
  });
  const [datePart, timePart] = localeText.split(" ");
  const [localYear, localMonth, localDay] = datePart.split("-").map(Number);
  const [localHour, localMinute, localSecond] = timePart
    .split(":")
    .map(Number);
  const localAsUtc = Date.UTC(
    localYear,
    localMonth - 1,
    localDay,
    localHour,
    localMinute,
    localSecond ?? 0,
  );
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const corrected = new Date(utcGuess.getTime() - (localAsUtc - targetAsUtc));
  return corrected.toISOString();
}

export function getNextDartOpenPlaySlots(
  now = new Date(),
  count = 3,
): DartOpenPlaySlot[] {
  const today = getBerlinDateParts(now);
  const daysUntilSunday = (7 - today.weekday) % 7;
  const slots: DartOpenPlaySlot[] = [];
  const baseUtc = Date.UTC(today.year, today.month - 1, today.day);

  for (let index = 0; index < count; index += 1) {
    const offsetDays = daysUntilSunday + index * 7;
    const dayUtc = new Date(baseUtc + offsetDays * 86400000);
    const y = dayUtc.getUTCFullYear();
    const m = dayUtc.getUTCMonth() + 1;
    const d = dayUtc.getUTCDate();
    const slotAtIso = toUtcIsoFromBerlinDate(y, m, d, 18, 0);
    const labelDate = new Date(slotAtIso).toLocaleDateString("de-DE", {
      timeZone: BERLIN_TIMEZONE,
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    slots.push({
      slotAtIso,
      slotLabel: `${labelDate}, 18:00 Uhr`,
    });
  }

  return slots;
}

export function isValidDartOpenPlaySlot(
  slotAtIso: string,
  slots: DartOpenPlaySlot[],
): boolean {
  return slots.some((slot) => slot.slotAtIso === slotAtIso);
}
