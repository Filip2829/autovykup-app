create table if not exists public.customer_demands (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  status text not null default 'active',
  priority text not null default 'normal',
  notes text,
  min_price numeric,
  max_price numeric,
  makes text[] not null default '{}'::text[],
  models text[] not null default '{}'::text[],
  body_types text[] not null default '{}'::text[],
  fuel_types text[] not null default '{}'::text[],
  transmissions text[] not null default '{}'::text[],
  drivetrains text[] not null default '{}'::text[],
  min_year integer,
  max_year integer,
  max_mileage integer,
  min_power_kw integer,
  max_power_kw integer,
  required_equipment text[] not null default '{}'::text[],
  preferred_equipment text[] not null default '{}'::text[],
  preferred_colors text[] not null default '{}'::text[],
  excluded_colors text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_demands'::regclass
      and conname = 'customer_demands_status_check'
  ) then
    alter table public.customer_demands
      add constraint customer_demands_status_check
      check (status in ('active', 'paused', 'fulfilled', 'cancelled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_demands'::regclass
      and conname = 'customer_demands_priority_check'
  ) then
    alter table public.customer_demands
      add constraint customer_demands_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_demands'::regclass
      and conname = 'customer_demands_non_negative_check'
  ) then
    alter table public.customer_demands
      add constraint customer_demands_non_negative_check
      check (
        (min_price is null or min_price >= 0)
        and (max_price is null or max_price >= 0)
        and (min_year is null or min_year >= 0)
        and (max_year is null or max_year >= 0)
        and (max_mileage is null or max_mileage >= 0)
        and (min_power_kw is null or min_power_kw >= 0)
        and (max_power_kw is null or max_power_kw >= 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_demands'::regclass
      and conname = 'customer_demands_ranges_check'
  ) then
    alter table public.customer_demands
      add constraint customer_demands_ranges_check
      check (
        (min_price is null or max_price is null or min_price <= max_price)
        and (min_year is null or max_year is null or min_year <= max_year)
        and (
          min_power_kw is null
          or max_power_kw is null
          or min_power_kw <= max_power_kw
        )
      );
  end if;
end
$$;

create index if not exists customer_demands_customer_id_idx
  on public.customer_demands(customer_id);

create index if not exists customer_demands_status_idx
  on public.customer_demands(status);

create or replace function public.set_customer_demands_updated_at()
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

drop trigger if exists customer_demands_set_updated_at
  on public.customer_demands;

create trigger customer_demands_set_updated_at
before update on public.customer_demands
for each row
execute function public.set_customer_demands_updated_at();

alter table public.customer_demands enable row level security;

drop policy if exists "Authenticated users can select customer demands"
  on public.customer_demands;
drop policy if exists "Authenticated users can insert customer demands"
  on public.customer_demands;
drop policy if exists "Authenticated users can update customer demands"
  on public.customer_demands;
drop policy if exists "Authenticated users can delete customer demands"
  on public.customer_demands;

create policy "Authenticated users can select customer demands"
on public.customer_demands
for select
to authenticated
using (true);

create policy "Authenticated users can insert customer demands"
on public.customer_demands
for insert
to authenticated
with check (true);

create policy "Authenticated users can update customer demands"
on public.customer_demands
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete customer demands"
on public.customer_demands
for delete
to authenticated
using (true);
