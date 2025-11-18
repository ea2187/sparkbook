import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEV_ACCESS_TOKEN, DEV_REFRESH_TOKEN } from '@env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auto-login for development
if (DEV_ACCESS_TOKEN && DEV_REFRESH_TOKEN) {
  supabase.auth.setSession({
    access_token: DEV_ACCESS_TOKEN,
    refresh_token: DEV_REFRESH_TOKEN,
  });
}
