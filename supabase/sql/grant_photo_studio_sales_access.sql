-- User-requested access for Hanak (existing login jhanak) and Sekanina.
-- Only the standalone photo studio grant is changed; no staff membership,
-- database schema, RLS policy, password or existing metadata is replaced.
begin;
do $$
begin
  if (select count(*) from auth.users where
    (id = 'ab7cabdd-dd4c-4b16-b641-ddf1baae0eb1' and email = 'jhanak@autovykup.local') or
    (id = '2afe8f2a-c32e-4b0b-8436-8020ba73f870' and email = 'sekanina@autovykup.local')) <> 2 then
    raise exception 'Expected photo studio user accounts were not found';
  end if;
end;
$$;
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"photo_studio_access":true}'::jsonb,
    updated_at = now()
where (id = 'ab7cabdd-dd4c-4b16-b641-ddf1baae0eb1' and email = 'jhanak@autovykup.local')
   or (id = '2afe8f2a-c32e-4b0b-8436-8020ba73f870' and email = 'sekanina@autovykup.local');
commit;
-- Verify: these exact users have raw_app_meta_data->>'photo_studio_access' = 'true'.
-- Rollback: remove only the photo_studio_access key for these exact IDs.
