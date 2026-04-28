import { getCollection } from "astro:content";
import type { EventSignupConfig } from "./event-signups";

export async function getEventSignupConfig(
  eventId: string,
): Promise<EventSignupConfig | null> {
  const events = await getCollection("veranstaltungen");
  const event = events.find(
    (entry) =>
      entry.data.signup?.enabled === true &&
      entry.data.signup.eventId === eventId,
  );

  if (!event?.data.signup) {
    return null;
  }

  return {
    eventId: event.data.signup.eventId,
    mode: event.data.signup.mode,
    deadline: event.data.signup.deadline,
    capacity: event.data.signup.capacity,
    items: event.data.signup.items,
  };
}
