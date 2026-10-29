-- Reviewed against the user-provided cars schema. Apply to the existing project
-- only after explicit approval. This transaction creates module objects only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create table public.valuation_staff (user_id uuid primary key references auth.users(id), label text not null);
create function public.is_valuation_staff() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from valuation_staff where user_id = auth.uid()) $$;
revoke all on function public.is_valuation_staff() from public;
grant execute on function public.is_valuation_staff() to authenticated;
create sequence public.valuation_number_seq;
create table public.valuation_requests (
 id uuid primary key default gen_random_uuid(), number text not null unique default ('ON-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.valuation_number_seq')::text,6,'0')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), submitted_at timestamptz,
 status text not null default 'draft' check(status in ('draft','new','in_progress','awaiting_info','offer_sent','accepted','declined','closed')),
 is_test boolean not null default true,
 data jsonb not null default '{}', pricing jsonb not null default '{}', assigned_to uuid references public.valuation_staff(user_id),
 converted_car_id bigint references public.cars(id), revision int not null default 0,
 offer jsonb, response text, retain_until timestamptz not null default now() + interval '180 days'
);
create index on public.valuation_requests(status,created_at desc);
create index on public.valuation_requests(converted_car_id);
create table public.valuation_photos (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.valuation_requests on delete cascade, path text not null unique, shot text not null, removed boolean not null default false, created_at timestamptz not null default now());
create table public.valuation_notes (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.valuation_requests on delete cascade, author uuid not null references auth.users, body text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.valuation_events (id bigint generated always as identity primary key, request_id uuid not null references public.valuation_requests on delete cascade, actor uuid, kind text not null, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.valuation_tokens (id uuid primary key, request_id uuid not null references public.valuation_requests on delete cascade, hash text not null unique, purpose text not null check(purpose in ('draft','supplement','offer')), fields jsonb not null default '[]', message text not null default '', expires_at timestamptz not null, used_at timestamptz);
create table public.valuation_mail (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.valuation_requests on delete cascade, kind text not null, payload jsonb not null default '{}', status text not null default 'pending' check(status in ('pending','sending','sent','failed')), attempts int not null default 0, available_at timestamptz not null default now(), lease_until timestamptz, last_error text, sent_at timestamptz, created_at timestamptz not null default now());
create index on public.valuation_mail(status,available_at);
create table public.valuation_limits (key text primary key, hits int not null default 1, expires_at timestamptz not null);
-- No anonymous table access. Staff writes also go through the transactional API.
do $$ declare t text; begin foreach t in array array['valuation_staff','valuation_requests','valuation_photos','valuation_notes','valuation_events','valuation_tokens','valuation_mail','valuation_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t not in ('valuation_tokens','valuation_limits') then
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy staff_read on public.%I for select to authenticated using (public.is_valuation_staff())',t);
 end if;
end loop; end $$;
-- Fail on a name collision instead of silently reusing an unknown bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('valuation-photos','valuation-photos',false,3145728,array['image/jpeg']);
create policy valuation_photo_read on storage.objects for select to authenticated using(bucket_id='valuation-photos' and public.is_valuation_staff());

create function public.valuation_rate_limit(p_key text, p_max int) returns boolean language plpgsql security definer set search_path=public as $$
declare n int; begin
 insert into valuation_limits(key,expires_at) values(p_key,now()+interval '1 hour') on conflict(key) do update set hits=case when valuation_limits.expires_at<now() then 1 else valuation_limits.hits+1 end, expires_at=case when valuation_limits.expires_at<now() then now()+interval '1 hour' else valuation_limits.expires_at end returning hits into n;
 return n<=p_max;
end $$;

-- All state changes, token consumption, audit and mail scheduling share a transaction.
create function public.valuation_action(p_action text, p_id uuid, p_actor uuid, p_hash text, p jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare r valuation_requests; t valuation_tokens; v jsonb; car_id bigint; n uuid; old_status text;
begin
 if p_action='begin' then
  insert into valuation_requests(id,is_test,retain_until) values(p_id,coalesce((p->>'is_test')::boolean,true),now()+interval '1 day') on conflict(id) do nothing;
  if not found then raise exception 'Nová relace již existuje.'; end if;
  insert into valuation_tokens(id,request_id,hash,purpose,expires_at) values((p->>'token_id')::uuid,p_id,p->>'hash','draft',now()+interval '1 day');
  return jsonb_build_object('id',p_id);
 end if;
 select * into r from valuation_requests where id=p_id for update;
 if not found then raise exception 'Poptávka není dostupná.'; end if;
 old_status:=r.status;
 if p_actor is null then
  select * into t from valuation_tokens where request_id=p_id and hash=p_hash and expires_at>now() for update;
  if not found then raise exception 'Odkaz není platný nebo již vypršel.'; end if;
  -- Submit retry is idempotent, including after the response was lost.
  if p_action='submit' and t.purpose='draft' and r.submitted_at is not null then return jsonb_build_object('number',r.number); end if;
  if t.used_at is not null then raise exception 'Odkaz již byl použit.'; end if;
 else
  if not exists(select 1 from valuation_staff where user_id=p_actor) then raise exception 'Přístup odepřen.'; end if;
 end if;
 if p_action='public_read' then
  if t.purpose='offer' then
   if r.offer is null or r.offer->>'token_id'<>t.id::text then raise exception 'Nabídka již není aktuální.'; end if;
   return jsonb_build_object('purpose','offer','number',r.number,'vehicle',concat(r.data->>'brand',' ',r.data->>'model'),'offer',r.offer-'token_id');
  elsif t.purpose='supplement' then
   return jsonb_build_object('purpose','supplement','number',r.number,'fields',t.fields,'message',t.message);
  end if;
  raise exception 'Odkaz není určen k zobrazení.';
 elsif p_action='authorize_upload' then
  if not ((t.purpose='draft' and r.status='draft') or (t.purpose='supplement' and t.fields ? 'photos')) then raise exception 'Nahrávání není povoleno.'; end if;
  if (select count(*) from valuation_photos where request_id=p_id)>=24 then raise exception 'Nejvýše 24 fotografií.'; end if;
  return jsonb_build_object('allowed',true);
 elsif p_action='photo' then
  if not ((t.purpose='draft' and r.status='draft') or (t.purpose='supplement' and t.fields ? 'photos')) then raise exception 'Nahrávání není povoleno.'; end if;
  if (select count(*) from valuation_photos where request_id=p_id)>=24 then raise exception 'Nejvýše 24 fotografií.'; end if;
  insert into valuation_photos(request_id,path,shot) values(p_id,p->>'path',p->>'shot') returning id into n;
  return jsonb_build_object('id',n,'path',p->>'path');
 elsif p_action='remove_photo' then
  if not ((t.purpose='draft' and r.status='draft') or (t.purpose='supplement' and t.fields ? 'photos')) then raise exception 'Mazání není povoleno.'; end if;
  update valuation_photos set removed=true where id=(p->>'photo_id')::uuid and request_id=p_id returning jsonb_build_object('path',path) into v;
  return coalesce(v,'{}');
 elsif p_action='submit' then
  if t.purpose<>'draft' or r.status<>'draft' then raise exception 'Podání nelze odeslat.'; end if;
  update valuation_requests set data=p->'data',status='new',submitted_at=now(),retain_until=now()+make_interval(days=>(p->>'retention_days')::int) where id=p_id;
  update valuation_tokens set used_at=now() where id=t.id;
  insert into valuation_mail(request_id,kind) values(p_id,'internal_new'),(p_id,'confirmation');
 elsif p_action='supplement_submit' then
  if t.purpose<>'supplement' then raise exception 'Nesprávný typ odkazu.'; end if;
  v:='{}';
  if t.fields ? 'vin' then v:=v||jsonb_build_object('vin',p->>'vin'); end if;
  if t.fields ? 'service_history' then v:=v||jsonb_build_object('service_history',p->>'service_history'); end if;
  if t.fields ? 'damage_description' then v:=v||jsonb_build_object('damage_description',p->>'damage_description'); end if;
  if t.fields ? 'additional' then v:=v||jsonb_build_object('supplement',p->>'additional'); end if;
  update valuation_requests set data=data||v,status=case when status='awaiting_info' then 'in_progress' else status end where id=p_id;
  update valuation_tokens set used_at=now() where id=t.id;
  insert into valuation_mail(request_id,kind) values(p_id,'internal_supplement');
 elsif p_action='respond' then
  if t.purpose<>'offer' or r.offer->>'token_id' is distinct from t.id::text then raise exception 'Nabídka již není aktuální.'; end if;
  if p->>'response' not in ('accepted','declined','contact') then raise exception 'Neplatná odpověď.'; end if;
  update valuation_requests set response=p->>'response',status=case when p->>'response'='contact' then 'in_progress' else p->>'response' end where id=p_id;
  update valuation_tokens set used_at=now() where id=t.id;
  insert into valuation_mail(request_id,kind) values(p_id,'internal_response');
 elsif p_actor is null then raise exception 'Přihlášení je vyžadováno.';
 elsif p_action='save' then
  if r.revision<>(p->>'revision')::int then raise exception 'Poptávku mezitím změnil jiný uživatel. Obnovte detail.'; end if;
  if p->>'status' not in ('new','in_progress','awaiting_info','offer_sent','accepted','declined','closed') then raise exception 'Neplatný stav.'; end if;
  update valuation_requests set pricing=p->'pricing',status=p->>'status',assigned_to=nullif(p->>'assigned_to','')::uuid where id=p_id;
 elsif p_action='note' then
  if nullif(p->>'note_id','') is null then insert into valuation_notes(request_id,author,body) values(p_id,p_actor,p->>'body');
  else update valuation_notes set body=p->>'body',updated_at=now() where id=(p->>'note_id')::uuid and request_id=p_id and author=p_actor; if not found then raise exception 'Upravit lze pouze vlastní poznámku.'; end if; end if;
 elsif p_action in ('offer','supplement') then
  -- Never invalidate a message while a delivery may be in flight.
  if exists(select 1 from valuation_mail where request_id=p_id and kind=p_action and status in ('pending','sending')) then raise exception 'Předchozí zpráva ještě čeká na odeslání.'; end if;
  if r.revision<>(p->>'revision')::int then raise exception 'Obnovte detail před odesláním.'; end if;
  update valuation_tokens set used_at=coalesce(used_at,now()) where request_id=p_id and purpose=p_action;
  insert into valuation_tokens(id,request_id,hash,purpose,fields,message,expires_at) values((p->>'token_id')::uuid,p_id,p->>'hash',p_action,coalesce(p->'fields','[]'),coalesce(p->>'message',''),now()+case when p_action='offer' then interval '14 days' else interval '7 days' end);
  if p_action='offer' then
   if (p->'offer'->>'min')::numeric is distinct from (r.pricing->>'approved_price')::numeric or (p->'offer'->>'max')::numeric is distinct from (r.pricing->>'approved_price_max')::numeric then raise exception 'Schválená cena se změnila.'; end if;
  end if;
  insert into valuation_mail(request_id,kind,payload) values(p_id,p_action,p-'hash');
 elsif p_action='convert' then
  if r.is_test then raise exception 'Testovací poptávku nelze převést do skutečné evidence vozidel.'; end if;
  if r.converted_car_id is not null then return jsonb_build_object('car_id',r.converted_car_id); end if;
  -- Serialize conversions; same VIN/SPZ cannot race across requests.
  perform pg_advisory_xact_lock(774201);
  if exists(select 1 from cars where (nullif(r.data->>'vin','') is not null and upper(regexp_replace(coalesce(vin,''),'[^a-zA-Z0-9]','','g'))=upper(r.data->>'vin')) or upper(regexp_replace(coalesce(spz,''),'[^a-zA-Z0-9]','','g'))=upper(regexp_replace(r.data->>'spz','[^a-zA-Z0-9]','','g'))) then raise exception 'V evidenci již existuje vůz se stejným VIN nebo SPZ.'; end if;
  insert into cars(name,year,km,vin,spz,status,created_by,updated_by,technical_params,customer_info,photos,notes,checklist,equipment,valuation_date,buy_estimate,buy_estimate_max,approved_price,approved_price_max,sale_estimate,customer_expected_price,lifecycle_stage,deal_type)
  values(concat(r.data->>'brand',' ',r.data->>'model'),r.data->>'year',(r.data->>'km')::bigint,r.data->>'vin',r.data->>'spz','valuation',p->>'username',p->>'username',
   jsonb_build_object('brand',r.data->>'brand','model',r.data->>'model','fuel',r.data->>'fuel','engine',r.data->>'engine','transmission',r.data->>'transmission','onlineValuation',r.data,'onlineValuationPricing',r.pricing),
   jsonb_build_object('firstName',r.data->>'full_name','lastName','','phone',r.data->>'phone','email',r.data->>'email'), '[]','[]','{}','{}',current_date,
   r.pricing->>'buy_estimate',r.pricing->>'buy_estimate_max',r.pricing->>'approved_price',r.pricing->>'approved_price_max',(r.pricing->>'sale_estimate')::numeric::bigint,(r.data->>'customer_expected_price')::numeric,'valuation','buyout') returning id into car_id;
  update valuation_requests set converted_car_id=car_id where id=p_id;
 else raise exception 'Neznámá operace.';
 end if;
 update valuation_requests set updated_at=now(),revision=revision+1 where id=p_id;
 insert into valuation_events(request_id,actor,kind,detail) select p_id,p_actor,p_action,jsonb_build_object('from',old_status,'to',status,'response',response,'note_id',p->>'note_id','fields',p->'fields') from valuation_requests where id=p_id;
 return jsonb_build_object('number',r.number,'car_id',car_id);
end $$;

create function public.valuation_claim_mail() returns setof public.valuation_mail language sql security definer set search_path=public as $$
 update valuation_mail set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes'
 where id in (select id from valuation_mail where ((status='pending' and available_at<=now()) or (status='sending' and lease_until<now())) and attempts<8 order by created_at for update skip locked limit 10) returning *;
$$;
create function public.valuation_finish_mail(p_id uuid,p_error text) returns void language plpgsql security definer set search_path=public as $$
declare m valuation_mail; begin
 select * into m from valuation_mail where id=p_id for update;
 if m.status<>'sending' then return; end if;
 update valuation_mail set status=case when p_error is null then 'sent' when attempts>=8 then 'failed' else 'pending' end, sent_at=case when p_error is null then now() end,last_error=p_error,available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::int)),lease_until=null where id=p_id;
 if p_error is null and m.kind in ('offer','supplement') then
  update valuation_requests set offer=case when m.kind='offer' then m.payload->'offer'||jsonb_build_object('token_id',m.payload->>'token_id') else offer end,status=case when m.kind='offer' then 'offer_sent' else 'awaiting_info' end,revision=revision+1,updated_at=now() where id=m.request_id;
 end if;
 insert into valuation_events(request_id,kind,detail) values(m.request_id,case when p_error is null then 'mail_sent' else 'mail_error' end,jsonb_build_object('kind',m.kind,'error',p_error));
end $$;
revoke all on function public.valuation_action(text,uuid,uuid,text,jsonb),public.valuation_rate_limit(text,int),public.valuation_claim_mail(),public.valuation_finish_mail(uuid,text) from public,anon,authenticated;
grant execute on function public.valuation_action(text,uuid,uuid,text,jsonb),public.valuation_rate_limit(text,int),public.valuation_claim_mail(),public.valuation_finish_mail(uuid,text) to service_role;
grant usage, select on sequence public.valuation_number_seq, public.valuation_events_id_seq to service_role;
commit;
