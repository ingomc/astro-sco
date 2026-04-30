import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { updateEventSignupById } from "../../../lib/event-signup-db";

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
    const payload = (await request.json()) as {
      ids?: unknown;
      action?: unknown;
    };
    const ids = Array.isArray(payload.ids)
      ? payload.ids
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      : [];
    const action = typeof payload.action === "string" ? payload.action : "";

    if (ids.length < 1) {
      return jsonResponse(
        { ok: false, message: "Bitte mindestens eine ID angeben." },
        400,
      );
    }

    if (action !== "notesDone" && action !== "notesOpen") {
      return jsonResponse({ ok: false, message: "Unbekannte Aktion." }, 400);
    }

    let updatedCount = 0;
    for (const id of ids) {
      const updated = await updateEventSignupById(id, {
        notesDone: action === "notesDone",
      });
      if (updated) {
        updatedCount += 1;
      }
    }

    return jsonResponse({ ok: true, updatedCount });
  } catch (error) {
    console.error("Failed to run bulk action", error);
    return jsonResponse(
      { ok: false, message: "Bulk-Aktion ist fehlgeschlagen." },
      500,
    );
  }
};

