-- ============================================================
-- Telegram notifications:
--  - telegram_links: mỗi user một row, lưu chat_id của bot chat.
--    link_code là mã dùng một lần cho deep-link t.me/<bot>?start=<code>
--  - notification_rules: rule thông báo số liệu (ROAS/spend theo
--    ngày/tuần/tháng, có/không điều kiện ngưỡng)
-- Chạy file này trong Supabase SQL Editor SAU migration 004
-- ============================================================

create table if not exists telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint,
  telegram_username text,
  link_code text unique,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table telegram_links enable row level security;

-- Client chỉ đọc trạng thái liên kết; mọi ghi đều qua service role
-- (route /api/telegram/link và webhook của bot)
drop policy if exists "Users read own telegram link" on telegram_links;
create policy "Users read own telegram link" on telegram_links
  for select using (auth.uid() = user_id);

create table if not exists notification_rules (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('roas', 'spend')),
  period text not null check (period in ('day', 'week', 'month')),
  -- comparator + threshold null = luôn gửi báo cáo định kỳ;
  -- có giá trị = chỉ gửi khi thỏa điều kiện (vd roas > 1)
  comparator text check (comparator in ('gt', 'gte', 'lt', 'lte')),
  threshold numeric(14, 2),
  -- null = tổng mọi account đang tracked; khác null = một account cụ thể
  customer_id text,
  enabled boolean not null default true,
  -- chống gửi trùng khi cron chạy lại trong cùng kỳ
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((comparator is null) = (threshold is null))
);

create index if not exists notification_rules_user_idx on notification_rules (user_id);

alter table notification_rules enable row level security;

-- User tự quản lý rule của mình từ trang Settings;
-- last_sent_at do cron ghi qua service role (bypass RLS)
drop policy if exists "Users manage own notification rules" on notification_rules;
create policy "Users manage own notification rules" on notification_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
