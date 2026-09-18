// src/lib/invoiceEmailTemplate.js
// Pure function that builds the client-facing invoice document HTML.
// Shared by four callers, all passing the same shape:
//   - netlify/functions/send-invoice.js      (server, Node ESM)
//   - netlify/functions/resend-invoice.js    (server, Node ESM)
//   - src/pages/Invoicing/components/InvoicePreview.jsx     (Vite, iframe)
//   - src/pages/Invoicing/components/InvoiceSnapshotModal.jsx (Vite, iframe)
//
// ── WHAT THIS IS NOW: A LETTERHEAD, NOT A BANNER EMAIL ───────────────────────
// This renders the WARM-PAPER invoice: a real letterhead document, image-free,
// so it reads like an invoice, prints and PDFs cleanly, and never breaks when a
// mail client blocks remote images. It is table-based with inline styles so the
// exact same HTML renders in an email, in the in-app preview iframe, on the
// hosted invoice page and through the PDF. One template, four surfaces.
//
// ── THE THREE VOICES ─────────────────────────────────────────────────────────
// Geist reads, Geist Mono labels, Fraunces carries the marquee numbers (the
// title, the sprint amounts, the To-push-forward figure). Email clients that
// cannot load Fraunces fall back to Georgia, which is a clean serif for money.
// The web-font link in the head is for the preview, the hosted page and the
// PDF, not for email, and that is fine.
//
// ── ONE LIME, SPENT ON PURPOSE ───────────────────────────────────────────────
// Topo Lime appears four times and they read as one system: the top rule, the
// period in the wordmark, the Due figures, and the pay button. Everything else
// is ink on paper. All colors resolve from src/lib/emailTokens.js.
//
// ── THE MATH IS THE APP'S MATH ───────────────────────────────────────────────
// getDueNow mirrors the funding model exactly: pay_full bills the balance,
// deposit_50 bills half the balance, approve_only bills nothing. send-invoice.js
// imports getDueNow from here so the email, the snapshot and the server agree.
// Change this and you change what the client is billed, in every surface.
//
// No oxford commas, no em dashes.

import { EMAIL } from './emailTokens.js';

const SANS = "'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const MONO = "'Geist Mono','JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace";
const DISP = "'Fraunces',Georgia,'Times New Roman',serif";

// Funding-mode chip tints. Warm paper wants soft fills, not saturated ones.
const CHIP = {
  pay_full:     { bg: '#EAF0D2', ink: '#3A4319' },
  deposit_50:   { bg: '#F3EAD3', ink: '#7A5A1E' },
  approve_only: { bg: '#ECE6DA', ink: '#5A4636' },
};

// ============================================================
// HELPERS
// ============================================================

const currency = (val) =>
  `$${parseFloat(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export const getDueNow = (item) => {
  const amount = parseFloat(item.amount || 0);
  const paid = parseFloat(item.payment_amount || 0);
  const mode = item.payment_mode || 'approve_only';
  if (mode === 'pay_full') return Math.max(0, amount - paid);
  if (mode === 'deposit_50') return Math.max(0, amount * 0.5 - paid);
  return 0;
};

export const getFundingLabel = (mode) => {
  if (mode === 'deposit_50') return '50% to start';
  if (mode === 'pay_full') return 'Fund in full';
  return 'Confirm scope';
};

// Format a date WITHOUT a timezone shift. A due_date stored as 2026-09-17 (or a
// midnight-UTC timestamp) must always read Sep 17, never Sep 16 the evening
// before in a western timezone. So take the calendar date straight from the ISO
// string and build a local Date from its parts, ignoring any time or offset.
const formatDate = (d) => {
  if (!d) return '';
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// ============================================================
// SPRINT ROW — a two column line, title block left, money right
// ============================================================

const buildSprintRow = (item, idx, isFirst) => {
  const amount = parseFloat(item.amount || 0);
  const dueNow = getDueNow(item);
  const mode = item.payment_mode || 'approve_only';
  // A sprint that has been paid says so, on the invoice and on the receipt,
  // instead of repeating the funding rule it was sent under.
  const settled = item.payment_status === 'paid' || item.locked === true;
  const chip = settled ? { bg: '#EAF0D2', ink: '#3A4319' } : (CHIP[mode] || CHIP.approve_only);
  const chipLabel = settled ? 'paid' : getFundingLabel(mode);
  const topBorder = isFirst ? `2px solid ${EMAIL.ink}` : `1px solid ${EMAIL.hair}`;
  const dueLabel = settled
    ? `<span style="color:${EMAIL.limeDeep};font-weight:600;">paid</span>`
    : dueNow > 0
      ? `due now <span style="color:${EMAIL.limeDeep};font-weight:600;">${currency(dueNow)}</span>`
      : `due now <span style="color:${EMAIL.inkFaint};">$0</span>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:${topBorder};">
    <tr>
      <td valign="top" style="padding:18px 0;">
        <div style="font-family:${MONO};font-size:11px;color:${EMAIL.inkMuted};letter-spacing:0.04em;margin-bottom:6px;">
          ${escapeHtml(item.sprint_number || `SPRINT ${String(idx + 1).padStart(2, '0')}`)}
        </div>
        <div style="font-family:${SANS};font-size:16px;font-weight:600;color:${EMAIL.ink};letter-spacing:-0.01em;line-height:1.25;">
          ${escapeHtml(item.title || 'Untitled sprint')}
        </div>
        ${
          // ── ONE PROSE FIELD, ON PURPOSE ───────────────────────────────────
          // This briefly had two: a plain sentence above a technical paragraph.
          // It was reverted. Two blocks of prose per line turned a one page
          // invoice into a document, and the thing that made this letterhead
          // good was that you could read the whole of it at a glance.
          //
          // The readability problem was real, the fix was just in the wrong
          // place. It belongs in HOW the paragraph is written, not in adding a
          // second one. Open with where the work is, "Second pass." or "Initial
          // build, in progress.", then the detail. One field, one voice.
          item.description
            ? `<div style="font-family:${SANS};font-size:13px;line-height:1.6;color:${EMAIL.inkSec};margin-top:5px;max-width:46ch;">${escapeHtml(item.description)}</div>`
            : ''
        }
        <div style="margin-top:11px;">
          <span style="display:inline-block;font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:100px;background:${chip.bg};color:${chip.ink};">
            ${escapeHtml(chipLabel)}
          </span>
        </div>
      </td>
      <td valign="top" align="right" style="padding:18px 0 18px 16px;white-space:nowrap;">
        <div style="font-family:${DISP};font-size:22px;font-weight:500;color:${EMAIL.ink};">${currency(amount)}</div>
        <div style="font-family:${MONO};font-size:11px;color:${EMAIL.inkMuted};margin-top:4px;">${dueLabel}</div>
      </td>
    </tr>
  </table>`;
};

// ============================================================
// SHELL — warm paper sheet on a bone mat
// ============================================================

const buildShell = (content) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Neon Burro invoice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 16px 0 !important; }
      .sheet { border-radius: 0 !important; }
      .pad { padding: 30px 22px !important; }
      .foot-pad { padding: 22px 22px 28px !important; }
      .fig { font-size: 36px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL.page};font-family:${SANS};-webkit-font-smoothing:antialiased;">
  <table role="presentation" class="wrapper" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL.page};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="sheet" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:${EMAIL.sheet};border-radius:16px;overflow:hidden;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ============================================================
// MAIN TEMPLATE
// ============================================================

export const buildInvoiceEmailHTML = ({
  invoice,
  client,
  project,
  lineItems,
  invoiceDate,
  payUrl,
  // Rows from invoice_attachments. The FILES themselves ride as real email
  // attachments, added by send-invoice.js, because the bucket is private and a
  // supplier invoice must never sit behind a guessable URL. What this list does
  // is tell the reader the evidence is in the message, which is the whole point
  // of a pass through line billed at cost. See the note in send-invoice.js.
  attachments,
  // Tyler, 2026-09-17. A paid invoice carries a stamp, clean, in the house
  // style, and no pay button. The same template makes the receipt a client
  // gets when a paid invoice is resent. paidAt is the date on the stamp.
  paid = false,
  paidAt = null,
  // Tyler, 2026-09-17, the receipt says how it was paid. A short human line
  // built by the caller from the payments rows, "Visa ending 4242", "Check
  // 1043", "USDC on Solana". Null prints nothing, the stamp still stands.
  paidBy = null,
}) => {
  const items = lineItems || [];
  const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
  // A paid document owes nothing whatever the rows say, the stamp is the truth.
  const totalDueNow = paid ? 0 : items.reduce((sum, i) => sum + getDueNow(i), 0);
  const itemsHTML = items.map((item, idx) => buildSprintRow(item, idx, idx === 0)).join('');

  const clientPin = client?.portal_pin || client?.lookup_pin;
  const safeInvoiceNum = escapeHtml(invoice?.invoice_number || 'Invoice');
  const issued = escapeHtml(invoiceDate || formatDate(invoice?.sent_at) || formatDate(new Date()));
  const due = formatDate(invoice?.due_date);
  const link = escapeHtml(payUrl || '#');

  // ---- header, letterhead ------------------------------------------------
  const header = `
    <div style="font-family:${SANS};font-size:22px;font-weight:600;letter-spacing:-0.035em;color:${EMAIL.ink};">neonburro<span style="color:${EMAIL.signal};">.</span></div>
    <div style="font-family:${SANS};font-size:13px;font-weight:600;letter-spacing:-0.02em;color:${EMAIL.inkSec};margin-top:8px;">theburroship<span style="display:inline-block;width:0.16em;height:0.16em;border-radius:99px;background:${EMAIL.signal};margin-left:0.03em;vertical-align:baseline;"></span></div>`;

  const stampDate = paid ? escapeHtml(formatDate(paidAt) || formatDate(new Date())) : '';
  const stamp = paid ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
      <tr>
        <td style="border:2px solid ${EMAIL.signal};border-radius:10px;padding:8px 14px;">
          <div style="font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:${EMAIL.limeInk};line-height:1;">paid</div>
          <div style="font-family:${MONO};font-size:10px;letter-spacing:0.12em;color:${EMAIL.inkSec};margin-top:5px;line-height:1;">${stampDate}</div>
        </td>
      </tr>
    </table>` : '';
  const title = `
    <div style="font-family:${DISP};font-size:38px;font-weight:500;letter-spacing:-0.01em;line-height:1;color:${EMAIL.ink};">${paid ? 'Receipt' : 'Invoice'}</div>
    <div style="font-family:${MONO};font-size:13px;color:${EMAIL.inkSec};letter-spacing:0.04em;margin-top:8px;">${safeInvoiceNum}</div>${stamp}`;

  // ---- billed-to + dates -------------------------------------------------
  const dateRow = (k, v, accent) => `
    <tr>
      <td style="padding:2px 0 9px 0;font-family:${MONO};font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${EMAIL.inkMuted};border-bottom:1px solid ${EMAIL.hairSoft};">${k}</td>
      <td align="right" style="padding:2px 0 9px 0;font-family:${SANS};font-size:14px;font-weight:500;color:${accent || EMAIL.ink};border-bottom:1px solid ${EMAIL.hairSoft};">${v}</td>
    </tr>`;

  // Bill To. A business leads with the company and lists the contact as Attn, an
  // individual leads with the name. Then the billing address, then the email.
  const addrLines = [];
  if (client?.address_line1) addrLines.push(escapeHtml(client.address_line1));
  if (client?.address_line2) addrLines.push(escapeHtml(client.address_line2));
  const cityRegion = [client?.city, client?.region].filter(Boolean).join(', ');
  const cityLine = [cityRegion, client?.postal_code].filter(Boolean).join(' ').trim();
  if (cityLine) addrLines.push(escapeHtml(cityLine));
  if (client?.country && client.country.toUpperCase() !== 'US') addrLines.push(escapeHtml(client.country));

  const billPrimary = client?.company || client?.name || 'Client';
  const billAttn = client?.company ? client?.name : null;
  const billLn = (t) => `<div style="font-family:${SANS};font-size:13px;line-height:1.7;color:${EMAIL.inkSec};">${t}</div>`;
  const billed = `
    <div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:${EMAIL.inkMuted};margin-bottom:7px;">Billed to</div>
    <div style="font-family:${SANS};font-size:16px;font-weight:600;color:${EMAIL.ink};margin-bottom:2px;">${escapeHtml(billPrimary)}</div>
    ${billAttn ? billLn(`Attn ${escapeHtml(billAttn)}`) : ''}
    ${addrLines.map(billLn).join('')}
    ${client?.email ? billLn(escapeHtml(client.email)) : ''}`;

  const dates = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${dateRow('Issued', issued)}
      ${paid ? dateRow('Paid', stampDate, EMAIL.limeDeep) : due ? dateRow('Due', due, EMAIL.limeDeep) : ''}
      ${paid && paidBy ? dateRow('Paid by', escapeHtml(paidBy)) : ''}
      ${project ? dateRow('Project', escapeHtml(project.name)) : ''}
    </table>`;

  // ---- totals ------------------------------------------------------------
  const totalsBox = `
    <table role="presentation" align="right" cellpadding="0" cellspacing="0" style="width:320px;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${EMAIL.hair};font-family:${SANS};font-size:14px;color:${EMAIL.inkSec};">Total project value</td>
        <td align="right" style="padding:10px 0;border-top:1px solid ${EMAIL.hair};font-family:${SANS};font-size:14px;font-weight:500;color:${EMAIL.ink};">${currency(totalAmount)}</td>
      </tr>
    </table>
    <table role="presentation" align="right" cellpadding="0" cellspacing="0" style="width:320px;border-collapse:collapse;margin-top:10px;">
      <tr>
        <td style="background:${EMAIL.sheet2};border-radius:12px;padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" style="width:52%;">
                <div style="font-family:${MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL.inkMuted};">${paid ? 'Settled' : totalDueNow > 0 ? 'To push forward' : 'Due now'}</div>
                <div style="font-family:${SANS};font-size:12px;line-height:1.4;color:${EMAIL.inkSec};margin-top:4px;">${paid ? 'Paid in full,<br>nothing due' : totalDueNow > 0 ? 'Confirm scope,<br>fund what starts' : 'Scope confirmed,<br>nothing due'}</div>
              </td>
              <td valign="middle" align="right" class="fig" style="font-family:${DISP};font-size:44px;font-weight:500;line-height:1;color:${EMAIL.ink};white-space:nowrap;padding-left:14px;">
                ${totalDueNow > 0 ? `<span style="font-size:26px;color:${EMAIL.inkMuted};vertical-align:6px;">$</span>${totalDueNow.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '&mdash;'}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  // ---- call to action ----------------------------------------------------
  const cta = paid ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;">
      <tr>
        <td align="center" style="background:${EMAIL.sheet2};border-radius:14px;padding:26px 30px;">
          <div style="font-family:${SANS};font-size:15px;font-weight:600;color:${EMAIL.ink};">Paid in full. Thank you.</div>
          <div style="font-family:${SANS};font-size:12.5px;color:${EMAIL.inkSec};margin-top:8px;">Your receipt, for the records. Nothing else is due on this invoice, and the next thing you hear from us will be about the work.</div>
        </td>
      </tr>
    </table>` : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;">
      <tr>
        <td align="center" style="background:${EMAIL.sheet2};border-radius:14px;padding:30px;">
          <a href="${link}" style="display:inline-block;background:${EMAIL.signal};color:${EMAIL.limeInk};font-family:${SANS};font-weight:600;font-size:15px;letter-spacing:-0.01em;text-decoration:none;padding:15px 34px;border-radius:100px;">
            ${totalDueNow > 0 ? 'Approve and push forward' : 'Approve scope'}
          </a>
          ${
            totalDueNow > 0
              ? `<div style="font-family:${SANS};font-size:12.5px;color:${EMAIL.inkSec};margin-top:14px;">Pay by <b style="color:${EMAIL.ink};">card</b>, <b style="color:${EMAIL.ink};">Apple Pay</b>, <b style="color:${EMAIL.ink};">bank transfer</b> or <b style="color:${EMAIL.ink};">USDC</b></div>
          <div style="font-family:${SANS};font-size:12px;color:${EMAIL.inkMuted};margin-top:6px;">or mail a check to The Burroship, LLC, PO Box 2111, Ridgway CO 81432</div>`
              : `<div style="font-family:${SANS};font-size:12.5px;color:${EMAIL.inkSec};margin-top:14px;">No payment is due now. Approve to put this sprint in motion.</div>`
          }
        </td>
      </tr>
    </table>`;

  // ---- attached backup ---------------------------------------------------
  // Only prints when there is something to print, so an ordinary invoice is
  // unchanged. Deliberately quiet: mono label, hairline rows, no lime. The lime
  // is spent four times already and a list of filenames is not the fifth.
  const files = attachments || [];
  const attachmentsBlock = files.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;">
      <tr>
        <td style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:${EMAIL.inkMuted};padding-bottom:10px;">
          Attached ${files.length === 1 ? '' : `<span style="letter-spacing:0.1em;">(${files.length})</span>`}
        </td>
      </tr>
      ${files.map((f) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${EMAIL.hair};">
          <div style="font-family:${SANS};font-size:13.5px;font-weight:600;color:${EMAIL.ink};">${escapeHtml(f.label || f.filename)}</div>
          ${f.label ? `<div style="font-family:${MONO};font-size:11px;color:${EMAIL.inkMuted};margin-top:3px;">${escapeHtml(f.filename)}</div>` : ''}
        </td>
      </tr>`).join('')}
      <tr>
        <td style="padding-top:10px;font-family:${SANS};font-size:11.5px;line-height:1.6;color:${EMAIL.inkFaint};">
          Sent with this email as ${files.length === 1 ? 'a file' : 'files'}. Anything billed at cost is receipted here.
        </td>
      </tr>
    </table>` : '';

  // ---- footer ------------------------------------------------------------
  const footer = `
    <tr>
      <td class="foot-pad" style="padding:24px 40px 34px;background:${EMAIL.sheet2};border-top:1px solid ${EMAIL.hair};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top" style="width:55%;">
              <div style="font-family:${MONO};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL.inkMuted};margin-bottom:5px;">Questions</div>
              <div style="font-family:${SANS};font-size:12.5px;line-height:1.6;color:${EMAIL.inkSec};">
                Tyler Reagan<br>
                <a href="mailto:tyler@neonburro.com" style="color:${EMAIL.inkSec};text-decoration:none;">tyler@neonburro.com</a><br>
                <a href="tel:9709738550" style="color:${EMAIL.inkSec};text-decoration:none;font-family:${MONO};">(970) 973-8550</a>
              </div>
            </td>
            <td valign="top" align="right">
              <div style="font-family:${MONO};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL.inkMuted};margin-bottom:5px;">Find this invoice again</div>
              <div style="font-family:${SANS};font-size:12.5px;line-height:1.6;color:${EMAIL.inkSec};">
                <a href="https://neonburro.com/account/lookup/" style="color:${EMAIL.inkSec};text-decoration:none;">neonburro.com/account/lookup</a>
                ${clientPin ? `<br><span style="font-family:${MONO};font-size:15px;letter-spacing:0.16em;color:${EMAIL.ink};font-weight:500;">${escapeHtml(clientPin)}</span>` : ''}
              </div>
            </td>
          </tr>
        </table>
        <div style="font-family:${SANS};font-size:11px;line-height:1.6;color:${EMAIL.inkFaint};margin-top:18px;max-width:60ch;">
          ${due ? `Payment due ${due} in accordance with our service agreement. ` : ''}A sprint marked confirm scope carries no charge now, it starts when you approve it.
        </div>
        <div style="font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL.inkMuted};line-height:1.8;margin-top:22px;">The Burroship, LLC · PO Box 2111, Ridgway CO 81432 · hello@neonburro.com</div>
      </td>
    </tr>`;

  // ---- assemble ----------------------------------------------------------
  const content = `
    <tr>
      <td class="pad" style="padding:44px 40px 0;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top">${header}</td>
            <td valign="top" align="right">${title}</td>
          </tr>
        </table>
        <div style="height:2px;background:${EMAIL.signal};border-radius:2px;margin-top:22px;"></div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
          <tr>
            <td valign="top" style="width:56%;padding-right:24px;">${billed}</td>
            <td valign="top">${dates}</td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:34px;">
          <tr>
            <td style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:${EMAIL.inkMuted};">Sprints</td>
            <td align="right" style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:${EMAIL.inkMuted};">Amount</td>
          </tr>
        </table>
        ${itemsHTML}

        <div style="margin-top:8px;overflow:hidden;">${totalsBox}</div>

        ${attachmentsBlock}

        ${cta}

        <div style="height:34px;"></div>
      </td>
    </tr>
    ${footer}`;

  return buildShell(content);
};

export default buildInvoiceEmailHTML;
