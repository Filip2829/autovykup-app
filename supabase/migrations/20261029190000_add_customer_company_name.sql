alter table public.customers
  add column if not exists company_name text;

comment on column public.customers.company_name is
  'Optional company name associated with the customer.';
