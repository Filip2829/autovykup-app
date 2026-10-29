alter table public.customers
  add column if not exists created_by_label text;

-- Preserve the creator as an audit snapshot. Existing rows only get a label
-- when they already contain a reliable Auth user reference.
update public.customers as customer
set created_by_label = split_part(auth_user.email, '@', 1)
from auth.users as auth_user
where customer.created_by = auth_user.id
  and nullif(btrim(customer.created_by_label), '') is null;

create or replace function public.set_customer_creator_audit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text := auth.jwt() ->> 'email';
begin
  if tg_op = 'INSERT' then
    -- Never trust audit fields supplied by the browser.
    new.created_by = actor_id;
    new.created_by_label = case
      when actor_id is null then null
      else coalesce(nullif(split_part(actor_email, '@', 1), ''), actor_id::text)
    end;
  else
    -- The original creator is immutable, including through direct Data API calls.
    new.created_by = old.created_by;
    new.created_by_label = old.created_by_label;
  end if;

  return new;
end;
$$;

create trigger customers_set_creator_audit
before insert or update on public.customers
for each row
execute function public.set_customer_creator_audit();
