import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

/**
 * Create a Supabase client for client-side use.
 * Call with the url/key provided by the layout server load.
 * @param {string} url
 * @param {string} key
 */
export function createSupabaseClient(url, key) {
  if (!browser) return null;
  if (!url || !key) return null;
  return createClient(url, key);
}
