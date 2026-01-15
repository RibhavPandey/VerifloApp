import { createClient } from '@supabase/supabase-js';

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
  return typeof data?.credits === 'number' ? data.credits : 0;
}

export async function chargeCredits(userId: string, amount: number): Promise<{ before: number; after: number }> {
  if (amount <= 0) return { before: 0, after: 0 };

  // Retry optimistic update a few times to avoid race conditions.
  for (let attempt = 0; attempt < 5; attempt++) {
    const before = await getCredits(userId);
    if (before < amount) throw new InsufficientCreditsError(before, amount);

    const after = before - amount;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ credits: after })
      .eq('id', userId)
      .eq('credits', before)
      .select('credits')
      .single();

    if (!error && data) {
      return { before, after: typeof data.credits === 'number' ? data.credits : after };
    }
  }

  // If we keep conflicting, do one last check and fail safe.
  const before = await getCredits(userId);
  if (before < amount) throw new InsufficientCreditsError(before, amount);
  throw new Error('Could not charge credits due to concurrent updates. Please retry.');
}

