-- ============================================================
-- Ad accounts: cây tài khoản Google Ads (MCC + sub-accounts) lưu trong DB
-- để dashboard/asset report không phải traverse API mỗi request,
-- và để user bật/tắt theo dõi từng account.
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

create table if not exists ad_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_account_email text not null,
  customer_id text not null,
  name text,
  currency text,
  timezone text,
  is_manager boolean not null default false,
  status text,
  -- MCC cha trực tiếp; null nếu là account truy cập trực tiếp (top-level)
  parent_customer_id text,
  -- MCC gốc dùng làm login-customer-id khi query; null nếu truy cập trực tiếp
  login_customer_id text,
  level int not null default 0,
  -- user tắt tracked để loại account khỏi dashboard + snapshot cron
  tracked boolean not null default true,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, customer_id)
);

create index if not exists ad_accounts_user_idx on ad_accounts (user_id);

alter table ad_accounts enable row level security;

-- Client đọc + đổi tracked; ghi dữ liệu sync luôn qua service role
drop policy if exists "Users read own ad accounts" on ad_accounts;
create policy "Users read own ad accounts" on ad_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "Users update own ad accounts" on ad_accounts;
create policy "Users update own ad accounts" on ad_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
