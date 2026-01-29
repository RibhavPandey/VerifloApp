// Database migration utilities
// Note: For Supabase, migrations are typically run manually in the SQL Editor
// This utility provides a way to check migration status

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for migrations');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function getAppliedMigrations(): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('schema_migrations')
      .select('version')
      .order('version');

    if (error) {
      // Table might not exist yet
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return [];
      }
      throw error;
    }

    return data?.map(m => m.version) || [];
  } catch (error) {
    console.error('Failed to get applied migrations:', error);
    return [];
  }
}

export async function markMigrationApplied(version: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('schema_migrations')
      .upsert({ version, applied_at: new Date().toISOString() });
  } catch (error) {
    console.error(`Failed to mark migration ${version} as applied:`, error);
    throw error;
  }
}

// Check if a specific migration has been applied
export async function isMigrationApplied(version: string): Promise<boolean> {
  const applied = await getAppliedMigrations();
  return applied.includes(version);
}
