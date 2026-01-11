import { createClient } from '@supabase/supabase-js';

// Your Project URL
const supabaseUrl = 'https://aovdburokypwghgbrfmb.supabase.co';

// Your Anon Public Key
const supabaseAnonKey = 'sb_publishable_nCiUEYVy2Tu41hiimDZ12A_cCiqdOs0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.warn('Error fetching user:', error);
    return null;
  }
};