import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { sendInactiveUserEmail, sendFirstWeekSummaryEmail } from '../utils/email.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

const CRON_SECRET = process.env.CRON_SECRET || '';

export async function runFollowupEmails(req: Request, res: Response): Promise<void> {
  if (CRON_SECRET && req.headers['x-cron-secret'] !== CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Supabase not configured' });
    return;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const isWithinDay = (createdAt: string, days: number) => {
    const created = new Date(createdAt).getTime();
    const diff = now - created;
    const targetStart = (days - 1) * dayMs;
    const targetEnd = (days + 1) * dayMs;
    return diff >= targetStart && diff <= targetEnd;
  };

  let sent = 0;
  let page = 1;
  const perPage = 100;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error('[cron/followup] listUsers error:', error);
        res.status(500).json({ error: error.message });
        return;
      }

      if (!users || users.length === 0) break;

      for (const user of users) {
        const email = user.email;
        if (!email) continue;

        const createdAt = user.created_at;
        const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0] || 'there';

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('documents_used, last_followup_at, followup_stage')
          .eq('id', user.id)
          .single();

        const documentsUsed = profile?.documents_used ?? 0;
        const followupStage = profile?.followup_stage || 'none';

        if (isWithinDay(createdAt, 2) && followupStage === 'none' && documentsUsed === 0) {
          const ok = await sendInactiveUserEmail(email, name, 'day2');
          if (ok) {
            await supabaseAdmin.from('profiles').update({
              last_followup_at: new Date().toISOString(),
              followup_stage: 'day2',
            }).eq('id', user.id);
            sent++;
          }
        } else if (isWithinDay(createdAt, 5) && followupStage === 'day2' && documentsUsed === 0) {
          const ok = await sendInactiveUserEmail(email, name, 'day5');
          if (ok) {
            await supabaseAdmin.from('profiles').update({
              last_followup_at: new Date().toISOString(),
              followup_stage: 'day5',
            }).eq('id', user.id);
            sent++;
          }
        } else if (isWithinDay(createdAt, 7) && (followupStage === 'day5' || followupStage === 'day2' || followupStage === 'none')) {
          const ok = await sendFirstWeekSummaryEmail(email, name, documentsUsed > 0);
          if (ok) {
            await supabaseAdmin.from('profiles').update({
              last_followup_at: new Date().toISOString(),
              followup_stage: 'day7',
            }).eq('id', user.id);
            sent++;
          }
        }
      }

      if (users.length < perPage) break;
      page++;
    }

    res.json({ ok: true, sent });
  } catch (err: unknown) {
    console.error('[cron/followup] Error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
