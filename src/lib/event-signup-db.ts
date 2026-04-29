import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import type {
  EventSignupAdminPatch,
  EventSignupAdminQuery,
  EventRegistration,
  EventRegistrationItem,
  EventSignupWithItems,
} from "./event-signups";

type NeonSql = ReturnType<typeof neon>;
type DatabaseDriver = "neon" | "pg";

let sqlClient: NeonSql | undefined;
let pgPool: Pool | undefined;
let schemaPromise: Promise<void> | undefined;

function getEnvVar(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess) {
    return fromProcess;
  }

  const fromMeta = (import.meta.env as Record<string, unknown>)[name];
  return typeof fromMeta === "string" ? fromMeta : undefined;
}

function getDatabaseUrl(): string {
  const localDatabaseUrl = getEnvVar("LOCAL_DATABASE_URL");
  const databaseUrl = getEnvVar("DATABASE_URL");

  // In local development we prefer a dedicated local database URL so
  // developers never accidentally write to shared/staging/production data.
  if (import.meta.env.DEV && localDatabaseUrl) {
    return localDatabaseUrl;
  }

  if (!databaseUrl) {
    throw new Error(
      import.meta.env.DEV
        ? "DATABASE_URL is not configured. Set LOCAL_DATABASE_URL (recommended) or DATABASE_URL."
        : "DATABASE_URL is not configured.",
    );
  }

  return databaseUrl;
}

function isNeonDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return hostname.endsWith(".neon.tech") || hostname === "neon.tech";
  } catch {
    return databaseUrl.includes("neon.tech");
  }
}

function getDatabaseDriver(): DatabaseDriver {
  const configuredDriver = getEnvVar("DB_DRIVER")?.trim().toLowerCase();

  if (configuredDriver === "neon" || configuredDriver === "pg") {
    return configuredDriver;
  }

  return isNeonDatabaseUrl(getDatabaseUrl()) ? "neon" : "pg";
}

function getSql(): NeonSql {
  const databaseUrl = getDatabaseUrl();
  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

function getPgPool(): Pool {
  const databaseUrl = getDatabaseUrl();
  pgPool ??= new Pool({ connectionString: databaseUrl });
  return pgPool;
}

export async function ensureEventSignupSchema(): Promise<void> {
  schemaPromise ??= (async () => {
    if (getDatabaseDriver() === "neon") {
      const sql = getSql();

      await sql`
        create table if not exists event_registrations (
          id text primary key,
          event_id text not null,
          created_at timestamptz not null default now(),
          name text not null,
          email text not null,
          kind text not null check (kind in ('registration', 'order', 'both')),
          party_size integer not null default 1 check (party_size >= 1),
          total_items integer not null default 0 check (total_items >= 0)
        )
      `;

      await sql`
        create table if not exists event_registration_items (
          registration_id text not null references event_registrations(id) on delete cascade,
          item_id text not null,
          label text not null,
          quantity integer not null check (quantity > 0),
          primary key (registration_id, item_id)
        )
      `;

      await sql`
        create index if not exists event_registrations_event_id_created_at_idx
          on event_registrations(event_id, created_at)
      `;

      return;
    }

    const pool = getPgPool();
    await pool.query(`
      create table if not exists event_registrations (
        id text primary key,
        event_id text not null,
        created_at timestamptz not null default now(),
        name text not null,
        email text not null,
        kind text not null check (kind in ('registration', 'order', 'both')),
        party_size integer not null default 1 check (party_size >= 1),
        total_items integer not null default 0 check (total_items >= 0)
      )
    `);
    await pool.query(`
      create table if not exists event_registration_items (
        registration_id text not null references event_registrations(id) on delete cascade,
        item_id text not null,
        label text not null,
        quantity integer not null check (quantity > 0),
        primary key (registration_id, item_id)
      )
    `);
    await pool.query(`
      create index if not exists event_registrations_event_id_created_at_idx
        on event_registrations(event_id, created_at)
    `);
  })();

  await schemaPromise;
}

export async function countEventReservedSeats(
  eventId: string,
): Promise<number> {
  await ensureEventSignupSchema();
  if (getDatabaseDriver() === "neon") {
    const sql = getSql();
    const rows = await sql`
      select coalesce(sum(party_size), 0)::int as count
      from event_registrations
      where event_id = ${eventId}
    `;

    return Number(rows[0]?.count ?? 0);
  }

  const pool = getPgPool();
  const result = await pool.query<{ count: number }>(
    `
      select coalesce(sum(party_size), 0)::int as count
      from event_registrations
      where event_id = $1
    `,
    [eventId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function saveEventSignup(
  registration: EventRegistration,
  items: EventRegistrationItem[],
): Promise<void> {
  await ensureEventSignupSchema();
  if (getDatabaseDriver() === "neon") {
    const sql = getSql();
    const itemRows = items.map((item) => ({
      ...item,
      registrationId: registration.id,
    }));
    const queries = [
      sql`
        insert into event_registrations (
          id,
          event_id,
          created_at,
          name,
          email,
          kind,
          party_size,
          total_items
        )
        values (
          ${registration.id},
          ${registration.eventId},
          ${registration.createdAt},
          ${registration.name},
          ${registration.email},
          ${registration.kind},
          ${registration.partySize},
          ${registration.totalItems}
        )
      `,
      ...itemRows.map(
        (item) => sql`
          insert into event_registration_items (
            registration_id,
            item_id,
            label,
            quantity
          )
          values (
            ${item.registrationId},
            ${item.itemId},
            ${item.label},
            ${item.quantity}
          )
        `,
      ),
    ];

    await sql.transaction(queries);
    return;
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      `
        insert into event_registrations (
          id,
          event_id,
          created_at,
          name,
          email,
          kind,
          party_size,
          total_items
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        registration.id,
        registration.eventId,
        registration.createdAt,
        registration.name,
        registration.email,
        registration.kind,
        registration.partySize,
        registration.totalItems,
      ],
    );

    for (const item of items) {
      await client.query(
        `
          insert into event_registration_items (
            registration_id,
            item_id,
            label,
            quantity
          )
          values ($1, $2, $3, $4)
        `,
        [registration.id, item.itemId, item.label, item.quantity],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type RegistrationRow = {
  id: string;
  event_id: string;
  created_at: string | Date;
  name: string;
  email: string;
  kind: EventRegistration["kind"];
  party_size: number;
  total_items: number;
};

type ItemRow = {
  registration_id: string;
  item_id: string;
  label: string;
  quantity: number;
};

export async function listEventSignups(
  eventId?: string,
): Promise<EventSignupWithItems[]> {
  await ensureEventSignupSchema();
  let registrationRows: RegistrationRow[];
  let itemRows: ItemRow[];

  if (getDatabaseDriver() === "neon") {
    const sql = getSql();
    registrationRows = (
      eventId
        ? await sql`
          select id, event_id, created_at, name, email, kind, party_size, total_items
          from event_registrations
          where event_id = ${eventId}
          order by created_at asc
        `
        : await sql`
          select id, event_id, created_at, name, email, kind, party_size, total_items
          from event_registrations
          order by created_at asc
        `
    ) as RegistrationRow[];

    itemRows = (
      eventId
        ? await sql`
          select i.registration_id, i.item_id, i.label, i.quantity
          from event_registration_items i
          join event_registrations r on r.id = i.registration_id
          where r.event_id = ${eventId}
          order by r.created_at asc, i.item_id asc
        `
        : await sql`
          select i.registration_id, i.item_id, i.label, i.quantity
          from event_registration_items i
          join event_registrations r on r.id = i.registration_id
          order by r.created_at asc, i.item_id asc
        `
    ) as ItemRow[];
  } else {
    const pool = getPgPool();
    const registrationResult = eventId
      ? await pool.query<RegistrationRow>(
          `
            select id, event_id, created_at, name, email, kind, party_size, total_items
            from event_registrations
            where event_id = $1
            order by created_at asc
          `,
          [eventId],
        )
      : await pool.query<RegistrationRow>(
          `
            select id, event_id, created_at, name, email, kind, party_size, total_items
            from event_registrations
            order by created_at asc
          `,
        );
    const itemResult = eventId
      ? await pool.query<ItemRow>(
          `
            select i.registration_id, i.item_id, i.label, i.quantity
            from event_registration_items i
            join event_registrations r on r.id = i.registration_id
            where r.event_id = $1
            order by r.created_at asc, i.item_id asc
          `,
          [eventId],
        )
      : await pool.query<ItemRow>(
          `
            select i.registration_id, i.item_id, i.label, i.quantity
            from event_registration_items i
            join event_registrations r on r.id = i.registration_id
            order by r.created_at asc, i.item_id asc
          `,
        );

    registrationRows = registrationResult.rows;
    itemRows = itemResult.rows;
  }

  const itemsByRegistration = new Map<string, EventRegistrationItem[]>();

  for (const item of itemRows) {
    const items = itemsByRegistration.get(item.registration_id) ?? [];
    items.push({
      registrationId: item.registration_id,
      itemId: item.item_id,
      label: item.label,
      quantity: item.quantity,
    });
    itemsByRegistration.set(item.registration_id, items);
  }

  return registrationRows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    createdAt: new Date(row.created_at).toISOString(),
    name: row.name,
    email: row.email,
    kind: row.kind,
    partySize: row.party_size,
    totalItems: row.total_items,
    items: itemsByRegistration.get(row.id) ?? [],
  }));
}

function matchesSignupQuery(
  signup: EventSignupWithItems,
  query: EventSignupAdminQuery,
): boolean {
  if (query.eventId && signup.eventId !== query.eventId) {
    return false;
  }

  if (query.kind && signup.kind !== query.kind) {
    return false;
  }

  if (query.createdAfter && signup.createdAt < query.createdAfter) {
    return false;
  }

  if (query.createdBefore && signup.createdAt > query.createdBefore) {
    return false;
  }

  if (query.q) {
    const q = query.q.toLowerCase();
    const haystack = `${signup.name} ${signup.email}`.toLowerCase();
    if (!haystack.includes(q)) {
      return false;
    }
  }

  return true;
}

function compareSignups(
  left: EventSignupWithItems,
  right: EventSignupWithItems,
  query: EventSignupAdminQuery,
): number {
  const direction = query.sortDirection === "asc" ? 1 : -1;

  if (query.sortBy === "name") {
    return (
      left.name.localeCompare(right.name, "de", { sensitivity: "base" }) *
      direction
    );
  }

  if (query.sortBy === "partySize") {
    return (left.partySize - right.partySize) * direction;
  }

  if (query.sortBy === "totalItems") {
    return (left.totalItems - right.totalItems) * direction;
  }

  return left.createdAt.localeCompare(right.createdAt) * direction;
}

export type EventSignupListResult = {
  rows: EventSignupWithItems[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type EventSignupStatsResult = {
  totalSignups: number;
  totalPartySize: number;
  totalItems: number;
  byEvent: Array<{
    eventId: string;
    signups: number;
    partySize: number;
    items: number;
  }>;
};

export async function listEventSignupsAdmin(
  query: EventSignupAdminQuery,
): Promise<EventSignupListResult> {
  const allRows = await listEventSignups();
  const filtered = allRows
    .filter((signup) => matchesSignupQuery(signup, query))
    .sort((a, b) => compareSignups(a, b, query));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(Math.max(query.page, 1), totalPages);
  const offset = (safePage - 1) * query.pageSize;
  const rows = filtered.slice(offset, offset + query.pageSize);

  return {
    rows,
    total,
    page: safePage,
    pageSize: query.pageSize,
    totalPages,
  };
}

export async function getEventSignupsStats(
  query: EventSignupAdminQuery,
): Promise<EventSignupStatsResult> {
  const allRows = await listEventSignups();
  const filtered = allRows.filter((signup) =>
    matchesSignupQuery(signup, query),
  );
  const byEventMap = new Map<
    string,
    { eventId: string; signups: number; partySize: number; items: number }
  >();

  let totalPartySize = 0;
  let totalItems = 0;
  for (const signup of filtered) {
    totalPartySize += signup.partySize;
    totalItems += signup.totalItems;

    const prev = byEventMap.get(signup.eventId) ?? {
      eventId: signup.eventId,
      signups: 0,
      partySize: 0,
      items: 0,
    };

    prev.signups += 1;
    prev.partySize += signup.partySize;
    prev.items += signup.totalItems;
    byEventMap.set(signup.eventId, prev);
  }

  return {
    totalSignups: filtered.length,
    totalPartySize,
    totalItems,
    byEvent: Array.from(byEventMap.values()).sort((a, b) =>
      a.eventId.localeCompare(b.eventId, "de", { sensitivity: "base" }),
    ),
  };
}

async function getRegistrationById(
  id: string,
): Promise<EventSignupWithItems | null> {
  const signups = await listEventSignups();
  return signups.find((signup) => signup.id === id) ?? null;
}

export async function updateEventSignupById(
  id: string,
  patch: EventSignupAdminPatch,
): Promise<EventSignupWithItems | null> {
  await ensureEventSignupSchema();
  const existing = await getRegistrationById(id);
  if (!existing) {
    return null;
  }

  const name = patch.name ?? existing.name;
  const email = patch.email ?? existing.email;
  const partySize = patch.partySize ?? existing.partySize;
  const itemsMap = patch.items;
  const nextItems = itemsMap
    ? existing.items
        .map((item) => ({
          ...item,
          quantity: itemsMap[item.itemId] ?? 0,
        }))
        .filter((item) => item.quantity > 0)
    : existing.items;
  const totalItems = nextItems.reduce((sum, item) => sum + item.quantity, 0);

  if (getDatabaseDriver() === "neon") {
    const sql = getSql();
    const itemRows = nextItems.map((item) => ({
      registrationId: id,
      itemId: item.itemId,
      label: item.label,
      quantity: item.quantity,
    }));

    const queries = [
      sql`
        update event_registrations
        set name = ${name},
            email = ${email},
            party_size = ${partySize},
            total_items = ${totalItems}
        where id = ${id}
      `,
      sql`
        delete from event_registration_items
        where registration_id = ${id}
      `,
      ...itemRows.map(
        (item) => sql`
          insert into event_registration_items (
            registration_id,
            item_id,
            label,
            quantity
          )
          values (
            ${item.registrationId},
            ${item.itemId},
            ${item.label},
            ${item.quantity}
          )
        `,
      ),
    ];

    await sql.transaction(queries);
  } else {
    const pool = getPgPool();
    const client = await pool.connect();

    try {
      await client.query("begin");
      await client.query(
        `
          update event_registrations
          set name = $1,
              email = $2,
              party_size = $3,
              total_items = $4
          where id = $5
        `,
        [name, email, partySize, totalItems, id],
      );

      await client.query(
        `
          delete from event_registration_items
          where registration_id = $1
        `,
        [id],
      );

      for (const item of nextItems) {
        await client.query(
          `
            insert into event_registration_items (
              registration_id,
              item_id,
              label,
              quantity
            )
            values ($1, $2, $3, $4)
          `,
          [id, item.itemId, item.label, item.quantity],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return getRegistrationById(id);
}

export async function deleteEventSignupById(id: string): Promise<boolean> {
  await ensureEventSignupSchema();

  if (getDatabaseDriver() === "neon") {
    const sql = getSql();
    const rows = await sql`
      delete from event_registrations
      where id = ${id}
      returning id
    `;

    return rows.length > 0;
  }

  const pool = getPgPool();
  const result = await pool.query<{ id: string }>(
    `
      delete from event_registrations
      where id = $1
      returning id
    `,
    [id],
  );

  return result.rowCount > 0;
}

export async function bulkDeleteEventSignups(ids: string[]): Promise<number> {
  await ensureEventSignupSchema();
  const uniqueIds = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean)),
  );

  if (uniqueIds.length === 0) {
    return 0;
  }

  if (getDatabaseDriver() === "neon") {
    const sql = getSql();
    const rows = await sql`
      delete from event_registrations
      where id = any(${uniqueIds}::text[])
      returning id
    `;

    return rows.length;
  }

  const pool = getPgPool();
  const result = await pool.query<{ id: string }>(
    `
      delete from event_registrations
      where id = any($1::text[])
      returning id
    `,
    [uniqueIds],
  );

  return result.rowCount;
}
