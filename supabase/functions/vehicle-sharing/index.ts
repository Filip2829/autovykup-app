import { createClient } from 'npm:@supabase/supabase-js@2.106.1';
import { createSharingHandler } from '../_shared/vehicleSharingHandler.js';

const projectUrl = Deno.env.get('SUPABASE_URL')!;
const db = createClient(projectUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
Deno.serve(createSharingHandler({ db, projectUrl }));
