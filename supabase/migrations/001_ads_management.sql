-- Google Ads OAuth tokens
create table if not exists google_ads_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

alter table google_ads_tokens enable row level security;
create policy "Users manage own tokens" on google_ads_tokens
  for all using (auth.uid() = user_id);

-- Projects (one per app, only for users with Google Ads connected)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  app_url text,
  target_user text,
  usps text,
  created_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id);

-- Link creative label → Google Ads campaign
create table if not exists campaign_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  generation_id uuid references generations(id) on delete cascade,
  label text not null,
  customer_id text not null,
  campaign_id text not null,
  campaign_name text,
  created_at timestamptz default now(),
  unique(user_id, label)
);

alter table campaign_links enable row level security;
create policy "Users manage own campaign links" on campaign_links
  for all using (auth.uid() = user_id);

-- Add label + project_id to existing generations table
alter table generations
  add column if not exists label text,
  add column if not exists project_id uuid references projects(id) on delete set null;

create unique index if not exists generations_label_idx on generations(label) where label is not null;
