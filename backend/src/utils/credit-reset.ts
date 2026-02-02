// Monthly credit and document reset logic

import { createClient } from '@supabase/supabase-js';
import { getMonthlyCredits, getMonthlyDocuments } from './plans.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function resetMonthlyCredits(userId: string): Promise<void> {
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    const plan = profile?.subscription_plan || 'free';
    const monthlyCredits = plan === 'enterprise' ? 100000 : getMonthlyCredits(plan);
    const monthlyDocuments = plan === 'enterprise' ? 10000 : getMonthlyDocuments(plan);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        credits: monthlyCredits,
        documents_used: 0,
        monthly_credits_reset_at: new Date().toISOString(),
        monthly_documents_reset_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Failed to reset credits for user ${userId}:`, error);
    throw error;
  }
}

export async function resetAllMonthlyCredits(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, subscription_plan, monthly_credits_reset_at');

    if (error) throw error;

    if (!profiles) {
      return { success: 0, failed: 0 };
    }

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const profile of profiles) {
      try {
        const lastReset = profile.monthly_credits_reset_at
          ? new Date(profile.monthly_credits_reset_at)
          : null;

        if (!lastReset || lastReset < oneMonthAgo) {
          await resetMonthlyCredits(profile.id);
          success++;
        }
      } catch (error) {
        console.error(`Failed to reset credits for user ${profile.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  } catch (error) {
    console.error('Failed to reset monthly credits:', error);
    throw error;
  }
}
