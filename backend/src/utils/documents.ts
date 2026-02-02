// Document quota check and increment

import { createClient } from '@supabase/supabase-js';
import { getMonthlyDocuments } from './plans.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export class InsufficientDocumentsError extends Error {
  public readonly code = 'INSUFFICIENT_DOCUMENTS';
  constructor(
    public readonly available: number,
    public readonly limit: number
  ) {
    super(`Insufficient document quota. Used ${available}/${limit}.`);
  }
}

async function ensureMonthlyReset(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('monthly_documents_reset_at')
    .eq('id', userId)
    .single();

  const lastReset = profile?.monthly_documents_reset_at
    ? new Date(profile.monthly_documents_reset_at)
    : null;
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (!lastReset || lastReset < oneMonthAgo) {
    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single();
    const plan = p?.subscription_plan || 'free';
    const limit = getMonthlyDocuments(plan);

    await supabaseAdmin
      .from('profiles')
      .update({
        documents_used: 0,
        monthly_documents_reset_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }
}

export async function getDocumentQuota(userId: string): Promise<{
  used: number;
  limit: number;
  canExtract: boolean;
}> {
  await ensureMonthlyReset(userId);

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('documents_used, subscription_plan')
    .eq('id', userId)
    .single();

  if (error) throw error;

  const used = typeof data?.documents_used === 'number' ? data.documents_used : 0;
  const plan = data?.subscription_plan || 'free';
  const limit = getMonthlyDocuments(plan);

  return {
    used,
    limit,
    canExtract: limit === 0 || used < limit,
  };
}

export async function incrementDocumentsUsed(userId: string): Promise<{ used: number; limit: number }> {
  await ensureMonthlyReset(userId);

  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('documents_used, subscription_plan')
    .eq('id', userId)
    .single();

  if (fetchError) throw fetchError;

  const used = typeof profile?.documents_used === 'number' ? profile.documents_used : 0;
  const plan = profile?.subscription_plan || 'free';
  const limit = getMonthlyDocuments(plan);

  if (limit > 0 && used >= limit) {
    throw new InsufficientDocumentsError(used, limit);
  }

  const newUsed = used + 1;

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ documents_used: newUsed })
    .eq('id', userId);

  if (updateError) throw updateError;

  return { used: newUsed, limit };
}
