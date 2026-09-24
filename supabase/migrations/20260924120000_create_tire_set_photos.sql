create table if not exists public.tire_set_photos (
  id uuid primary key default gen_random_uuid(),
  tire_set_id uuid not null references public.tire_sets(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);

create index if not exists tire_set_photos_tire_set_id_idx
  on public.tire_set_photos(tire_set_id);

alter table public.tire_set_photos enable row level security;

drop policy if exists "Authenticated users can select tire set photos"
  on public.tire_set_photos;
drop policy if exists "Authenticated users can insert tire set photos"
  on public.tire_set_photos;
drop policy if exists "Authenticated users can delete tire set photos"
  on public.tire_set_photos;

create policy "Authenticated users can select tire set photos"
on public.tire_set_photos
for select
to authenticated
using (true);

create policy "Authenticated users can insert tire set photos"
on public.tire_set_photos
for insert
to authenticated
with check (true);

create policy "Authenticated users can delete tire set photos"
on public.tire_set_photos
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tire-photos',
  'tire-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Authenticated users can read tire photos"
  on storage.objects;
drop policy if exists "Authenticated users can upload tire photos"
  on storage.objects;
drop policy if exists "Authenticated users can delete tire photos"
  on storage.objects;

create policy "Authenticated users can read tire photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'tire-photos');

create policy "Authenticated users can upload tire photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'tire-photos');

create policy "Authenticated users can delete tire photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'tire-photos');
