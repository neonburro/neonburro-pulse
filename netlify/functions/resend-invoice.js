// netlify/functions/resend-invoice.js
// V4, recipients lists on resend and reminder, 2026-09-17.
// resend:   re-fires stored rendered_html (already the light template), or
//           draws it again from the live rows, then from the snapshot.
// receipt:  a paid invoice resent goes out stamped, drawn from the live rows.
// reminder: editorial nudge, now light-mode with banner.
// Admin audit emails also light-mode with banner. Palette from emailTokens.js.

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { buildInvoiceEmailHTML } from '../../src/lib/invoiceEmailTemplate.js';
import { EMAIL } from '../../src/lib/emailTokens.js';

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL = 'NeonBurro <hello@neonburro.com>';
const ADMIN_FROM = 'NeonBurro Pulse <notifications@neonburro.com>';
const ADMIN_TO = ['hello@neonburro.com'];

const resend = new Resend(RESEND_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const formatCurrency = (n) => {
  const num = parseFloat(n || 0);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const getMST = () =>
  new Date().toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' MT';

const sanitizeCcList = (raw, primaryEmail) => {
  if (!Array.isArray(raw)) return [];
  const primary = String(primaryEmail || '').trim().toLowerCase();
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const e = String(entry || '').trim().toLowerCase();
    if (!e) continue;
    if (e === primary) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
};

const fetchAdminName = async (userId) => {
  if (!userId) return 'Pulse';
  const { data } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return 'Pulse';
  return data.display_name || data.username || 'Pulse';
};

const rebuildHtmlFromSnapshot = async ({ invoice, snapshot }) => {
  if (!snapshot) return null;

  let client = {
    name: snapshot.client_name || 'Client',
    email: snapshot.client_email || '',
    company: snapshot.client_company || null,
  };
  if (invoice.client_id) {
    const { data } = await supabase.from('clients').select('*').eq('id', invoice.client_id).maybeSingle();
    if (data) client = data;
  }

  let project = null;
  if (invoice.project_id) {
    const { data } = await supabase.from('projects').select('*').eq('id', invoice.project_id).maybeSingle();
    if (data) project = data;
  } else if (snapshot.project_name) {
    project = { name: snapshot.project_name, project_number: snapshot.project_number };
  }

  const lineItems = (snapshot.line_items || []).map((item) => ({
    sprint_number: item.sprint_number,
    title: item.title,
    description: item.description,
    amount: item.amount,
    payment_mode: item.payment_mode,
    is_billable: true,
  }));

  // Metadata only. This is the fallback path used when the stored rendered_html
  // is missing, and that stored html already lists the attachments, so this is
  // only here so the rebuilt version does not come out different.
  const { data: attachmentRows } = await supabase
    .from('invoice_attachments')
    .select('filename, label')
    .eq('invoice_id', invoice.id)
    .order('sort_order');

  return buildInvoiceEmailHTML({
    invoice, client, project, lineItems,
    attachments: attachmentRows || [],
    invoiceDate: snapshot.invoice_date || new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }),
    payUrl: snapshot.pay_url || (invoice.pay_token
      ? `https://neonburro.com/pay/?token=${invoice.pay_token}`
      : 'https://neonburro.com/account/'),
    paid: invoice.status === 'paid',
    paidAt: invoice.paid_at || null,
    paidBy: invoice.status === 'paid' ? await paidByFor(invoice) : null,
  });
};

// ── PAID BY, THE LINE ON THE RECEIPT ────────────────────────────────────────
// Tyler, 2026-09-17. The receipt names how it was paid, from the payments rows
// when Stripe wrote them (brand, last four, wallet, ACH, USDC) and from the
// invoice's own payment_method when a person marked it paid by hand (check,
// Zelle, wire). One short line, never a card number, never a reference the
// client did not give us. Null when nothing is known and the row prints
// nothing.
const HAND_METHODS = { bank_transfer: 'Bank transfer', venmo: 'Venmo', zelle: 'Zelle', check: 'Check', ach: 'ACH', wire: 'Wire', cash: 'Cash', card: 'Card', crypto: 'USDC', other: null };
const paidByFor = async (invoice) => {
  const { data: rows } = await supabase
    .from('payments')
    .select('method, payment_method_brand, payment_method_last4, payment_method_wallet, notes, received_at')
    .eq('invoice_id', invoice.id)
    .order('received_at', { ascending: false })
    .limit(3);
  const lines = (rows || []).map((r) => {
    const brand = r.payment_method_brand ? r.payment_method_brand.charAt(0).toUpperCase() + r.payment_method_brand.slice(1) : null;
    if (r.payment_method_wallet === 'apple_pay') return 'Apple Pay';
    if (r.payment_method_wallet === 'google_pay') return 'Google Pay';
    if (r.method === 'ach') return 'Bank transfer, ACH';
    if (r.method === 'crypto') return 'USDC';
    if (r.method === 'card') return brand && r.payment_method_last4 ? `${brand} ending ${r.payment_method_last4}` : 'Card';
    return HAND_METHODS[r.method] || null;
  }).filter(Boolean);
  const unique = [...new Set(lines)];
  if (unique.length) return unique.join(', ');
  const hand = HAND_METHODS[invoice.payment_method] || null;
  if (hand) return invoice.payment_reference ? `${hand}, ${invoice.payment_reference}` : hand;
  return null;
};

// ── THE LIVE ROWS ARE THE TRUTH FOR A RECEIPT ───────────────────────────────
//
// 2026-09-17, Tyler pressed Send the receipt on NB260801 and got "the original
// snapshot is missing". Two ways that happens. The invoice was first sent
// before invoice_snapshot existed, so no history row carries one. Or the
// latest history row is a reminder, which never stores a snapshot, and the
// query took the latest row of any kind. Either way the invoice's own rows are
// still in the database, so a receipt has no business failing.
//
// This builds the document from invoices, invoice_items, clients and projects
// as they stand now. For a paid invoice that is better than the snapshot
// anyway, the live items carry payment_status and the template marks each
// settled line paid, which a snapshot cannot. The snapshot stays the record
// of what was sent the first time. It is not the only way to draw the
// document again.
const buildHtmlFromLiveRows = async ({ invoice }) => {
  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('sort_order');
  const lineItems = (items || []).filter((i) => i.is_billable !== false);
  if (!lineItems.length) return null;

  let client = { name: invoice.clients?.name || 'Client', email: invoice.clients?.email || '', company: invoice.clients?.company || null };
  if (invoice.client_id) {
    const { data } = await supabase.from('clients').select('*').eq('id', invoice.client_id).maybeSingle();
    if (data) client = data;
  }
  let project = null;
  if (invoice.project_id) {
    const { data } = await supabase.from('projects').select('*').eq('id', invoice.project_id).maybeSingle();
    if (data) project = data;
  }
  const { data: attachmentRows } = await supabase
    .from('invoice_attachments')
    .select('filename, label')
    .eq('invoice_id', invoice.id)
    .order('sort_order');

  const sentAt = invoice.sent_at ? new Date(invoice.sent_at) : new Date();
  return buildInvoiceEmailHTML({
    invoice, client, project, lineItems,
    attachments: attachmentRows || [],
    invoiceDate: sentAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    payUrl: invoice.pay_token
      ? `https://neonburro.com/pay/?token=${invoice.pay_token}`
      : 'https://neonburro.com/account/',
    paid: invoice.status === 'paid',
    paidAt: invoice.paid_at || null,
    paidBy: invoice.status === 'paid' ? await paidByFor(invoice) : null,
  });
};

// ── BACKUP DOCUMENTS, PULLED FROM THE PRIVATE BUCKET ────────────────────────
// invoice-attachments has no anon read policy on purpose, these are supplier
// invoices carrying wholesale pricing. The service role reads the bytes and
// they ride as real attachments. See netlify/functions/send-invoice.js.
const loadAttachmentsForEmail = async (invoiceId) => {
  const { data: rows } = await supabase
    .from('invoice_attachments')
    .select('storage_path, filename')
    .eq('invoice_id', invoiceId)
    .order('sort_order');

  const out = [];
  for (const row of rows || []) {
    const { data, error } = await supabase.storage
      .from('invoice-attachments')
      .download(row.storage_path);
    // A missing file must not silently drop off a resend, the document says it
    // is attached.
    if (error) throw new Error(`Could not read attachment "${row.filename}": ${error.message}`);
    const buf = Buffer.from(await data.arrayBuffer());
    out.push({ filename: row.filename, content: buf.toString('base64') });
  }
  return out;
};

// ---------- client-facing reminder email — light, banner-led ----------

const buildReminderEmail = ({ recipientName, bodyText, invoiceNumber, amountDue, payUrl, adminName }) => {
  const safeName = escapeHtml(recipientName || 'there');
  const safeBody = escapeHtml(bodyText).replace(/\n/g, '<br>');
  const safeAdmin = escapeHtml(adminName || 'The NeonBurro Team');
  const safeNumber = escapeHtml(invoiceNumber);
  const safeAmount = formatCurrency(amountDue);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${EMAIL.page};font-family:'Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.page};padding:28px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:${EMAIL.card};border:1px solid ${EMAIL.line};border-radius:16px;overflow:hidden;">
        <tr><td style="line-height:0;background:${EMAIL.card};">
          <img src="${EMAIL.banner}" alt="NeonBurro" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <div style="color:${EMAIL.bananaDeep};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">A gentle signal from NeonBurro</div>
          <div style="width:48px;height:2px;background:${EMAIL.signal};margin:0 0 18px 0;border-radius:1px;"></div>

          <div style="color:${EMAIL.ink};font-size:24px;font-weight:800;margin-bottom:6px;line-height:1.25;">Hi ${safeName},</div>
          <div style="color:${EMAIL.inkSec};font-size:15px;line-height:1.7;margin-bottom:28px;">${safeBody}</div>

          <table cellpadding="0" cellspacing="0" style="background:${EMAIL.raised};border:1px solid ${EMAIL.line};border-radius:12px;width:100%;margin-bottom:24px;">
            <tr>
              <td style="padding:18px 20px;">
                <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Invoice</div>
                <div style="color:${EMAIL.ink};font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:0.04em;">${safeNumber}</div>
              </td>
              <td style="padding:18px 20px;text-align:right;border-left:1px solid ${EMAIL.line};">
                <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Due</div>
                <div style="color:${EMAIL.bananaDeep};font-size:16px;font-weight:800;font-family:'JetBrains Mono',monospace;">${safeAmount}</div>
              </td>
            </tr>
          </table>

          <a href="${payUrl}" style="display:block;background:${EMAIL.signal};color:${EMAIL.ink};text-decoration:none;padding:16px 28px;border-radius:100px;font-weight:800;font-size:14px;text-align:center;letter-spacing:0.02em;">View &amp; Pay Invoice</a>

          <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${EMAIL.line};">
            <div style="color:${EMAIL.ink};font-size:14px;font-weight:700;margin-bottom:4px;">${safeAdmin}</div>
            <div style="color:${EMAIL.inkMuted};font-size:12px;">
              <a href="https://neonburro.com/" style="color:${EMAIL.signalDeep};text-decoration:none;">neonburro.com</a> · (970) 973-8550
            </div>
          </div>
        </td></tr>
      </table>
      <div style="max-width:600px;margin-top:20px;color:${EMAIL.inkMuted};font-size:11px;line-height:1.5;">
        Reply to this email if you have any questions about this invoice.
      </div>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
};

// ---------- admin audit email — light, banner-led ----------

const buildAdminAuditEmail = ({
  action, invoice, client, recipientEmail, ccList, adminName, amountDue,
  reminderSubject, reminderBody, rebuiltFromSnapshot,
}) => {
  const safeNumber = escapeHtml(invoice.invoice_number);
  const safeClient = escapeHtml(client?.name || 'Client');
  const safeRecipient = escapeHtml(recipientEmail);
  const safeAdmin = escapeHtml(adminName);

  const accentColor = EMAIL.signalDeep;
  const actionLabel = action === 'receipt' ? 'Receipt Sent' : action === 'resend' ? 'Invoice Resent' : 'Reminder Sent';
  const actionSub = action === 'receipt'
    ? 'The paid document, stamped, drawn from the live rows'
    : action === 'resend'
      ? `Same email re-delivered${rebuiltFromSnapshot ? ' (rebuilt from archived snapshot)' : ''}`
      : 'Editorial nudge dispatched';

  const ccBlock = ccList && ccList.length > 0
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.raised};border:1px solid ${EMAIL.line};border-radius:10px;margin-bottom:20px;">
        <tr><td style="padding:12px 16px;">
          <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">CC'd (${ccList.length})</div>
          <div style="color:${EMAIL.inkSec};font-size:12px;line-height:1.6;">${ccList.map(escapeHtml).join(' · ')}</div>
        </td></tr>
      </table>`
    : '';

  const reminderBlock = action === 'reminder'
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.raised};border:1px solid ${EMAIL.line};border-radius:10px;margin-bottom:20px;">
        <tr><td style="padding:14px 16px;">
          ${reminderSubject ? `
          <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Subject</div>
          <div style="color:${EMAIL.ink};font-size:13px;font-weight:600;margin-bottom:10px;">${escapeHtml(reminderSubject)}</div>
          ` : ''}
          <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Body</div>
          <div style="color:${EMAIL.inkSec};font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(reminderBody || '')}</div>
        </td></tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${actionLabel}</title></head>
<body style="margin:0;padding:0;background:${EMAIL.page};font-family:'Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.page};padding:28px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${EMAIL.card};border:1px solid ${EMAIL.line};border-radius:16px;overflow:hidden;">
        <tr><td style="line-height:0;background:${EMAIL.card};">
          <img src="${EMAIL.banner}" alt="NeonBurro" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
        </td></tr>
        <tr>
          <td style="padding:24px 32px 0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="color:${accentColor};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">${actionLabel}</div>
                  <div style="color:${EMAIL.ink};font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;">${safeNumber}</div>
                  <div style="color:${EMAIL.inkMuted};font-size:11px;margin-top:2px;">${getMST()} · by ${safeAdmin}</div>
                </td>
                <td style="text-align:right;vertical-align:top;">
                  <div style="background:${EMAIL.banana};color:${EMAIL.ink};font-size:11px;font-weight:800;padding:5px 14px;border-radius:100px;display:inline-block;">${formatCurrency(amountDue)} due</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 8px 32px;">
            <div style="color:${EMAIL.inkSec};font-size:13px;line-height:1.6;margin-bottom:20px;">${actionSub}.</div>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.raised};border:1px solid ${EMAIL.line};border-radius:10px;margin-bottom:20px;">
              <tr><td style="padding:14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Client</div>
                      <div style="color:${EMAIL.ink};font-size:14px;font-weight:700;">${safeClient}</div>
                      <div style="color:${EMAIL.inkSec};font-size:12px;">${safeRecipient}</div>
                    </td>
                    <td style="text-align:right;">
                      <div style="color:${EMAIL.inkMuted};font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Sent By</div>
                      <div style="color:${EMAIL.ink};font-size:14px;font-weight:700;">${safeAdmin}</div>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            ${ccBlock}
            ${reminderBlock}

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="text-align:center;padding:8px 0 0 0;">
                <a href="https://pulse.neonburro.com/invoicing/?invoice=${invoice.id}" style="display:inline-block;background:${EMAIL.signal};color:${EMAIL.ink};text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:800;font-size:13px;">View in Pulse</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 32px;border-top:1px solid ${EMAIL.line};text-align:center;">
            <div style="color:${EMAIL.inkMuted};font-size:11px;">Pulse · ${getMST()}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ---------- resend handler ----------

// ── SENDING A COPY SOMEWHERE ELSE ─────────────────────────────────────────
//
// toOverride sends the SAME stored document to a different address. It is for
// the case where a client's bookkeeper, partner or accounts inbox needs the
// invoice and it was only ever sent to one person.
//
// Three things it deliberately does not do. It does not change who the invoice
// is addressed to, the document is the stored html and is untouched. It does
// not carry the client's cc list, because those people already had it and a
// forward is a separate errand. And it records send_type "forward" rather than
// "resend", so the history can always answer whether a client was emailed again
// or whether a copy went to a third party.
//
// Validated on the server as well as in the modal. Never trust a client side
// regex on the one field that decides where an invoice goes.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// recipients, V4, Tyler's ask of 2026-09-17, a list of addresses shown and
// edited in the modal. When it is given it is the whole list, to and cc, and
// toOverride is ignored. The client on the list makes it a resend, the client
// absent makes it a forward, the history says which and names everyone.
const cleanRecipients = (list) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const e = String(raw || '').trim().toLowerCase();
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
};

const handleResend = async ({ invoiceId, userId, toOverride, recipients }) => {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(name, email, company)')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) throw new Error('Invoice not found');
  if (invoice.cancelled_at) throw new Error('Cannot resend a cancelled invoice');
  if (!invoice.clients?.email) throw new Error('Client has no email on file');

  // The history is read twice, on purpose. The latest row of any kind says
  // who last had it. The latest row that actually carries a document, and
  // is not a reminder, is the one a resend can re-fire. A reminder stores
  // its own html and no snapshot, and picking it as "the last send" is how
  // the receipt broke on 2026-09-17.
  const { data: lastHistory } = await supabase
    .from('invoice_history')
    .select('sent_to, send_type')
    .eq('invoice_id', invoiceId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: lastDocument } = await supabase
    .from('invoice_history')
    .select('rendered_html, invoice_snapshot')
    .eq('invoice_id', invoiceId)
    .in('send_type', ['initial', 'resend', 'forward', 'receipt'])
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastHistory && invoice.status !== 'paid') {
    throw new Error('No prior send found for this invoice. Use the Send button instead.');
  }

  // A paid invoice is never resent as the invoice. It goes out as the receipt,
  // with the stamp, Tyler's ask of 2026-09-17, drawn from the live rows first
  // because they know which lines are settled. An unpaid resend re-fires the
  // stored document, then the live rows, then the snapshot. The stored html
  // stays the record of what was sent the first time.
  const isPaid = invoice.status === 'paid';
  let html = isPaid ? null : (lastDocument?.rendered_html || null);
  let source = html ? 'stored' : null;
  if (!html) {
    html = await buildHtmlFromLiveRows({ invoice });
    source = html ? 'live' : null;
  }
  if (!html) {
    html = await rebuildHtmlFromSnapshot({ invoice, snapshot: lastDocument?.invoice_snapshot });
    source = html ? 'snapshot' : null;
  }
  const rebuiltFromSnapshot = source === 'snapshot';

  if (!html) {
    throw new Error(
      isPaid
        ? 'Could not draw the receipt. This invoice has no billable lines and no stored document.'
        : 'Could not rebuild this invoice email. There are no billable lines and no stored document. Use the Send button to generate a fresh email.'
    );
  }

  const list = cleanRecipients(recipients);
  if (Array.isArray(recipients) && recipients.length && !list.length) throw new Error('No valid address in the list');
  const clientEmail = String(invoice.clients.email || '').toLowerCase();
  const forwarding = list.length ? !list.includes(clientEmail) : (typeof toOverride === 'string' && toOverride.trim().length > 0);
  if (forwarding && !EMAIL_RE.test(toOverride.trim())) {
    throw new Error('That recipient address is not valid');
  }
  const recipientEmail = forwarding
    ? toOverride.trim()
    : (lastHistory?.sent_to || invoice.clients.email);
  // A history row now stores every address joined with commas, so a resend
  // with no list of its own goes to everyone the last send went to.
  const toList = list.length ? list : cleanRecipients(String(recipientEmail || '').split(','));
  if (!toList.length) throw new Error('Nobody to send to');
  const ccList = list.length ? [] : (forwarding ? [] : sanitizeCcList(invoice.cc_emails, recipientEmail));
  const sendType = isPaid ? 'receipt' : forwarding ? 'forward' : 'resend';

  // ── A RESEND CARRIES THE SAME FILES ───────────────────────────────────────
  // The rebuilt HTML already lists the attachments, because the snapshot's
  // document does. If the files themselves did not come along, the client would
  // get a resent invoice that names backup documents which are not in the
  // message, which is worse than not naming them. Same private bucket, same
  // service role read as send-invoice.js.
  const attachments = await loadAttachmentsForEmail(invoiceId);

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: toList,
    cc: ccList.length > 0 ? ccList : undefined,
    reply_to: 'hello@neonburro.com',
    subject: isPaid
      ? `Receipt for ${invoice.invoice_number} from neonburro`
      : forwarding
        ? `Invoice ${invoice.invoice_number} from neonburro`
        : `Invoice ${invoice.invoice_number} from neonburro (resent)`,
    html,
    attachments: attachments.length ? attachments : undefined,
  });

  if (result.error) throw new Error(result.error.message || 'Resend failed');

  await supabase.from('invoice_history').insert({
    invoice_id: invoiceId,
    sent_at: new Date().toISOString(),
    sent_to: toList.join(', '),
    sent_by: userId || null,
    send_type: sendType,
    rendered_html: html,
    invoice_snapshot: lastDocument?.invoice_snapshot || null,
    notes: [ccList.length > 0 ? `cc: ${ccList.join(', ')}` : null, `document from ${source}`].filter(Boolean).join(' · '),
  });

  await supabase.from('activity_log').insert({
    user_id: userId || null,
    action: 'invoice_sent',
    entity_type: 'invoice',
    entity_id: invoiceId,
    metadata: {
      invoice_number: invoice.invoice_number,
      client_name: invoice.clients?.name,
      send_type: sendType,
      recipient_email: recipientEmail,
      forwarded: forwarding,
      cc_count: ccList.length,
      cc_emails: ccList,
      rebuilt_from_snapshot: rebuiltFromSnapshot,
      document_source: source,
      receipt: isPaid,
    },
  });

  const adminName = await fetchAdminName(userId);
  const amountDue = parseFloat(invoice.total || 0) - parseFloat(invoice.total_paid || 0);
  const adminHtml = buildAdminAuditEmail({
    action: isPaid ? 'receipt' : 'resend', invoice, client: invoice.clients,
    recipientEmail: toList.join(', '), ccList, adminName, amountDue, rebuiltFromSnapshot,
  });
  resend.emails.send({
    from: ADMIN_FROM,
    to: ADMIN_TO,
    reply_to: invoice.clients?.email || 'hello@neonburro.com',
    subject: isPaid
      ? `Receipt Sent: ${invoice.invoice_number} to ${toList.join(', ')}`
      : forwarding
        ? `Invoice Forwarded: ${invoice.invoice_number} to ${recipientEmail}`
        : `Invoice Resent: ${invoice.invoice_number} - ${invoice.clients?.name || 'Client'}${ccList.length > 0 ? ` (+${ccList.length} cc)` : ''}`,
    html: adminHtml,
  }).catch((err) => console.error('Admin resend notification failed:', err));

  return { success: true, recipient: toList[0], recipients: toList, send_type: sendType, ccCount: ccList.length };
};

// ---------- reminder handler ----------

const handleReminder = async ({ invoiceId, subject, body, userId, recipients }) => {
  if (!body || !body.trim()) throw new Error('Reminder body is required');

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(name, email, company)')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) throw new Error('Invoice not found');
  if (invoice.cancelled_at) throw new Error('Cannot send reminder for a cancelled invoice');
  if (invoice.status === 'paid') throw new Error('Invoice is already paid');
  if (!invoice.clients?.email) throw new Error('Client has no email on file');

  const adminName = await fetchAdminName(userId);
  const list = cleanRecipients(recipients);
  if (Array.isArray(recipients) && recipients.length && !list.length) throw new Error('No valid address in the list');
  const reminderTo = list.length ? list : [invoice.clients.email];
  const ccList = list.length ? [] : sanitizeCcList(invoice.cc_emails, invoice.clients.email);
  const amountDue = parseFloat(invoice.total || 0) - parseFloat(invoice.total_paid || 0);

  const payUrl = invoice.pay_token
    ? `https://neonburro.com/pay/?token=${invoice.pay_token}`
    : 'https://neonburro.com/account/';

  const html = buildReminderEmail({
    recipientName: invoice.clients.name,
    bodyText: body,
    invoiceNumber: invoice.invoice_number,
    amountDue, payUrl, adminName,
  });

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: reminderTo,
    cc: ccList.length > 0 ? ccList : undefined,
    reply_to: 'hello@neonburro.com',
    subject: subject || `A gentle reminder about ${invoice.invoice_number}`,
    html,
  });

  if (result.error) throw new Error(result.error.message || 'Reminder send failed');

  await supabase.from('invoice_history').insert({
    invoice_id: invoiceId,
    sent_at: new Date().toISOString(),
    sent_to: reminderTo.join(', '),
    sent_by: userId || null,
    send_type: 'reminder',
    reminder_subject: subject || null,
    reminder_body: body,
    rendered_html: html,
    notes: ccList.length > 0 ? `cc: ${ccList.join(', ')}` : null,
  });

  await supabase.from('activity_log').insert({
    user_id: userId || null,
    action: 'invoice_sent',
    entity_type: 'invoice',
    entity_id: invoiceId,
    metadata: {
      invoice_number: invoice.invoice_number,
      client_name: invoice.clients?.name,
      send_type: 'reminder',
      recipient_email: invoice.clients.email,
      cc_count: ccList.length,
      cc_emails: ccList,
      subject,
    },
  });

  const adminHtml = buildAdminAuditEmail({
    action: 'reminder', invoice, client: invoice.clients,
    recipientEmail: invoice.clients.email, ccList, adminName, amountDue,
    reminderSubject: subject, reminderBody: body,
  });
  resend.emails.send({
    from: ADMIN_FROM,
    to: ADMIN_TO,
    reply_to: invoice.clients?.email || 'hello@neonburro.com',
    subject: `Reminder Sent: ${invoice.invoice_number} - ${invoice.clients?.name || 'Client'}${ccList.length > 0 ? ` (+${ccList.length} cc)` : ''}`,
    html: adminHtml,
  }).catch((err) => console.error('Admin reminder notification failed:', err));

  return { success: true, recipient: invoice.clients.email, send_type: 'reminder', ccCount: ccList.length };
};

// ---------- handler ----------

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { invoiceId, action, subject, body, userId, toOverride, recipients, auto } = JSON.parse(event.body || '{}');
    if (auto) console.log('[resend-invoice] automatic', auto, invoiceId);

    if (!invoiceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invoiceId required' }) };
    }
    if (!['resend', 'reminder'].includes(action)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'action must be "resend" or "reminder"' }) };
    }

    const result = action === 'resend'
      ? await handleResend({ invoiceId, userId, toOverride, recipients })
      : await handleReminder({ invoiceId, subject, body, userId, recipients });

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('resend-invoice error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Server error' }) };
  }
};
