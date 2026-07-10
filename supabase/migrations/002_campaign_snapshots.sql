-- ============================================================
-- Campaign snapshots: số liệu campaign theo từng ngày
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

create table if not exists campaign_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_account_email text not null,
  customer_id text not null,
  account_name text,
  currency text,
  campaign_id text not null,
  campaign_name text not null,
  status text,
  snapshot_date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric(14, 2) not null default 0,
  conversions numeric(12, 2) not null default 0,
  conversions_value numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, customer_id, campaign_id, snapshot_date)
);

create index if not exists campaign_snapshots_user_date_idx
  on campaign_snapshots (user_id, snapshot_date desc);

alter table campaign_snapshots enable row level security;

-- Client chỉ đọc; ghi luôn qua service role (cron / sync route)
drop policy if exists "Users read own snapshots" on campaign_snapshots;
create policy "Users read own snapshots" on campaign_snapshots
  for select using (auth.uid() = user_id);
