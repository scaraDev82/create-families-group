-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  last_name text not null,
  address text not null,
  phone text not null,
  has_dog text not null check (has_dog in ('in', 'out', 'none')),
  has_cat text not null check (has_cat in ('in', 'out', 'none')),
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  professores integer not null default 0,
  drivers integer not null default 0,
  target_kids integer not null default 0,
  arrival_date date not null,
  departure_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_dates check (arrival_date <= departure_date)
);

create table if not exists public.group_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  boys integer not null default 0,
  girls integer not null default 0,
  created_at timestamptz not null default now(),
  constraint group_entries_non_negative check (boys >= 0 and girls >= 0),
  constraint group_entries_unique_family_per_group unique (group_id, family_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_groups_updated_at on public.groups;
create trigger trg_groups_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

alter table public.families enable row level security;
alter table public.groups enable row level security;
alter table public.group_entries enable row level security;

drop policy if exists families_select_own on public.families;
create policy families_select_own on public.families
for select using (auth.uid() = user_id);

drop policy if exists families_insert_own on public.families;
create policy families_insert_own on public.families
for insert with check (auth.uid() = user_id);

drop policy if exists families_update_own on public.families;
create policy families_update_own on public.families
for update using (auth.uid() = user_id);

drop policy if exists families_delete_own on public.families;
create policy families_delete_own on public.families
for delete using (auth.uid() = user_id);

drop policy if exists groups_select_own on public.groups;
create policy groups_select_own on public.groups
for select using (auth.uid() = user_id);

drop policy if exists groups_insert_own on public.groups;
create policy groups_insert_own on public.groups
for insert with check (auth.uid() = user_id);

drop policy if exists groups_update_own on public.groups;
create policy groups_update_own on public.groups
for update using (auth.uid() = user_id);

drop policy if exists groups_delete_own on public.groups;
create policy groups_delete_own on public.groups
for delete using (auth.uid() = user_id);

drop policy if exists group_entries_select_own on public.group_entries;
create policy group_entries_select_own on public.group_entries
for select using (auth.uid() = user_id);

drop policy if exists group_entries_insert_own on public.group_entries;
create policy group_entries_insert_own on public.group_entries
for insert with check (auth.uid() = user_id);

drop policy if exists group_entries_update_own on public.group_entries;
create policy group_entries_update_own on public.group_entries
for update using (auth.uid() = user_id);

drop policy if exists group_entries_delete_own on public.group_entries;
create policy group_entries_delete_own on public.group_entries
for delete using (auth.uid() = user_id);
