import { createClient } from '@supabase/supabase-js';
import { sendCreditLowWarning } from './email.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for backend credit enforcement');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export class InsufficientCreditsError extends Error {
  public readonly code = 'INSUFFICIENT_CREDITS';
  constructor(public readonly available: number, public readonly required: number) {
    super(`Insufficient credits. Required ${required}, available ${available}.`);
  }
}

async function getCredits(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (error) throw error;
  const credits = typeof data?.credits === 'number' ? data.credits : 0;
  // Ensure credits are never negative (safety check)
  return Math.max(0, credits);
}

// Refund credits (for rollback scenarios)
export async function refundCredits(userId: string, amount: number): Promise<{ before: number; after: number }> {
  if (amount <= 0) {
    const current = await getCredits(userId);
    return { before: current, after: current };
  }

  // Use atomic increment to avoid race conditions
  const { data, error } = await supabaseAdmin.rpc('increment_credits', {
    user_id: userId,
    amount: amount
  });

  if (error) {
    // Fallback to manual update if RPC doesn't exist
    const before = await getCredits(userId);
    const after = before + amount;
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: after })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    return { before, after };
  }

  const before = await getCredits(userId);
  return { before, after: before + amount };
}

export async function chargeCredits(userId: string, amount: number): Promise<{ before: number; after: number }> {
  if (amount <= 0) {
    const current = await getCredits(userId);
    return { before: current, after: current };
  }

  // Retry optimistic update to avoid race conditions
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const before = await getCredits(userId);
    
    // Ensure we never go negative
    if (before < amount) {
      throw new InsufficientCreditsError(before, amount);
    }

    // Calculate new balance (ensure it's never negative)
    const after = Math.max(0, before - amount);

    // Atomic update using optimistic concurrency control
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ credits: after })
      .eq('id', userId)
      .eq('credits', before) // Optimistic lock: only update if credits haven't changed
      .select('credits')
      .single();

    if (!error && data) {
      const finalCredits = typeof data.credits === 'number' ? Math.max(0, data.credits) : after;
      
      // Safety check: ensure we never return negative credits
      if (finalCredits < 0) {
        console.error(`CRITICAL: Credits went negative for user ${userId}. Resetting to 0.`);
        await supabaseAdmin
          .from('profiles')
          .update({ credits: 0 })
          .eq('id', userId);
        return { before, after: 0 };
      }
      
      // Send low credit warning if credits are below 100
      if (finalCredits < 100 && finalCredits > 0) {
        // Get user email and name for warning email
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();
        
        if (profileData?.email) {
          // Get user metadata for name
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
          const name = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
          
          // Send warning email (don't await to avoid blocking)
          sendCreditLowWarning(profileData.email, name, finalCredits).catch(err => {
            console.error('Failed to send credit low warning email:', err);
          });
        }
      }
      
      return { before, after: finalCredits };
    }

    // If update failed due to concurrent modification, wait a bit and retry
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1))); // Exponential backoff
    }
  }

  // Final attempt: check current balance one more time
  const before = await getCredits(userId);
  if (before < amount) {
    throw new InsufficientCreditsError(before, amount);
  }

  // Last attempt with current balance
  const after = Math.max(0, before - amount);
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ credits: after })
    .eq('id', userId)
    .select('credits')
    .single();

  if (error || !data) {
    throw new Error('Could not charge credits due to concurrent updates. Please retry.');
  }

  const finalCredits = typeof data.credits === 'number' ? Math.max(0, data.credits) : after;
  return { before, after: finalCredits };
}

// Check if user has enough credits without charging
export async function checkCredits(userId: string, amount: number): Promise<boolean> {
  const credits = await getCredits(userId);
  return credits >= amount;
}

