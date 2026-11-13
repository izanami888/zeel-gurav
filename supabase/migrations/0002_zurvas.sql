-- "Нууц зурвас" — нэрээ нууцалсан зурвасын хүснэгтүүд.
-- Supabase SQL editor дээр ажиллуулна (эсвэл `supabase db push`).
--
-- Эдгээр хүснэгтэд зөвхөн сервер (service role key) хандана. RLS асаалттай,
-- ямар ч policy байхгүй тул anon/public key-ээр уншиж, бичих боломжгүй.

create table if not exists zurvas_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  prompt text check (char_length(prompt) <= 80),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists zurvas_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zurvas_users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  -- Илгээгчийн IP-ийн HMAC хэш (IP өөрөө хадгалагдахгүй). Давтамж хязгаарлах, блоклоход.
  sender_hash text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists zurvas_messages_inbox_idx
  on zurvas_messages (user_id, created_at desc);
create index if not exists zurvas_messages_sender_idx
  on zurvas_messages (sender_hash, created_at);

create table if not exists zurvas_blocks (
  user_id uuid not null references zurvas_users (id) on delete cascade,
  sender_hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, sender_hash)
);

alter table zurvas_users enable row level security;
alter table zurvas_messages enable row level security;
alter table zurvas_blocks enable row level security;
