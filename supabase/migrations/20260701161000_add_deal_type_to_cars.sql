alter table public.cars
add column if not exists deal_type text,
add column if not exists trade_in_source text;
