create table if not exists public.customer_vehicle_matches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_demand_id uuid not null references public.customer_demands(id) on delete cascade,
  car_id bigint not null references public.cars(id) on delete cascade,
  score integer not null,
  level text not null,
  matched_criteria jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  failed_criteria jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_matched_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_vehicle_matches'::regclass
      and conname = 'customer_vehicle_matches_score_check'
  ) then
    alter table public.customer_vehicle_matches
      add constraint customer_vehicle_matches_score_check
      check (score between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_vehicle_matches'::regclass
      and conname = 'customer_vehicle_matches_level_check'
  ) then
    alter table public.customer_vehicle_matches
      add constraint customer_vehicle_matches_level_check
      check (level in ('excellent', 'good', 'possible', 'poor'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_vehicle_matches'::regclass
      and conname = 'customer_vehicle_matches_status_check'
  ) then
    alter table public.customer_vehicle_matches
      add constraint customer_vehicle_matches_status_check
      check (status in ('new', 'reviewed', 'contacted', 'dismissed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_vehicle_matches'::regclass
      and conname = 'customer_vehicle_matches_demand_car_key'
  ) then
    alter table public.customer_vehicle_matches
      add constraint customer_vehicle_matches_demand_car_key
      unique (customer_demand_id, car_id);
  end if;
end
$$;

create index if not exists customer_vehicle_matches_customer_id_idx
  on public.customer_vehicle_matches (customer_id);

create index if not exists customer_vehicle_matches_customer_demand_id_idx
  on public.customer_vehicle_matches (customer_demand_id);

create index if not exists customer_vehicle_matches_car_id_idx
  on public.customer_vehicle_matches (car_id);

create index if not exists customer_vehicle_matches_status_idx
  on public.customer_vehicle_matches (status);

create index if not exists customer_vehicle_matches_last_matched_at_idx
  on public.customer_vehicle_matches (last_matched_at desc);

create or replace function public.set_customer_vehicle_matches_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_customer_vehicle_matches_updated_at
  on public.customer_vehicle_matches;

create trigger set_customer_vehicle_matches_updated_at
before update on public.customer_vehicle_matches
for each row
execute function public.set_customer_vehicle_matches_updated_at();

alter table public.customer_vehicle_matches enable row level security;

drop policy if exists "Authenticated users can read customer vehicle matches"
  on public.customer_vehicle_matches;
create policy "Authenticated users can read customer vehicle matches"
  on public.customer_vehicle_matches
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create customer vehicle matches"
  on public.customer_vehicle_matches;
create policy "Authenticated users can create customer vehicle matches"
  on public.customer_vehicle_matches
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update customer vehicle matches"
  on public.customer_vehicle_matches;
create policy "Authenticated users can update customer vehicle matches"
  on public.customer_vehicle_matches
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete customer vehicle matches"
  on public.customer_vehicle_matches;
create policy "Authenticated users can delete customer vehicle matches"
  on public.customer_vehicle_matches
  for delete
  to authenticated
  using (true);
