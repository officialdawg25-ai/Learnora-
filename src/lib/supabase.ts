import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isSupabaseConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT_REF') && !key.includes('YOUR_'));
export const supabase = isSupabaseConfigured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export type Course = { id:string; academy_id:string; title:string; slug:string; summary:string|null; description:string|null; subject:string|null; education_level:string|null; language_code:string; delivery_mode:string; access_type:string; price_minor:number; currency:string; publication_status:string; academies?:{name:string;slug:string}|null };