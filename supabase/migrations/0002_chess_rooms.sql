-- Online chess rooms (Шатар — онлайн горим).
-- Run this in the Supabase SQL editor, or via `supabase db push`.
-- Safe to run more than once.

create table if not exists public.chess_rooms (
  -- Short room code shown in the link / QR code, e.g. "K7M2QX".
  id text primary key check (id ~ '^[A-Z0-9]{4,12}$'),

  -- Game state. `moves` is the full move list ([{from,to,promotion}, ...]);
  -- `fen` is the current position derived from it.
  fen text not null,
  moves jsonb not null default '[]'::jsonb,

  -- Players. We never store the player's secret ID, only its SHA-256 hash,
  -- so reading this table does not let anyone impersonate a player.
  white_player_hash text,
  black_player_hash text,

  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished')),
  result text
    check (result in ('checkmate', 'stalemate', 'insufficient', 'repetition',
                      'fifty', 'draw', 'resign', 'agreement')),
  winner text check (winner in ('w', 'b')),
  draw_offer_by text check (draw_offer_by in ('w', 'b')),

  -- Incremented on every change; used for optimistic locking.
  version integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chess_rooms_created_at_idx
  on public.chess_rooms (created_at);

-- Row Level Security.
-- Browsers (the anon key) may only READ rooms: that is what lets both
-- players and spectators follow a game live. There is deliberately no
-- insert/update/delete policy, so nobody can change a room from the browser.
-- All writes go through the site's API routes (app/api/chess/rooms), which
-- check the player's ID, check the move with chess.js, and then write using
-- the service_role key (which bypasses RLS).
alter table public.chess_rooms enable row level security;

drop policy if exists "Anyone can read chess rooms" on public.chess_rooms;
create policy "Anyone can read chess rooms"
  on public.chess_rooms for select
  to anon, authenticated
  using (true);

revoke all on public.chess_rooms from anon, authenticated;
grant select on public.chess_rooms to anon, authenticated;
grant all on public.chess_rooms to service_role;

-- Send row changes to subscribed browsers through Supabase Realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'chess_rooms'
     )
  then
    alter publication supabase_realtime add table public.chess_rooms;
  end if;
end
$$;

-- Optional housekeeping: delete rooms older than 7 days.
-- delete from public.chess_rooms where created_at < now() - interval '7 days';
