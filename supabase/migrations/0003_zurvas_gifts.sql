-- "Нууц зурвас" — бэлэг (кофе) ба түнш кофе шопууд.
-- 0002_zurvas.sql-ийн дараа ажиллуулна.
-- Эдгээр хүснэгтэд зөвхөн сервер (service role key) хандана.

create table if not exists zurvas_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Түншийн нууц кодын SHA-256 хэш (hex). Код өөрөө хадгалагдахгүй.
  code_hash text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists zurvas_gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zurvas_users (id) on delete cascade,
  product_id text not null,
  amount_mnt integer not null check (amount_mnt > 0),
  sender_name text check (char_length(sender_name) <= 40), -- null = нэрээ нууцалсан
  sender_verified boolean not null default false,
  note text check (char_length(note) <= 200),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'redeemed')),
  payment_provider text not null,
  payment_ref text,
  redeem_code text unique,
  paid_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references zurvas_partners (id),
  created_at timestamptz not null default now()
);

create index if not exists zurvas_gifts_inbox_idx
  on zurvas_gifts (user_id, status, paid_at desc);

alter table zurvas_partners enable row level security;
alter table zurvas_gifts enable row level security;

-- Түнш кофе шоп нэмэх жишээ (кодыг урт, таахад хэцүү болгоорой):
-- insert into zurvas_partners (name, code_hash)
-- values ('Жишээ Кофе Шоп', encode(sha256('MY-SECRET-PARTNER-CODE'::bytea), 'hex'));
