alter table public.tire_sets
add column if not exists dot_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tire_sets'::regclass
      and conname = 'tire_sets_dot_code_check'
  ) then
    alter table public.tire_sets
      add constraint tire_sets_dot_code_check
      check (
        dot_code is null
        or dot_code ~ '^(0[1-9]|[1-4][0-9]|5[0-3])[0-9]{2}$'
      );
  end if;
end
$$;
