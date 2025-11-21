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

// Auto-login helper for development
export const initDevSession = async () => {
  if (DEV_ACCESS_TOKEN && DEV_REFRESH_TOKEN) {
    const { data, error } = await supabase.auth.setSession({
      access_token: DEV_ACCESS_TOKEN,
      refresh_token: DEV_REFRESH_TOKEN,
    });
    
    if (error) {
      console.error('Auto-login error:', error);
    } else {
      console.log('✅ Dev session initialized:', data.session?.user?.email);
    }
    
    return data.session;
  }
  console.log('⚠️ No dev tokens found, skipping auto-login');
  return null;
};
