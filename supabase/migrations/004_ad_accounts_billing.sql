-- ============================================================
-- Thêm thông tin billing_setup vào ad_accounts
-- (trạng thái thanh toán + tài khoản thanh toán Google Payments)
-- Chạy file này trong Supabase SQL Editor SAU migration 003
-- ============================================================

alter table ad_accounts
  add column if not exists billing_status text,
  add column if not exists payments_account_id text,
  add column if not exists payments_account_name text;
