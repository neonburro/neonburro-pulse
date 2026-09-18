// netlify/functions/draft-repeat-invoices.js
// SENTINEL: NB_PULSE_DRAFT_REPEAT_V1
//
// THE MONTHLY DRAFT THAT WRITES ITSELF, AND SENDS NOTHING
//
// Tyler, 2026-09-17. A recurring arrangement on a push rail, the tending kind
// where we invoice and wait, should not depend on somebody remembering the
// first of the month. This runs every morning, finds every active subscription
// whose next_invoice_at has arrived, and drafts the invoice for the period,
// numbered, with one line, in Invoicing, unsent. A person reads it and presses
// Send. Nothing here ever leaves the building.
//
// ── WHAT IT MIRRORS ─────────────────────────────────────────────────────────
// The Raise the invoice button in src/pages/Clients/components/SubscriptionsTab.jsx
// does this by hand. This is the same row shape with two things the button
// skips, an invoice_number from next_invoice_number() and a real line item so
// the letterhead has something to print. If the button changes shape, change
// this to match, the two must write the same invoice.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// status in (active, past_due), next_invoice_at <= now. A card subscription has
// next_invoice_at null because Stripe pulls it, so it is never touched here.
// After drafting, the period rolls forward one interval and next_invoice_at
// becomes the new period end, so the same period is never drafted twice. A
// draft already sitting on that exact period_start is the second guard.
//
// Scheduled in netlify.toml, "0 12 * * *", six in the morning in Ridgway. The
// inline config below must agree with the toml, see the toml's note.
//
// No oxford commas, no em dashes.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const addInterval = (date, sub) => {
  const d = new Date(date);
  const n = Math.max(1, parseInt(sub.interval_count, 10) || 1);
  if (sub.interval === 'year') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return d;
};

const periodLabel = (start, end) => {
  const f = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' });
  return `${f(start)} to ${f(end)}`;
};

const nextInvoiceNumber = async () => {
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error || !data) {
    const now = new Date();
    return `NB${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getTime()).slice(-4)}`;
  }
  return data;
};

const draftOne = async (sub) => {
  const start = sub.current_period_end ? new Date(sub.current_period_end) : new Date(sub.next_invoice_at);
  const end = addInterval(start, sub);

  // Second guard. A draft on this exact period already exists, leave it.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('subscription_id', sub.id)
    .eq('period_start', start.toISOString())
    .limit(1);
  if (existing && existing.length) return { skipped: true, invoice: existing[0] };

  const number = await nextInvoiceNumber();
  const dueDate = new Date(start);
  dueDate.setDate(dueDate.getDate() + 14);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      client_id: sub.client_id,
      subscription_id: sub.id,
      source: 'subscription',
      status: 'draft',
      invoice_number: number,
      total: sub.amount,
      total_paid: 0,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      rail_offered: [sub.rail || 'stablecoin'],
      due_date: dueDate.toISOString().slice(0, 10),
      notes: sub.notes || null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  const { data: sprintNumber } = await supabase.rpc('next_sprint_number', { p_invoice_id: invoice.id });
  const included = Array.isArray(sub.included) ? sub.included.filter(Boolean) : [];
  const description = [
    `${periodLabel(start, end)}.`,
    sub.description || null,
    included.length ? `Included, ${included.join(', ')}.` : null,
  ].filter(Boolean).join(' ');

  const { error: itemError } = await supabase.from('invoice_items').insert({
    invoice_id: invoice.id,
    sprint_number: sprintNumber || null,
    title: sub.name,
    description,
    amount: sub.amount,
    payment_mode: 'pay_full',
    is_billable: true,
    sort_order: 0,
    created_at: new Date().toISOString(),
  });
  if (itemError) throw itemError;

  await supabase
    .from('subscriptions')
    .update({
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      next_invoice_at: end.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  await supabase.from('activity_log').insert({
    action: 'invoice_drafted_from_subscription',
    entity_type: 'invoice',
    entity_id: invoice.id,
    client_id: sub.client_id,
    category: 'invoice',
    metadata: {
      invoice_number: invoice.invoice_number,
      subscription_id: sub.id,
      subscription_number: sub.subscription_number,
      name: sub.name,
      amount: sub.amount,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      by: 'draft-repeat-invoices',
    },
    created_at: new Date().toISOString(),
  });

  return { skipped: false, invoice };
};

export const handler = async () => {
  const startedAt = new Date().toISOString();
  try {
    const { data: due, error } = await supabase
      .from('subscriptions')
      .select('*')
      .in('status', ['active', 'past_due'])
      .not('next_invoice_at', 'is', null)
      .lte('next_invoice_at', startedAt)
      .order('next_invoice_at');
    if (error) throw error;

    const drafted = [];
    const skipped = [];
    const failed = [];
    for (const sub of due || []) {
      try {
        const r = await draftOne(sub);
        (r.skipped ? skipped : drafted).push({ subscription: sub.subscription_number || sub.id, invoice: r.invoice.invoice_number || r.invoice.id });
      } catch (e) {
        console.error('[draft-repeat-invoices] failed', sub.id, e.message);
        failed.push({ subscription: sub.subscription_number || sub.id, reason: e.message });
      }
    }
    console.log(`[draft-repeat-invoices] due ${due?.length || 0}, drafted ${drafted.length}, skipped ${skipped.length}, failed ${failed.length}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ran_at: startedAt, drafted, skipped, failed }) };
  } catch (err) {
    console.error('[draft-repeat-invoices] error', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

export const config = { schedule: '0 12 * * *' };
