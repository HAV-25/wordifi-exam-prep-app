create table if not exists public.push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  onesignal_player_id text not null,
  platform        text not null check (platform in ('android', 'ios')),
  app_version     text not null default 'unknown',
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  unique (user_id, onesignal_player_id)
);

alter table public.push_tokens enable row level security;

-- Users can only read/write their own tokens
create policy "push_tokens: user owns row"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for server-side lookups by user
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
