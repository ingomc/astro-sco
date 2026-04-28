import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import type {
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
  const databaseUrl = getEnvVar("DATABASE_URL");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
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
    registrationRows = (eventId
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
        `) as RegistrationRow[];

    itemRows = (eventId
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
        `) as ItemRow[];
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
