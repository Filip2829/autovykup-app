-- Deleting a vehicle also deletes its original online valuation and all of that
-- request's child records (their existing foreign keys already cascade).
-- No existing vehicle/request is deleted by applying this migration.
alter table public.valuation_requests
  drop constraint valuation_requests_converted_car_id_fkey,
  add constraint valuation_requests_converted_car_id_fkey
    foreign key (converted_car_id) references public.cars(id) on delete cascade;

-- Storage objects must be removed through the Storage API, never by SQL.
-- Persist cleanup work in the same transaction as the vehicle deletion so a
-- network failure cannot lose the list of files that still need removing.
create table public.vehicle_file_cleanup (
  bucket_id text not null check (bucket_id in ('car-photos', 'vehicle-documents', 'valuation-photos')),
  object_path text not null,
  car_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (bucket_id, object_path)
);
alter table public.vehicle_file_cleanup enable row level security;
revoke all on public.vehicle_file_cleanup from public, anon, authenticated;
grant select, delete on public.vehicle_file_cleanup to service_role;

create schema vehicle_deletion_private;
revoke all on schema vehicle_deletion_private from public, anon, authenticated;

create function vehicle_deletion_private.queue_vehicle_files()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.vehicle_file_cleanup(bucket_id, object_path, car_id)
  select o.bucket_id, o.name, old.id
  from storage.objects o
  where
    (o.bucket_id = 'car-photos' and o.name ~ ('^[^/]+/' || old.id::text || '-'))
    or (o.bucket_id = 'vehicle-documents' and (
      o.name like old.id::text || '/%'
      or exists (select 1 from public.vehicle_documents d where d.car_id = old.id and d.file_path = o.name)
    ))
    or (o.bucket_id = 'valuation-photos' and exists (
      select 1 from public.valuation_requests r
      where r.converted_car_id = old.id and (
        o.name like r.id::text || '/%'
        or exists (select 1 from public.valuation_photos p where p.request_id = r.id and p.path = o.name)
      )
    ))
  on conflict (bucket_id, object_path) do nothing;
  return old;
end;
$$;
revoke all on function vehicle_deletion_private.queue_vehicle_files() from public, anon, authenticated;
create trigger queue_deleted_vehicle_files before delete on public.cars
  for each row execute function vehicle_deletion_private.queue_vehicle_files();

-- Rollback (does not restore records already deliberately deleted): remove the
-- trigger/function/schema and, after draining it, the cleanup table. Recreate
-- valuation_requests_converted_car_id_fkey with ON DELETE NO ACTION.
