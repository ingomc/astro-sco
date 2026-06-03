import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { listEventSignupCollections } from "../../../lib/event-signup-db";

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
    const rows = await listEventSignupCollections();
    return jsonResponse({ ok: true, rows });
  } catch (error) {
    console.error("Failed to load signup collections", error);
    return jsonResponse(
      { ok: false, message: "Die Event-Collections konnten nicht geladen werden." },
      500,
    );
  }
};

