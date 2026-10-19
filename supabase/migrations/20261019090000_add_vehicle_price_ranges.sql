do $$
declare
  price_column record;
  source_type text;
begin
  for price_column in
    select *
    from (
      values
        ('buy_estimate', 'buy_estimate_max'),
        ('customer_expected_price', 'customer_expected_price_max'),
        ('sale_estimate', 'sale_estimate_max'),
        ('approved_price', 'approved_price_max')
    ) as columns(source_name, target_name)
  loop
    select format_type(attribute.atttypid, attribute.atttypmod)
      into source_type
    from pg_attribute as attribute
    where attribute.attrelid = 'public.cars'::regclass
      and attribute.attname = price_column.source_name
      and not attribute.attisdropped;

    if source_type is null then
      raise exception 'Missing source price column: %', price_column.source_name;
    end if;

    execute format(
      'alter table public.cars add column if not exists %I %s',
      price_column.target_name,
      source_type
    );
  end loop;
end
$$;

alter table public.cars
  drop constraint if exists cars_buy_estimate_range_check,
  add constraint cars_buy_estimate_range_check check (
    buy_estimate_max is null
    or (
      buy_estimate is not null
      and trim(buy_estimate::text)::numeric
        <= trim(buy_estimate_max::text)::numeric
    )
  ),
  drop constraint if exists cars_customer_expected_price_range_check,
  add constraint cars_customer_expected_price_range_check check (
    customer_expected_price_max is null
    or (
      customer_expected_price is not null
      and trim(customer_expected_price::text)::numeric
        <= trim(customer_expected_price_max::text)::numeric
    )
  ),
  drop constraint if exists cars_sale_estimate_range_check,
  add constraint cars_sale_estimate_range_check check (
    sale_estimate_max is null
    or (
      sale_estimate is not null
      and trim(sale_estimate::text)::numeric
        <= trim(sale_estimate_max::text)::numeric
    )
  ),
  drop constraint if exists cars_approved_price_range_check,
  add constraint cars_approved_price_range_check check (
    approved_price_max is null
    or (
      approved_price is not null
      and trim(approved_price::text)::numeric
        <= trim(approved_price_max::text)::numeric
    )
  );
