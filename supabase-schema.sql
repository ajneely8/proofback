-- Run this once in the Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query).
-- Stores each purchase/settings row as JSON rather than one column per field,
-- since the purchase shape has grown a lot over this app's development and
-- will likely keep growing -- a rigid column-per-field schema would need a
-- migration every time a new field is added client-side.

create table if not exists public.purchases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  purchase_date date,
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on public.purchases(user_id);

alter table public.purchases enable row level security;

create policy "Users can view their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "Users can insert their own purchases"
  on public.purchases for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own purchases"
  on public.purchases for update
  using (auth.uid() = user_id);

create policy "Users can delete their own purchases"
  on public.purchases for delete
  using (auth.uid() = user_id);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- Tracks scans per user per calendar month, to enforce the free-tier limit.
-- Deliberately has a SELECT policy (so Profile can show "3 of 5 used") but
-- no INSERT/UPDATE policy for regular users — only the server, using the
-- service role key (which bypasses RLS entirely), is allowed to increment
-- it. Otherwise a user could just reset their own usage from the browser.
create table if not exists public.scan_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  count int not null default 0,
  primary key (user_id, month)
);

alter table public.scan_usage enable row level security;

create policy "Users can view their own scan usage"
  on public.scan_usage for select
  using (auth.uid() = user_id);
