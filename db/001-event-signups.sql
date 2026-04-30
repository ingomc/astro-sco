create table if not exists event_registrations (
  id text primary key,
  event_id text not null,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  ip_fingerprint text not null default '',
  privacy_accepted_at timestamptz,
  slot_at timestamptz,
  slot_label text not null default '',
  notes text not null default '',
  notes_done boolean not null default false,
  kind text not null check (kind in ('registration', 'order', 'both')),
  party_size integer not null default 1 check (party_size >= 1),
  total_items integer not null default 0 check (total_items >= 0)
);

create table if not exists event_registration_items (
  registration_id text not null references event_registrations(id) on delete cascade,
  item_id text not null,
  label text not null,
  quantity integer not null check (quantity > 0),
  primary key (registration_id, item_id)
);

create index if not exists event_registrations_event_id_created_at_idx
  on event_registrations(event_id, created_at);
