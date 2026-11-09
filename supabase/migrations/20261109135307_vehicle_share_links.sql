-- Apply only after explicit approval under docs/CODEX_WORKFLOW.md.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.vehicle_share_links (
  id uuid primary key default gen_random_uuid(),
  car_id bigint references public.cars(id) on delete cascade,
  request_id uuid references public.valuation_requests(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  audience text not null check (audience in ('aaa','buyer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  check (num_nonnulls(car_id,request_id) = 1),
  check (expires_at > created_at and expires_at <= created_at + interval '31 days')
);
create index vehicle_share_links_car on public.vehicle_share_links(car_id,created_at desc);
create index vehicle_share_links_request on public.vehicle_share_links(request_id,created_at desc);
alter table public.vehicle_share_links enable row level security;
revoke all on public.vehicle_share_links from public,anon,authenticated;
grant select,insert,update,delete on public.vehicle_share_links to service_role;

-- Extra TP / CEBIA files can be attached directly to an unconverted request.
create table public.vehicle_share_attachments (
  id uuid primary key,
  car_id bigint references public.cars(id) on delete cascade,
  request_id uuid references public.valuation_requests(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('tp','cebia')),
  title text not null,
  object_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  check (num_nonnulls(car_id,request_id) = 1)
);
create index vehicle_share_attachments_car on public.vehicle_share_attachments(car_id);
create index vehicle_share_attachments_request on public.vehicle_share_attachments(request_id);
alter table public.vehicle_share_attachments enable row level security;
revoke all on public.vehicle_share_attachments from public,anon,authenticated;
grant select,insert,update,delete on public.vehicle_share_attachments to service_role;

-- Use the existing private vehicle-documents bucket. Queue file cleanup in the
-- same transaction when a source or its attachment is deleted.
create function vehicle_deletion_private.queue_share_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.vehicle_file_cleanup(bucket_id,object_path,car_id)
  values ('vehicle-documents',old.object_path,coalesce(old.car_id,0))
  on conflict (bucket_id,object_path) do nothing;
  return old;
end $$;
revoke all on function vehicle_deletion_private.queue_share_attachment() from public,anon,authenticated;
create trigger queue_share_attachment before delete on public.vehicle_share_attachments
for each row execute function vehicle_deletion_private.queue_share_attachment();
commit;
