-- Online rooms for "Морь уралдуулах" (shagai horse racing).
-- Run this in the Supabase SQL editor, or via `supabase db push`.
-- Safe to run more than once.

-- 1) PUBLIC room state. Everyone may READ it (that is how players and
--    spectators follow the race live). Nobody can write it from a browser:
--    every change goes through the site's API routes (app/api/mori/rooms),
--    which check whose turn it is and roll the shagai ON THE SERVER, then
--    write with the service_role key.
create table if not exists public.mori_rooms (
  -- Short room code shown in the link / QR code, e.g. "K7M2QX".
  id text primary key check (id ~ '^[A-Z0-9]{4,12}$'),

  settings jsonb not null,                      -- {trackLength, pushRule}
  -- [{name, hash}] in seat order. `hash` is the SHA-256 of the player's
  -- secret ID, so reading this table does not let anyone play as them.
  players jsonb not null default '[]'::jsonb,

  -- lobby -> opening (roll to decide who starts) -> race -> finished
  status text not null default 'lobby'
    check (status in ('lobby', 'opening', 'race', 'finished')),
  opening jsonb,                                -- {round, contenders, rolls, tie}
  positions jsonb not null default '[]'::jsonb,     -- space of each seat's horse
  finish_order jsonb not null default '[]'::jsonb,  -- seats in finishing order
  turn integer not null default 0,              -- seat that rolls next

  -- The latest roll, decided by the server. Browsers animate from it.
  roll_seq integer not null default 0,
  last_roll jsonb,

  turn_started_at timestamptz not null default now(),
  -- Incremented on every change; used for optimistic locking.
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mori_rooms_created_at_idx
  on public.mori_rooms (created_at);

alter table public.mori_rooms enable row level security;

drop policy if exists "Anyone can read mori rooms" on public.mori_rooms;
create policy "Anyone can read mori rooms"
  on public.mori_rooms for select
  to anon, authenticated
  using (true);

revoke all on public.mori_rooms from anon, authenticated;
grant select on public.mori_rooms to anon, authenticated;
grant all on public.mori_rooms to service_role;

-- 2) When each player was last seen (used to roll for a player who has
--    disconnected). Private: Row Level Security is on with NO policy and all
--    privileges are revoked from browser roles, so the anon key cannot read
--    or write it. It is NOT added to the Realtime publication.
create table if not exists public.mori_seen (
  room_id text not null references public.mori_rooms (id) on delete cascade,
  seat integer not null,
  seen_at timestamptz not null default now(),
  primary key (room_id, seat)
);

alter table public.mori_seen enable row level security;
revoke all on public.mori_seen from anon, authenticated;
grant all on public.mori_seen to service_role;

-- Send changes of the PUBLIC room row (only) to browsers through Realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'mori_rooms'
     )
  then
    alter publication supabase_realtime add table public.mori_rooms;
  end if;
end
$$;

-- Optional housekeeping (seen rows are deleted with their room):
-- delete from public.mori_rooms where created_at < now() - interval '7 days';
