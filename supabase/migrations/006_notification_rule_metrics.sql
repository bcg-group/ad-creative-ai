-- ============================================================
-- Mở rộng metric cho notification_rules: thêm conversions,
-- conversions_value, cpi, cpc, ctr, clicks, impressions
-- (đều tính được từ campaign_snapshots)
-- Chạy file này trong Supabase SQL Editor SAU migration 005
-- ============================================================

alter table notification_rules
  drop constraint if exists notification_rules_metric_check;

alter table notification_rules
  add constraint notification_rules_metric_check
  check (metric in (
    'roas', 'spend', 'conversions', 'conversions_value',
    'cpi', 'cpc', 'ctr', 'clicks', 'impressions'
  ));
