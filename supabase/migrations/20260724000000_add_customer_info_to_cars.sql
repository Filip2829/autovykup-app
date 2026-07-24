alter table public.cars
  add column if not exists customer_info jsonb not null default '{}'::jsonb;

comment on column public.cars.customer_info is
  'Contact details for the customer associated with this vehicle.';
