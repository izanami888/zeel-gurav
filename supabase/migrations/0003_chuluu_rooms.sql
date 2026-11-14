-- Online rooms for "Чулуу таалцах" (stone-guessing game).
-- Run this in the Supabase SQL editor, or via `supabase db push`.
-- Safe to run more than once.

-- 1) PUBLIC room state. Everyone may READ it (that is how players and
--    spectators follow the game live). It never contains how many stones a
--    player is hiding — only whether they have chosen yet (`hidden_done`).
--    The real numbers are copied into `revealed` only after every player has
--    guessed.
create table if not exists public.chuluu_rooms (
  id text primary key check (id ~ '^[A-Z0-9]{4,12}$'),

  settings jsonb not null,                      -- {startStones, maxHide, roundLimit}
  players jsonb not null default '[]'::jsonb,   -- [{name, stones, hash}] in seat order

  status text not null default 'lobby'
    check (status in ('lobby', 'playing', 'finished')),
  round integer not null default 0,
  guess_order jsonb not null default '[]'::jsonb,
  phase text check (phase in ('hide', 'guess', 'reveal')),
  hidden_done jsonb not null default '[]'::jsonb,
  guesses jsonb not null default '[]'::jsonb,   -- [{seat, value}] (value null = skipped)
  turn integer not null default 0,

  revealed jsonb,                               -- filled in only at the reveal
  outcome jsonb,
  result jsonb,

  turn_started_at timestamptz not null default now(),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chuluu_rooms_created_at_idx
  on public.chuluu_rooms (created_at);

alter table public.chuluu_rooms enable row level security;

drop policy if exists "Anyone can read chuluu rooms" on public.chuluu_rooms;
create policy "Anyone can read chuluu rooms"
  on public.chuluu_rooms for select
  to anon, authenticated
  using (true);

revoke all on public.chuluu_rooms from anon, authenticated;
grant select on public.chuluu_rooms to anon, authenticated;
grant all on public.chuluu_rooms to service_role;

-- 2) SECRET hands: how many stones each player hid this round.
--    Row Level Security is on and there is NO policy, and all privileges are
--    revoked from browser roles, so the anon key cannot read or write this
--    table at all. It is also NOT added to the Realtime publication.
--    Only the site's API routes (service_role key) touch it.
create table if not exists public.chuluu_hands (
  room_id text not null references public.chuluu_rooms (id) on delete cascade,
  round integer not null,
  seat integer not null,
  stones integer not null check (stones >= 0),
  created_at timestamptz not null default now(),
  primary key (room_id, round, seat)
);

alter table public.chuluu_hands enable row level security;
revoke all on public.chuluu_hands from anon, authenticated;
grant all on public.chuluu_hands to service_role;

-- 3) When each player was last seen (used to skip a disconnected player's
--    turn). Also private: no policy, no browser access.
create table if not exists public.chuluu_seen (
  room_id text not null references public.chuluu_rooms (id) on delete cascade,
  seat integer not null,
  seen_at timestamptz not null default now(),
  primary key (room_id, seat)
);

alter table public.chuluu_seen enable row level security;
revoke all on public.chuluu_seen from anon, authenticated;
grant all on public.chuluu_seen to service_role;

-- Send changes of the PUBLIC room row (only) to browsers through Realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'chuluu_rooms'
     )
  then
    alter publication supabase_realtime add table public.chuluu_rooms;
  end if;
end
$$;

-- Optional housekeeping (hands and seen rows are deleted with their room):
-- delete from public.chuluu_rooms where created_at < now() - interval '7 days';
