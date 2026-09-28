// netlify/functions/flip-overdue-invoices.js
// Scheduled daily run that flips eligible invoices to "overdue" status.
// Eligibility: status in (sent, viewed, partial), due_date < now, not cancelled.
//
// Wired in netlify.toml as a scheduled function (cron: "0 6 * * *" = 6am UTC daily).
// Logs flipped count + IDs to activity_log so the team has a paper trail.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

export const handler = async () => {
  try {
    const startedAt = new Date().toISOString();

    // Call the Postgres function we created
    const { data, error } = await supabase.rpc('flip_overdue_invoices');

    if (error) {
      console.error('flip_overdue_invoices RPC failed:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    const result = Array.isArray(data) ? data[0] : data;
    const flippedCount = result?.flipped_count || 0;
    const flippedIds = result?.flipped_ids || [];

    console.log(`Overdue check complete: ${flippedCount} invoices flipped`);
    if (flippedCount > 0) {
      console.log('Flipped invoice IDs:', flippedIds);

      // Log a single activity_log row summarizing the run
      await supabase.from('activity_log').insert({
        action: 'invoices_auto_overdue',
        category: 'invoice',
        metadata: {
          flipped_count: flippedCount,
          flipped_ids: flippedIds,
          run_at: startedAt,
        },
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        flipped_count: flippedCount,
        flipped_ids: flippedIds,
        ran_at: startedAt,
      }),
    };
  } catch (err) {
    console.error('Scheduled function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
