import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { listEventSignups } from "../../../lib/event-signup-db";
import { buildEventSignupsCsv } from "../../../lib/event-signups";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId")?.trim() || undefined;
  const signups = await listEventSignups(eventId);
  const filename = eventId
    ? `anmeldungen-${eventId}.csv`
    : "event-anmeldungen.csv";

  return new Response(buildEventSignupsCsv(signups), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
};
