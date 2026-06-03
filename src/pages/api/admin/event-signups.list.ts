import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { listEventSignupsAdmin } from "../../../lib/event-signup-db";
import {
  EventSignupValidationError,
  parseEventSignupAdminQuery,
} from "../../../lib/event-signups";

export const prerender = false;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  try {
    const url = new URL(request.url);
    const query = parseEventSignupAdminQuery(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listEventSignupsAdmin(query);

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    if (error instanceof EventSignupValidationError) {
      return jsonResponse({ ok: false, message: error.message }, 400);
    }

    console.error("Failed to load signup list", error);
    return jsonResponse(
      { ok: false, message: "Die Liste konnte nicht geladen werden." },
      500,
    );
  }
};
