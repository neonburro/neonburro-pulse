// netlify/functions/_letterhead.js
// The one letterhead for every plain mail Pulse sends a person, the client
// invite, the PIN, and whatever comes next that is not an invoice. It is the
// same warm paper as src/lib/invoiceEmailTemplate.js and the same sheet the
// six Supabase auth mails wear (scripts/auth-email-templates.mjs), so a
// password reset, a PIN and an invoice read as one house.
//
// ── WHY THIS CARRIES ITS OWN PALETTE ─────────────────────────────────────────────────────────────────
// This file is ESM like half the functions folder, and the two that read it
// were CommonJS until 2026-09-17 and are ESM now. The colors are mirrored here
// by hand. If a value moves in emailTokens.js, move it here in the same
// commit. approve-pin-request.js used to carry its own copy, it reads this
// one now.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────
// letterhead({ preheader, kicker, title, body, action, closing, to }) returns
// the whole document. kicker is mono and uppercase, title is the serif line,
// body and closing are prose, action is whatever sits between them, a button,
// a code, a credentials table, built with the helpers below. Nothing in here
// loads an image, so it renders whole when a mail client blocks remote images
// and it prints clean.
//
// One lime, spent on purpose. The top rule, the two periods, the button.
// Everything else is ink on paper.
//
// No oxford commas, no em dashes.

const C = {
  signal: '#C5D957',
  page: '#E7DFD1',
  sheet: '#FBF9F4',
  sheet2: '#F5F0E6',
  hair: '#E4DBCB',
  limeInk: '#3A4319',
  limeDeep: '#6E7A30',
  ink: '#241A16',
  inkSec: '#4A382F',
  inkMuted: '#6B5245',
  inkFaint: '#9A8574',
};

const SANS = "'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const MONO = "'Geist Mono','JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace";
const DISP = "'Fraunces',Georgia,'Times New Roman',serif";

const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const disc = `<span style="display:inline-block;width:0.16em;height:0.16em;border-radius:99px;background:${C.signal};margin-left:0.03em;vertical-align:baseline;"></span>`;

// The lime pill. label is already safe text, href is a URL you built.
const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:28px;">
  <tr>
    <td style="border-radius:999px;background:${C.signal};">
      <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${C.limeInk};text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;

// A short secret set large, in mono, inside a lime frame. Pass safe text.
const code = (text) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:26px;">
  <tr>
    <td style="padding:16px 22px;border:2px solid ${C.signal};border-radius:14px;background:${C.sheet2};">
      <div style="font-family:${MONO};font-size:28px;font-weight:600;letter-spacing:0.22em;color:${C.ink};">${text}</div>
    </td>
  </tr>
</table>`;

// Label and value pairs, the way the invoice prints its meta rows. Pass safe
// text in both columns.
const rows = (pairs) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:26px;width:100%;max-width:360px;">
  ${pairs
    .map(
      ([label, value], i) => `
  <tr>
    <td style="padding:12px 0;border-top:${i === 0 ? `2px solid ${C.ink}` : `1px solid ${C.hair}`};font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${C.inkMuted};vertical-align:middle;white-space:nowrap;padding-right:24px;">${label}</td>
    <td style="padding:12px 0;border-top:${i === 0 ? `2px solid ${C.ink}` : `1px solid ${C.hair}`};font-family:${MONO};font-size:17px;font-weight:600;letter-spacing:0.06em;color:${C.ink};vertical-align:middle;text-align:right;">${value}</td>
  </tr>`,
    )
    .join('')}
</table>`;

// The small grey line under a button, for a client whose mail hides buttons.
const fallback = (href) => `
<div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkMuted};margin-top:26px;">If the button does not open, paste this into your browser.</div>
<div style="font-family:${MONO};font-size:11px;line-height:1.6;color:${C.inkSec};word-break:break-all;margin-top:6px;">${href}</div>`;

const letterhead = ({ preheader = '', kicker, title, body, action = '', closing = '', to = '' }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${C.page};">
  <tr>
    <td align="center" style="padding:36px 16px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;background:${C.sheet};border-radius:18px;overflow:hidden;">
        <tr><td style="height:3px;background:${C.signal};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:34px 40px 8px;">
            <div style="font-family:${SANS};font-size:22px;font-weight:600;letter-spacing:-0.035em;color:${C.ink};line-height:1;">neonburro${disc}</div>
            <div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:-0.02em;color:${C.inkSec};margin-top:8px;">theburroship${disc}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 40px 0;">
            <div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:${C.inkMuted};">${escapeHtml(kicker)}</div>
            <div style="font-family:${DISP};font-size:30px;font-weight:500;letter-spacing:-0.02em;line-height:1.1;color:${C.ink};margin-top:12px;">${escapeHtml(title)}</div>
            <div style="font-family:${SANS};font-size:15px;line-height:1.65;color:${C.inkSec};margin-top:18px;max-width:46ch;">${body}</div>
            ${action}
            ${closing ? `<div style="font-family:${SANS};font-size:13px;line-height:1.65;color:${C.inkMuted};margin-top:28px;max-width:46ch;">${closing}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:34px 40px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid ${C.hair};">
              <tr>
                <td style="padding-top:18px;">
                  <div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkMuted};">Pulse is the client portal of neonburro, a digital studio in Ridgway, Colorado.${to ? ` This message was sent to ${escapeHtml(to)}.` : ''} Reply and a person answers.</div>
                  <div style="font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${C.inkMuted};line-height:1.8;margin-top:16px;">The Burroship, LLC · PO Box 2111, Ridgway CO 81432 · hello@neonburro.com</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

export { C, SANS, MONO, DISP, escapeHtml, button, code, rows, fallback, letterhead };
