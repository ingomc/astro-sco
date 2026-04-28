import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import {
  deleteEventSignupById,
  updateEventSignupById,
} from "../../../lib/event-signup-db";
import {
  EventSignupValidationError,
  parseEventSignupAdminPatch,
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

function getId(request: Request): string {
  return new URL(request.url).searchParams.get("id")?.trim() ?? "";
}

export const PATCH: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  const id = getId(request);
  if (!id) {
    return jsonResponse({ ok: false, message: "Fehlende ID." }, 400);
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const patch = parseEventSignupAdminPatch(payload);
    const updated = await updateEventSignupById(id, patch);

    if (!updated) {
      return jsonResponse({ ok: false, message: "Datensatz nicht gefunden." }, 404);
    }

    return jsonResponse({ ok: true, signup: updated });
  } catch (error) {
    if (error instanceof EventSignupValidationError) {
      return jsonResponse({ ok: false, message: error.message }, 400);
    }

    console.error("Failed to patch signup", error);
    return jsonResponse(
      { ok: false, message: "Die Anmeldung konnte nicht aktualisiert werden." },
      500,
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  const id = getId(request);
  if (!id) {
    return jsonResponse({ ok: false, message: "Fehlende ID." }, 400);
  }

  try {
    const deleted = await deleteEventSignupById(id);

    if (!deleted) {
      return jsonResponse({ ok: false, message: "Datensatz nicht gefunden." }, 404);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Failed to delete signup", error);
    return jsonResponse(
      { ok: false, message: "Die Anmeldung konnte nicht geloescht werden." },
      500,
    );
  }
};
