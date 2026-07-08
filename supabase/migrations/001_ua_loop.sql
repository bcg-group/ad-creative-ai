-- ============================================================
-- UA Loop: fix campaign_links schema
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- Thêm google_account_email vào campaign_links (để query performance sau này)
alter table campaign_links
  add column if not exists google_account_email text;

-- Xóa unique(user_id, label) cũ — cản trở linking nhiều campaign vào 1 creative
alter table campaign_links
  drop constraint if exists campaign_links_user_id_label_key;

-- Unique mới: 1 generation chỉ link 1 lần với 1 campaign cụ thể
alter table campaign_links
  add constraint if not exists campaign_links_generation_campaign_unique
  unique (generation_id, campaign_id);

-- label không cần NOT NULL nữa (nếu link trực tiếp từ generation_id)
alter table campaign_links
  alter column label drop not null;
