create table if not exists public.tire_sets (
  id uuid primary key default gen_random_uuid(),
  storage_number integer not null,
  name text not null,
  tire_size text not null default '',
  tread_depth_mm numeric(4,1),
  season text not null,
  assembly_type text not null,
  bolt_pattern text,
  et integer,
  quantity integer not null default 4,
  status text not null default 'in_stock',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_storage_number_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_storage_number_check
      check (storage_number between 1 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_name_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_name_check
      check (btrim(name) <> '');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_season_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_season_check
      check (season in ('summer', 'winter', 'all_season'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_assembly_type_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_assembly_type_check
      check (assembly_type in ('tires_only', 'steel_wheels', 'alloy_wheels'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_status_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_status_check
      check (status in ('in_stock', 'reserved', 'retired'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_tread_depth_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_tread_depth_check
      check (tread_depth_mm is null or tread_depth_mm >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_quantity_check'
  ) then
    alter table public.tire_sets add constraint tire_sets_quantity_check
      check (quantity between 1 and 20);
  end if;
end
$$;

create unique index if not exists tire_sets_active_storage_number_idx
  on public.tire_sets(storage_number)
  where status <> 'retired';

create index if not exists tire_sets_status_idx
  on public.tire_sets(status);

create index if not exists tire_sets_season_idx
  on public.tire_sets(season);

create or replace function public.set_tire_sets_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists tire_sets_set_updated_at on public.tire_sets;

create trigger tire_sets_set_updated_at
before update on public.tire_sets
for each row
execute function public.set_tire_sets_updated_at();

alter table public.tire_sets enable row level security;

drop policy if exists "Authenticated users can select tire sets" on public.tire_sets;
drop policy if exists "Authenticated users can insert tire sets" on public.tire_sets;
drop policy if exists "Authenticated users can update tire sets" on public.tire_sets;
drop policy if exists "Authenticated users can delete tire sets" on public.tire_sets;

create policy "Authenticated users can select tire sets"
on public.tire_sets for select to authenticated using (true);

create policy "Authenticated users can insert tire sets"
on public.tire_sets for insert to authenticated with check (true);

create policy "Authenticated users can update tire sets"
on public.tire_sets for update to authenticated using (true) with check (true);
