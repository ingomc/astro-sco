import type { APIRoute } from "astro";
import { isAdminAuthorized } from "../../../lib/admin-auth";
import { listEventSignups } from "../../../lib/event-signup-db";
import { formatSignupItems } from "../../../lib/event-signups";

export const prerender = false;

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId")?.trim() || undefined;
  const token = url.searchParams.get("token") ?? "";
  const signups = await listEventSignups(eventId);
  const csvParams = new URLSearchParams();

  if (token) {
    csvParams.set("token", token);
  }

  if (eventId) {
    csvParams.set("eventId", eventId);
  }

  const csvHref = `/api/admin/event-signups.csv?${csvParams.toString()}`;
  const dashboardHref = eventId
    ? `/admin/event-signups/${encodeURIComponent(eventId)}?${csvParams.toString()}`
    : `/admin/event-signups?${csvParams.toString()}`;
  const rows = signups
    .map(
      (signup) => `
        <tr>
          <td>${escapeHtml(signup.createdAt)}</td>
          <td>${escapeHtml(signup.eventId)}</td>
          <td>${escapeHtml(signup.kind)}</td>
          <td>${escapeHtml(signup.name)}</td>
          <td>${escapeHtml(signup.email)}</td>
          <td>${escapeHtml(signup.notes || "-")}</td>
          <td>${escapeHtml(signup.partySize)}</td>
          <td>${escapeHtml(formatSignupItems(signup.items))}</td>
          <td>${escapeHtml(signup.totalItems)}</td>
          <td><strong>${escapeHtml(signup.id)}</strong></td>
        </tr>
      `,
    )
    .join("");

  return new Response(
    `<!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Event-Anmeldungen</title>
        <style>
          body {
            margin: 0;
            padding: 2rem;
            color: #1c1917;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #fafaf9;
          }
          main {
            max-width: 1180px;
            margin: 0 auto;
          }
          header {
            display: flex;
            flex-wrap: wrap;
            align-items: end;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          h1 {
            margin: 0 0 0.25rem;
            font-size: 1.75rem;
          }
          p {
            margin: 0;
            color: #57534e;
          }
          a {
            display: inline-flex;
            min-height: 2.5rem;
            align-items: center;
            border-radius: 0.375rem;
            padding: 0 0.875rem;
            background: #b91c1c;
            color: #fff;
            font-weight: 700;
            text-decoration: none;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
          }
          th,
          td {
            border: 1px solid #e7e5e4;
            padding: 0.625rem;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f5f5f4;
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <h1>Event-Anmeldungen</h1>
              <p>${eventId ? `Gefiltert nach ${escapeHtml(eventId)}` : "Alle Veranstaltungen"} · ${signups.length} Einträge</p>
            </div>
            <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
              <a href="${escapeHtml(dashboardHref)}" style="background:#1d4ed8;">Zum Dashboard</a>
              <a href="${escapeHtml(csvHref)}">CSV exportieren</a>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Event</th>
                <th>Typ</th>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Hinweise</th>
                <th>Personen</th>
                <th>Auswahl</th>
                <th>Gesamt</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="10">Noch keine Anmeldungen.</td></tr>`}
            </tbody>
          </table>
        </main>
      </body>
    </html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
};
