import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin middleware');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !profile?.is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error: any) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }
};
