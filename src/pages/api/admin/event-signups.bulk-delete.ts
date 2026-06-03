import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { bulkDeleteEventSignups } from "../../../lib/event-signup-db";

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

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  try {
    const payload = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(payload.ids)
      ? payload.ids
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      : [];

    if (ids.length < 1) {
      return jsonResponse(
        { ok: false, message: "Bitte mindestens eine ID angeben." },
        400,
      );
    }

    const deletedCount = await bulkDeleteEventSignups(ids);
    return jsonResponse({ ok: true, deletedCount });
  } catch (error) {
    console.error("Failed to bulk delete signups", error);
    return jsonResponse(
      { ok: false, message: "Bulk-Loeschen ist fehlgeschlagen." },
      500,
    );
  }
};
