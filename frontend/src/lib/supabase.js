import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Warn once in console — app still loads, auth features just won't work
  console.warn(
    '[PrepPilot] Supabase env vars not set. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth. ' +
    'See frontend/.env.example for instructions.'
  );
}

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseKey  ?? 'placeholder-anon-key'
);
