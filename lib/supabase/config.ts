const fallbackSupabaseUrl = 'https://hvyrhwhxbtsgrgodgzms.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_LiDl80FOx74Qjp465A5XnQ_tAKuaohY';

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl;

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackSupabaseAnonKey;
