create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  email text,
  notes text not null default '',
  status text not null default 'active',
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_status_check'
  ) then
    alter table public.customers
      add constraint customers_status_check
      check (status in ('active', 'inactive', 'archived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_contact_check'
  ) then
    alter table public.customers
      add constraint customers_contact_check
      check (
        btrim(first_name) <> ''
        or btrim(last_name) <> ''
        or btrim(coalesce(phone, '')) <> ''
        or btrim(coalesce(email, '')) <> ''
      );
  end if;
end
$$;

create index if not exists customers_status_idx
  on public.customers(status);

create index if not exists customers_name_idx
  on public.customers(lower(last_name), lower(first_name));

create index if not exists customers_email_lower_idx
  on public.customers(lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists customers_phone_digits_idx
  on public.customers(regexp_replace(phone, '[^0-9]+', '', 'g'))
  where phone is not null and btrim(phone) <> '';

create or replace function public.set_customers_updated_at()
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

drop trigger if exists customers_set_updated_at on public.customers;

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_customers_updated_at();

alter table public.customers enable row level security;

drop policy if exists "Authenticated users can select customers"
  on public.customers;
drop policy if exists "Authenticated users can insert customers"
  on public.customers;
drop policy if exists "Authenticated users can update customers"
  on public.customers;
drop policy if exists "Authenticated users can delete customers"
  on public.customers;

create policy "Authenticated users can select customers"
on public.customers
for select
to authenticated
using (true);

create policy "Authenticated users can insert customers"
on public.customers
for insert
to authenticated
with check (true);

create policy "Authenticated users can update customers"
on public.customers
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete customers"
on public.customers
for delete
to authenticated
using (true);
