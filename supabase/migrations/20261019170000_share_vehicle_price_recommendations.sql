-- Price recommendation snapshots are shared team data.
-- The creator remains recorded for audit purposes, but every authenticated
-- application user can reuse and review recommendations made by colleagues.

drop policy if exists "Users can select own vehicle price recommendations"
  on public.vehicle_price_recommendations;

drop policy if exists "Authenticated users can select vehicle price recommendations"
  on public.vehicle_price_recommendations;

create policy "Authenticated users can select vehicle price recommendations"
on public.vehicle_price_recommendations
for select
to authenticated
using (true);

grant select on public.vehicle_price_recommendations to authenticated;
