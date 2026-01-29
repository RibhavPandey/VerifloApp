import express from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { createClient } from '@supabase/supabase-js';
import { resetAllMonthlyCredits } from '../utils/credit-reset.js';
import { PLAN_LIMITS, isValidPlan } from '../utils/plans.js';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// All admin routes require admin authentication
router.use(requireAdmin);

// Get all users
router.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, credits, is_admin, subscription_plan, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(users || []);
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

// Update user credits
router.post('/users/:userId/credits', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { credits } = req.body;

    if (typeof credits !== 'number' || credits < 0) {
      return res.status(400).json({ error: 'Invalid credits value' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ credits })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, credits });
  } catch (error: any) {
    console.error('Update credits error:', error);
    res.status(500).json({ error: error.message || 'Failed to update credits' });
  }
});

// Suspend/unsuspend user
router.post('/users/:userId/suspend', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { suspended } = req.body;

    // For now, we'll use a metadata field. In production, add a 'suspended' column to profiles
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_expires_at: suspended ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null
    });

    if (error) throw error;

    res.json({ success: true, suspended });
  } catch (error: any) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user status' });
  }
});

// Get analytics
router.get('/analytics', async (req: AuthenticatedRequest, res) => {
  try {
    // Get user count
    const { count: userCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get total credits used (approximate - sum of all credit deductions)
    // This would require an audit log table for accurate tracking
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('credits');

    const totalCredits = profiles?.reduce((sum, p) => sum + (p.credits || 0), 0) || 0;

    // Get job counts
    const { count: jobCount } = await supabaseAdmin
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    res.json({
      users: userCount || 0,
      totalCredits,
      jobs: jobCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch analytics' });
  }
});

// Reset monthly credits for all users
router.post('/credits/reset-monthly', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await resetAllMonthlyCredits();
    res.json({
      success: true,
      reset: result.success,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('Reset monthly credits error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset monthly credits' });
  }
});

// Update user plan
router.post('/users/:userId/plan', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;

    if (!isValidPlan(plan)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ subscription_plan: plan })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: error.message || 'Failed to update plan' });
  }
});

// Get plan limits
router.get('/plans', async (req: AuthenticatedRequest, res) => {
  res.json(PLAN_LIMITS);
});

// Get system health
router.get('/health', async (req: AuthenticatedRequest, res) => {
  try {
    // Check database connection
    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);

    const dbHealthy = !dbError;

    res.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      database: dbHealthy ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check system health' });
  }
});

export default router;
