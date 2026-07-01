create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  car_id bigint not null references public.cars(id) on delete cascade,
  title text,
  category text,
  description text,
  document_date date,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by text,
  created_at timestamptz default now(),
  ai_summary text,
  ai_processed boolean default false,
  is_visible_to_customer boolean default false
);

create index if not exists vehicle_documents_car_id_idx
on public.vehicle_documents(car_id);

alter table public.vehicle_documents enable row level security;

drop policy if exists "Authenticated users can select vehicle documents"
on public.vehicle_documents;
drop policy if exists "Authenticated users can insert vehicle documents"
on public.vehicle_documents;
drop policy if exists "Authenticated users can update vehicle documents"
on public.vehicle_documents;
drop policy if exists "Authenticated users can delete vehicle documents"
on public.vehicle_documents;

create policy "Authenticated users can select vehicle documents"
on public.vehicle_documents
for select
to authenticated
using (true);

create policy "Authenticated users can insert vehicle documents"
on public.vehicle_documents
for insert
to authenticated
with check (true);

create policy "Authenticated users can update vehicle documents"
on public.vehicle_documents
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete vehicle documents"
on public.vehicle_documents
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do update
set public = false;

drop policy if exists "Authenticated users can read vehicle document files"
on storage.objects;
drop policy if exists "Authenticated users can upload vehicle document files"
on storage.objects;
drop policy if exists "Authenticated users can update vehicle document files"
on storage.objects;
drop policy if exists "Authenticated users can delete vehicle document files"
on storage.objects;

create policy "Authenticated users can read vehicle document files"
on storage.objects
for select
to authenticated
using (bucket_id = 'vehicle-documents');

create policy "Authenticated users can upload vehicle document files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'vehicle-documents');

create policy "Authenticated users can update vehicle document files"
on storage.objects
for update
to authenticated
using (bucket_id = 'vehicle-documents')
with check (bucket_id = 'vehicle-documents');

create policy "Authenticated users can delete vehicle document files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'vehicle-documents');
