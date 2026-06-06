-- Add google_account_id and email columns
alter table google_ads_tokens
  add column if not exists google_account_id text,
  add column if not exists google_account_email text;

-- Drop old unique constraint (user_id only)
alter table google_ads_tokens drop constraint if exists google_ads_tokens_user_id_key;

-- New unique constraint: one token per Google account per user
alter table google_ads_tokens
  add constraint google_ads_tokens_user_google_key
  unique (user_id, google_account_id);

-- Backfill existing rows with a placeholder so constraint doesn't fail
update google_ads_tokens
  set google_account_id = 'unknown_' || id::text
  where google_account_id is null;

alter table google_ads_tokens
  alter column google_account_id set not null;
