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
