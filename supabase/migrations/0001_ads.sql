-- Ads system: local company banners shown between/around games.
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create type ad_placement as enum ('homepage', 'result_screen');

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  image_url text not null,
  link_url text not null,
  placement ad_placement not null default 'homepage',
  active boolean not null default true,
  start_date date,
  end_date date,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ads_placement_active_idx on ads (placement, active);

-- Row Level Security: anon (public) clients may only READ active ads
-- within their date window, and bump impressions/clicks via RPC below.
-- Full CRUD (creating/editing ads) should go through an authenticated
-- admin role — see the TODO in components/AdBanner.tsx for a future
-- /admin/ads management page.
alter table ads enable row level security;

create policy "Public can read active ads"
  on ads for select
  to anon
  using (
    active = true
    and (start_date is null or start_date <= current_date)
    and (end_date is null or end_date >= current_date)
  );

-- Atomic counters so concurrent page views don't race/lose updates.
create or replace function increment_ad_impressions(ad_id uuid)
returns void
language sql
security definer
as $$
  update ads set impressions = impressions + 1 where id = ad_id;
$$;

create or replace function increment_ad_clicks(ad_id uuid)
returns void
language sql
security definer
as $$
  update ads set clicks = clicks + 1 where id = ad_id;
$$;

grant execute on function increment_ad_impressions(uuid) to anon;
grant execute on function increment_ad_clicks(uuid) to anon;

-- Жишээ өгөгдөл (заавал биш):
-- insert into ads (company_name, image_url, link_url, placement)
-- values ('Жишээ ХХК', 'https://placehold.co/728x90', 'https://example.com', 'homepage');
