create table if not exists public.auction_vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('Renault', 'Dacia')),
  model text not null,
  trim text,
  year integer not null check (year between 1990 and 2100),
  mileage_km integer not null check (mileage_km >= 0),
  fuel text not null,
  transmission text not null,
  location text not null,
  price_czk integer not null check (price_czk > 0 and price_czk <= 500000),
  source_name text not null,
  source_url text,
  original_auction_url text not null unique,
  vin text unique check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  auction_ends_at timestamptz,
  expected_sale_price_czk integer check (expected_sale_price_czk is null or expected_sale_price_czk > 0),
  auction_fee_czk integer not null default 0 check (auction_fee_czk >= 0),
  transport_cost_czk integer not null default 0 check (transport_cost_czk >= 0),
  preparation_cost_czk integer not null default 0 check (preparation_cost_czk >= 0),
  target_profit_czk integer not null default 30000 check (target_profit_czk >= 0),
  summary text not null,
  positives jsonb not null default '[]'::jsonb check (jsonb_typeof(positives) = 'array'),
  negatives jsonb not null default '[]'::jsonb check (jsonb_typeof(negatives) = 'array'),
  decision text not null default 'undecided' check (decision in ('undecided', 'suitable', 'watchlist', 'rejected')),
  last_verified_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auction_vehicles_deadline_idx on public.auction_vehicles(auction_ends_at);
create index if not exists auction_vehicles_decision_idx on public.auction_vehicles(decision, created_at desc);

create or replace function public.set_auction_vehicle_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists auction_vehicles_updated_at on public.auction_vehicles;
create trigger auction_vehicles_updated_at before update on public.auction_vehicles
for each row execute function public.set_auction_vehicle_updated_at();

alter table public.auction_vehicles enable row level security;

create policy "Authenticated users can read auction vehicles" on public.auction_vehicles
for select to authenticated using (true);
create policy "Authenticated users can create auction vehicles" on public.auction_vehicles
for insert to authenticated with check (created_by = auth.uid());
create policy "Authenticated users can update auction vehicles" on public.auction_vehicles
for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete auction vehicles" on public.auction_vehicles
for delete to authenticated using (true);

grant select, insert, update, delete on public.auction_vehicles to authenticated;
