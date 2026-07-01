alter table public.cars
add column if not exists trade_in_source text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cars'
      and column_name = 'deal_source'
  ) then
    update public.cars
    set trade_in_source = coalesce(nullif(trade_in_source, ''), deal_source)
    where deal_source is not null;

    alter table public.cars
    drop column deal_source;
  end if;
end $$;
