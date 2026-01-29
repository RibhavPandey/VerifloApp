import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // Try to refresh session if error
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        const { data: { user: refreshedUser } } = await supabase.auth.getUser();
        return refreshedUser;
      }
      return null;
    }
    return user;
  } catch (error) {
    console.warn('Error fetching user:', error);
    return null;
  }
};

// Refresh session manually
export const refreshSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
    return !!session;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return false;
  }
};