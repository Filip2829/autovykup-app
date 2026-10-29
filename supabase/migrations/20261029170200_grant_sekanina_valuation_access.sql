-- Grant only Adam Sekanina's existing Auth account access to the internal
-- online-valuation inbox. The exact email lookup avoids mutable user metadata
-- and deliberately fails if the account is missing or duplicated.
do $$
declare
  target_user_id uuid;
begin
  select id
    into strict target_user_id
  from auth.users
  where lower(email) = 'sekanina@autovykup.local'
    and coalesce(is_anonymous, false) = false;

  insert into public.valuation_staff (user_id, label)
  values (target_user_id, 'Adam Sekanina')
  on conflict (user_id) do update
    set label = excluded.label;
exception
  when no_data_found then
    raise exception 'Auth account sekanina@autovykup.local was not found.';
  when too_many_rows then
    raise exception 'Auth account sekanina@autovykup.local is not unique.';
end
$$;

-- RLS policies still need this function for signed-in staff. Anonymous callers
-- do not, and the public form reaches its service-role backend instead.
revoke execute on function public.is_valuation_staff() from anon;
