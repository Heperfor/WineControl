import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

const isPlaceholder = (val: string): boolean =>
  !val ||
  val.includes('tu-proyecto.supabase.co') ||
  val.includes('tu-anon-public-key') ||
  val === 'undefined';

export const isSupabaseConfigured: boolean =
  !isPlaceholder(rawUrl) &&
  !isPlaceholder(rawAnonKey) &&
  (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
