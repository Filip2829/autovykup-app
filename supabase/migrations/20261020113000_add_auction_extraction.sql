alter table public.auction_vehicles
  add column if not exists source_snapshot text,
  add column if not exists extracted_data jsonb,
  add column if not exists extraction_confidence text,
  add column if not exists extracted_at timestamptz;

alter table public.auction_vehicles drop constraint if exists auction_vehicles_extraction_confidence_check;
alter table public.auction_vehicles add constraint auction_vehicles_extraction_confidence_check
check (extraction_confidence is null or extraction_confidence in ('high', 'medium', 'low'));
alter table public.auction_vehicles drop constraint if exists auction_vehicles_extracted_data_check;
alter table public.auction_vehicles add constraint auction_vehicles_extracted_data_check
check (extracted_data is null or jsonb_typeof(extracted_data) = 'object');
