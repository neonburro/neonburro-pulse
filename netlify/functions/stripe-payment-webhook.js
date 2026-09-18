// netlify/functions/stripe-payment-webhook.js
// SENTINEL: NB_STRIPE_WEBHOOK_V2 (pulse copy)
//
// Receives Stripe events and updates NeonBurro invoice and sprint payment state.
//
// Events handled:
//   checkout.session.completed               card, Apple Pay, Google Pay, and
//                                            stablecoins when Stripe reports
//                                            the session paid straight away
//   checkout.session.async_payment_succeeded ACH and stablecoins that clear
//                                            after the redirect
//   checkout.session.async_payment_failed
//   charge.refunded
//
// All DB writes go through the service role key (RLS bypass, this is a server).
// Dedup is payments.stripe_session_id. Fires admin and client emails on success.
//
// ── two vocabularies, do not pass one through as the other ─────────────────
// Stripe names a payment method type in its own words: card, us_bank_account,
// crypto, link, cashapp. Our payments.method column has its own short list,
// enforced by a check constraint in the database:
//
//   ach, card, check, cash, crypto, other
//
// The first version of this file wrote Stripe's string straight into
// payments.method. That worked for card and would have failed the constraint
// on the very first ACH ('us_bank_account') or stablecoin ('crypto') payment,
// and because the handler returns 200 on application errors so Stripe does not
// retry forever, the failure would have been silent: sprints marked paid, the
// payments row missing, total_paid never recomputed, invoice never flipped,
// no receipt sent. methodFor() below is the translation and it is the only
// place the mapping lives. Stripe's raw type is still kept in the payments
// notes and in the emails so nothing is lost. If you add a value to the
// database check, add it here, and the other way round.
//
// ── invoices.rail_settled is deliberately not written here ─────────────────
// That column knows two rails, card (Stripe pulls) and stablecoin (a push to a
// wallet we hold, recorded in public.settlements, which stamps rail_settled
// through its trigger). USDC through Stripe is neither, it settles into the
// Stripe balance in dollars like a card. Nothing in Pulse reads rail_settled
// on invoices yet, so rather than mislabel it this file leaves it null and the
// vocabulary gets settled when the direct Solana rail is built. payment_method
// carries the truth in the meantime.
//
// ── this copy versus neonburro.com's ───────────────────────────────────────
// neonburro/netlify/functions/stripe-payment-webhook.js is the same handler
// plus subscription events. Pulse has no _shared.js so the Supabase key is
// resolved inline below, newest key format first. Both sites hold a
// STRIPE_WEBHOOK_SECRET, both process checkout events, and the payments
// dedup by stripe_session_id keeps a double delivery from double counting.
// Keep the two files in step, they are the same system of record.
//
// No oxford commas, no em dashes.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
// Newest key format first. A project that has disabled legacy keys returns
// 401 on the old service_role JWT with no other symptom.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'NeonBurro <invoices@neonburro.com>';
const ADMIN_FROM = 'NeonBurro Pulse <notifications@neonburro.com>';
const ADMIN_TO = ['hello@neonburro.com'];

// ============================================================
// HELPERS
// ============================================================

const currency = (val) =>
  `$${parseFloat(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const getMST = () =>
  new Date().toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' MT';

// Stripe payment_method.type -> payments.method. See the header.
const methodFor = (stripeType) => {
  switch (stripeType) {
    case null:
    case undefined:
    case '':
    case 'card':
      return 'card';
    case 'us_bank_account':
      return 'ach';
    case 'crypto':
      return 'crypto';
    default:
      return 'other';
  }
};

// Human line for the emails. Wallet first because Apple Pay and Google Pay
// arrive as type card with a wallet stamped on it.
const describeMethod = ({ stripeType, brand, last4, wallet, forClient }) => {
  if (wallet === 'apple_pay') return forClient ? 'Apple Pay' : `Apple Pay · ${brand || 'Card'} · ···· ${last4 || '----'}`;
  if (wallet === 'google_pay') return forClient ? 'Google Pay' : `Google Pay · ${brand || 'Card'} · ···· ${last4 || '----'}`;
  if (wallet) return forClient ? 'Digital wallet' : `${wallet} · ${brand || 'Card'} · ···· ${last4 || '----'}`;
  if (stripeType === 'us_bank_account') return forClient ? 'Bank transfer (ACH)' : 'ACH Bank Transfer';
  if (stripeType === 'crypto') return forClient ? 'Stablecoin (USDC via Stripe)' : 'Stablecoin · USDC via Stripe';
  return forClient ? `${brand || 'Card'} ending ···· ${last4 || '----'}` : `${brand || 'Card'} · ···· ${last4 || '----'}`;
};

// ============================================================
// SUPABASE REST HELPERS (service role, bypasses RLS)
// ============================================================

const sbFetch = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const sbGet = (table, query) => sbFetch(`${table}?${query}`);
const sbUpdate = (table, id, data) =>
  sbFetch(`${table}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
const sbInsert = (table, data, prefer = 'return=minimal') =>
  sbFetch(table, {
    method: 'POST',
    body: JSON.stringify(data),
    prefer,
  });

// ============================================================
// EMAIL
// ============================================================

const sendEmail = async (from, to, subject, html, replyTo) => {
  const payload = { from, to: Array.isArray(to) ? to : [to], subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Email send failed');
  return result;
};

// ============================================================
// ADMIN EMAIL (payment received)
// ============================================================

const buildAdminPaymentEmail = ({ invoice, client, stripeType, brand, last4, wallet, amount, totalPaid, invoiceTotal, isFull }) => {
  const methodLine = describeMethod({ stripeType, brand, last4, wallet, forClient: false });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Received</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:28px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0A0A0A;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#141414;border-bottom:2px solid #39FF14;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="color:#39FF14;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Payment Received</div>
                  <div style="color:#ffffff;font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;">${invoice.invoice_number}</div>
                  <div style="color:#737373;font-size:11px;margin-top:2px;">${getMST()}</div>
                </td>
                <td style="text-align:right;vertical-align:top;">
                  <div style="background:#39FF14;color:#0A0A0A;font-size:11px;font-weight:800;padding:5px 14px;border-radius:100px;display:inline-block;">${isFull ? 'Paid in full' : 'Partial'}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #1f1f1f;border-radius:10px;margin-bottom:20px;">
              <tr><td style="padding:14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="color:#737373;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Client</div>
                      <div style="color:#ffffff;font-size:14px;font-weight:700;">${client.name || 'Client'}</div>
                      <div style="color:#a0a0a0;font-size:12px;">${client.email || ''}</div>
                    </td>
                    <td style="text-align:right;">
                      <div style="color:#737373;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Method</div>
                      <div style="color:#ffffff;font-size:13px;font-weight:700;">${methodLine}</div>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #1f1f1f;border-radius:10px;margin-bottom:20px;">
              <tr><td style="padding:14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#39FF14;font-size:13px;font-weight:700;padding:3px 0;">This payment</td>
                    <td style="text-align:right;color:#39FF14;font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;padding:3px 0;">${currency(amount)}</td>
                  </tr>
                  <tr style="border-top:1px solid #1f1f1f;">
                    <td style="color:#a0a0a0;font-size:12px;padding:6px 0 0;">Total paid</td>
                    <td style="text-align:right;color:#ffffff;font-size:14px;font-weight:800;font-family:'JetBrains Mono',monospace;padding:6px 0 0;">${currency(totalPaid)} / ${currency(invoiceTotal)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="text-align:center;">
                <a href="https://pulse.neonburro.com/invoicing/" style="display:inline-block;background:#00E5E5;color:#0A0A0A;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:800;font-size:13px;">View in Pulse</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 32px;border-top:1px solid #1f1f1f;text-align:center;">
            <div style="color:#737373;font-size:11px;">Pulse · ${getMST()}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ============================================================
// CLIENT RECEIPT EMAIL
// ============================================================

const buildClientReceiptEmail = ({ invoice, client, amount, totalPaid, invoiceTotal, isFull, stripeType, brand, last4, wallet }) => {
  const methodLine = describeMethod({ stripeType, brand, last4, wallet, forClient: true });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Received</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:28px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0A0A0A;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 24px;text-align:center;">
            <img src="https://pulse.neonburro.com/neon-burro-email-logo.png" alt="Neon Burro" width="48" height="48" style="display:inline-block;border-radius:50%;margin-bottom:20px;" />
            <div style="width:48px;height:2px;background:#39FF14;margin:0 auto 16px;"></div>
            <div style="color:#39FF14;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${isFull ? 'Payment Received' : 'Partial Payment Received'}</div>
            <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-0.02em;">Thank you${client.name ? `, ${client.name.split(' ')[0]}` : ''}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #1f1f1f;border-radius:12px;padding:4px;">
              <tr>
                <td style="padding:18px 20px;border-bottom:1px solid #1f1f1f;">
                  <div style="color:#737373;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Invoice</div>
                  <div style="color:#00E5E5;font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace;">${invoice.invoice_number}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 20px;border-bottom:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#a0a0a0;font-size:13px;">Amount</td>
                      <td style="text-align:right;color:#39FF14;font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;">${currency(amount)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 20px;border-bottom:1px solid #1f1f1f;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#a0a0a0;font-size:13px;">Method</td>
                      <td style="text-align:right;color:#ffffff;font-size:13px;font-weight:600;">${methodLine}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${!isFull ? `
              <tr>
                <td style="padding:18px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#a0a0a0;font-size:13px;">Remaining</td>
                      <td style="text-align:right;color:#FFE500;font-size:14px;font-weight:700;font-family:'JetBrains Mono',monospace;">${currency(invoiceTotal - totalPaid)}</td>
                    </tr>
                  </table>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:18px 20px;text-align:center;">
                  <div style="color:#39FF14;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">✓ Fully Funded</div>
                </td>
              </tr>`}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 28px;">
            <div style="background:#141414;border:1px solid #1f1f1f;border-radius:12px;padding:18px 22px;text-align:center;">
              <div style="color:#737373;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Questions?</div>
              <div style="color:#a0a0a0;font-size:12px;line-height:1.6;">
                Reply to this email or reach us at <a href="mailto:hello@neonburro.com" style="color:#00E5E5;font-weight:600;text-decoration:none;">hello@neonburro.com</a>
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 40px;border-top:1px solid #1f1f1f;text-align:center;">
            <div style="color:#737373;font-size:11px;">Real people. Clear responses.</div>
            <div style="color:#525252;font-size:10px;margin-top:6px;">Powered by Neon Burro</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ============================================================
// CORE: process a successful checkout session
// ============================================================

const processCheckoutSuccess = async (session) => {
  const { invoice_id, sprint_ids, invoice_number } = session.metadata || {};

  if (!invoice_id || !sprint_ids) {
    console.warn('Webhook missing metadata', { invoice_id, sprint_ids });
    return { success: false, reason: 'missing metadata' };
  }

  // Dedup. Was this session already processed?
  const existing = await sbGet('payments', `stripe_session_id=eq.${session.id}&select=id`);
  if (existing && existing.length > 0) {
    console.log(`Session ${session.id} already processed, skipping`);
    return { success: true, reason: 'already processed' };
  }

  // Pull down the payment intent to get method details (card brand, last4, wallet)
  let brand = null;
  let last4 = null;
  let wallet = null;
  let stripeType = null;

  if (session.payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ['payment_method'],
      });
      const pm = pi.payment_method;
      if (pm) {
        stripeType = pm.type;
        if (pm.card) {
          brand = pm.card.brand;
          last4 = pm.card.last4;
          wallet = pm.card.wallet?.type || null;
        } else if (pm.us_bank_account) {
          brand = pm.us_bank_account.bank_name;
          last4 = pm.us_bank_account.last4;
        }
      }
    } catch (err) {
      console.warn('Could not retrieve payment intent details:', err.message);
    }
  }

  // Our vocabulary from here on. See the header.
  const method = methodFor(stripeType);

  // Fetch invoice and items
  const invoices = await sbGet('invoices', `id=eq.${invoice_id}&select=*`);
  const invoice = invoices?.[0];
  if (!invoice) {
    throw new Error(`Invoice ${invoice_id} not found`);
  }

  const allItems = await sbGet('invoice_items', `invoice_id=eq.${invoice_id}&order=sort_order`);
  const sprintIdArray = sprint_ids.split(',').filter(Boolean);
  const paidSprints = (allItems || []).filter((item) => sprintIdArray.includes(item.id));

  // Amount received from Stripe (in dollars, not cents)
  const amountReceived = session.amount_total / 100;

  // Distribute the received amount across the sprints by their due_now
  const now = new Date().toISOString();
  for (const sprint of paidSprints) {
    const amount = parseFloat(sprint.amount || 0);
    const alreadyPaid = parseFloat(sprint.payment_amount || 0);
    const mode = sprint.payment_mode || 'approve_only';

    let newPaymentAmount = alreadyPaid;
    if (mode === 'pay_full') newPaymentAmount = amount;
    else if (mode === 'deposit_50') newPaymentAmount = Math.max(alreadyPaid, amount * 0.5);

    await sbUpdate('invoice_items', sprint.id, {
      payment_status: 'paid',
      payment_amount: newPaymentAmount,
      payment_method: method,
      payment_method_brand: brand,
      payment_method_last4: last4,
      payment_method_wallet: wallet,
      payment_reference: session.payment_intent,
      paid_at: now,
      locked: true,
      updated_at: now,
    });
  }

  // Insert payments row (one per session). method must satisfy the database
  // check constraint, which is why it went through methodFor above.
  await sbInsert('payments', {
    invoice_id,
    client_id: invoice.client_id,
    amount: amountReceived,
    method,
    stripe_payment_id: session.payment_intent,
    stripe_session_id: session.id,
    payment_method_brand: brand,
    payment_method_last4: last4,
    payment_method_wallet: wallet,
    sprint_ids: sprintIdArray,
    reference_number: invoice.invoice_number,
    notes: `Stripe checkout · ${stripeType || 'card'}`,
    received_at: now,
    created_at: now,
  });

  // Recompute total_paid from all items for this invoice
  const refreshedItems = await sbGet('invoice_items', `invoice_id=eq.${invoice_id}&select=payment_amount,amount`);
  const totalPaid = (refreshedItems || []).reduce(
    (sum, i) => sum + parseFloat(i.payment_amount || 0),
    0
  );
  const invoiceTotal = parseFloat(invoice.total || 0);
  const isFull = totalPaid >= invoiceTotal - 0.01; // tolerance for float math

  const newStatus = isFull ? 'paid' : 'partial';
  await sbUpdate('invoices', invoice_id, {
    total_paid: totalPaid,
    status: newStatus,
    payment_method: method,
    stripe_payment_id: session.payment_intent,
    paid_at: isFull ? now : null,
    receipt_sent_at: now,
    updated_at: now,
  });

  // ── THE RECEIPT SENDS ITSELF ────────────────────────────────────────────
  // Tyler, 2026-09-17. The moment an invoice is settled in full, everyone who
  // had the invoice gets the stamped receipt, without a thumb. It is the same
  // document resend-invoice.js builds for a paid invoice, called over HTTP on
  // this site so there is one place the receipt is made. Only on the crossing
  // into paid, a retry of the same session finds the row already paid above
  // and never reaches here. A failure here never fails the webhook, the
  // payment is recorded and the receipt can be sent by hand from the editor.
  if (isFull && invoice.status !== 'paid') {
    const site = process.env.URL || 'https://pulse.neonburro.com';
    fetch(`${site}/.netlify/functions/resend-invoice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice_id, action: 'resend', userId: null, auto: 'receipt' }),
    }).then(async (r) => {
      if (!r.ok) console.warn('[webhook] receipt did not send', r.status, (await r.text()).slice(0, 200));
    }).catch((e) => console.warn('[webhook] receipt did not send', e.message));
  }

  // Activity log
  await sbInsert('activity_log', {
    action: isFull ? 'invoice_paid' : 'invoice_partial',
    entity_type: 'invoice',
    entity_id: invoice_id,
    client_id: invoice.client_id,
    metadata: {
      invoice_number: invoice.invoice_number,
      amount: amountReceived,
      total_paid: totalPaid,
      total: invoiceTotal,
      method,
      stripe_type: stripeType,
      brand,
      last4,
      wallet,
      sprint_count: paidSprints.length,
      stripe_session_id: session.id,
    },
    created_at: now,
  });

  // Fetch client for emails
  let client = { name: 'Client', email: '' };
  if (invoice.client_id) {
    const clients = await sbGet('clients', `id=eq.${invoice.client_id}&select=*`);
    if (clients?.[0]) client = clients[0];
  }

  // Fire emails (non blocking)
  const emailContext = {
    invoice,
    client,
    amount: amountReceived,
    totalPaid,
    invoiceTotal,
    isFull,
    stripeType,
    brand,
    last4,
    wallet,
  };

  if (client.email) {
    sendEmail(
      FROM_EMAIL,
      [client.email],
      `Payment received · ${invoice.invoice_number}`,
      buildClientReceiptEmail(emailContext)
    ).catch((err) => console.error('Client receipt email failed:', err));
  }

  sendEmail(
    ADMIN_FROM,
    ADMIN_TO,
    `Payment received: ${invoice.invoice_number} · ${currency(amountReceived)}`,
    buildAdminPaymentEmail(emailContext),
    client.email
  ).catch((err) => console.error('Admin notification email failed:', err));

  return {
    success: true,
    invoice_id,
    amount: amountReceived,
    status: newStatus,
  };
};

// ============================================================
// REFUND HANDLING
// ============================================================

const processRefund = async (charge) => {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  // Find the payment record for this payment_intent
  const payments = await sbGet('payments', `stripe_payment_id=eq.${paymentIntentId}&select=*`);
  if (!payments || payments.length === 0) {
    console.warn(`No payment record for payment_intent ${paymentIntentId}`);
    return;
  }

  const payment = payments[0];
  const now = new Date().toISOString();
  const refundAmount = charge.amount_refunded / 100;

  // Log to activity
  await sbInsert('activity_log', {
    action: 'invoice_refunded',
    entity_type: 'invoice',
    entity_id: payment.invoice_id,
    client_id: payment.client_id,
    metadata: {
      payment_id: payment.id,
      refund_amount: refundAmount,
      charge_id: charge.id,
      payment_intent_id: paymentIntentId,
    },
    created_at: now,
  });

  // Fire admin alert. Stablecoin refunds go back on chain to the original
  // wallet, Stripe handles that, the note here is the same either way.
  await sendEmail(
    ADMIN_FROM,
    ADMIN_TO,
    `⚠️ Refund processed · ${currency(refundAmount)}`,
    `<p>A refund of <strong>${currency(refundAmount)}</strong> was processed for payment intent <code>${paymentIntentId}</code>.</p>
     <p>Review in <a href="https://pulse.neonburro.com/invoicing/">Pulse</a> and update sprint statuses manually if needed.</p>`
  ).catch((err) => console.error('Refund email failed:', err));

  console.log(`Refund logged: ${currency(refundAmount)} for payment ${payment.id}`);
};

// ============================================================
// HANDLER
// ============================================================

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return { statusCode: 500, body: 'Webhook not configured' };
  }

  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!sig) {
    return { statusCode: 400, body: 'Missing stripe-signature header' };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log(`Stripe webhook: ${stripeEvent.type} · ${stripeEvent.id}`);

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // For ACH and stablecoins, checkout.session.completed can fire with
        // payment_status 'unpaid' and async_payment_succeeded fires when the
        // money clears. For card, completed already carries payment_status 'paid'.
        const session = stripeEvent.data.object;
        if (session.payment_status === 'paid') {
          await processCheckoutSuccess(session);
        } else {
          console.log(`Session ${session.id} not yet paid (status: ${session.payment_status}), awaiting async event`);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = stripeEvent.data.object;
        const { invoice_id } = session.metadata || {};
        if (invoice_id) {
          await sbInsert('activity_log', {
            action: 'invoice_payment_failed',
            entity_type: 'invoice',
            entity_id: invoice_id,
            metadata: {
              stripe_session_id: session.id,
              reason: session.last_payment_error?.message || 'Async payment failed',
            },
            created_at: new Date().toISOString(),
          });
        }
        break;
      }

      case 'charge.refunded': {
        await processRefund(stripeEvent.data.object);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 200 so Stripe does not retry indefinitely on application errors
    // (signature errors already returned 400 above). This is also why a bad
    // write here is silent, see the header, and why the method mapping exists.
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, error: err.message }),
    };
  }
};
