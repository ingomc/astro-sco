import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { listEventSignupsAdmin } from "../../../lib/event-signup-db";
import {
  buildEventSignupsCsv,
  parseEventSignupAdminQuery,
} from "../../../lib/event-signups";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const query = parseEventSignupAdminQuery(
    Object.fromEntries(url.searchParams.entries()),
  );
  const allRows = await listEventSignupsAdmin({
    ...query,
    page: 1,
    pageSize: 100000,
  });
  const filename = query.eventId
    ? `anmeldungen-${query.eventId}.csv`
    : "event-anmeldungen.csv";

  return new Response(buildEventSignupsCsv(allRows.rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
};
