// scripts/auth-email-templates.mjs
// Writes the six Supabase auth email templates into supabase/templates/ so
// they live in the repo and can be pasted into the dashboard, Authentication,
// Emails. Supabase does not read this folder on its own, the dashboard (or the
// management API with a personal token, which no agent holds) is the door.
//
// One letterhead, the same warm paper as src/lib/invoiceEmailTemplate.js, so a
// password reset and an invoice read as one house. Colors come straight from
// src/lib/emailTokens.js. Go template variables ({{ .ConfirmationURL }} and
// friends) pass through untouched.
//
// Run: node scripts/auth-email-templates.mjs
// No oxford commas, no em dashes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { EMAIL } from '../src/lib/emailTokens.js';

const SANS = "'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const MONO = "'Geist Mono','JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace";
const DISP = "'Fraunces',Georgia,'Times New Roman',serif";

const disc = `<span style="display:inline-block;width:0.16em;height:0.16em;border-radius:99px;background:${EMAIL.signal};margin-left:0.03em;vertical-align:baseline;"></span>`;

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:28px;">
  <tr>
    <td style="border-radius:999px;background:${EMAIL.signal};">
      <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${EMAIL.limeInk};text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;

const fallback = (href) => `
<div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${EMAIL.inkMuted};margin-top:26px;">If the button does not open, paste this into your browser.</div>
<div style="font-family:${MONO};font-size:11px;line-height:1.6;color:${EMAIL.inkSec};word-break:break-all;margin-top:6px;">${href}</div>`;

const code = (token) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:26px;">
  <tr>
    <td style="padding:16px 22px;border:2px solid ${EMAIL.signal};border-radius:14px;background:${EMAIL.sheet2};">
      <div style="font-family:${MONO};font-size:28px;font-weight:600;letter-spacing:0.22em;color:${EMAIL.ink};">${token}</div>
    </td>
  </tr>
</table>`;

const page = ({ preheader, kicker, title, body, action, closing }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${EMAIL.page};">
  <tr>
    <td align="center" style="padding:36px 16px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;background:${EMAIL.sheet};border-radius:18px;overflow:hidden;">
        <tr><td style="height:3px;background:${EMAIL.signal};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:34px 40px 8px;">
            <div style="font-family:${SANS};font-size:22px;font-weight:600;letter-spacing:-0.035em;color:${EMAIL.ink};line-height:1;">neonburro${disc}</div>
            <div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:-0.02em;color:${EMAIL.inkSec};margin-top:8px;">theburroship${disc}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 40px 0;">
            <div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:${EMAIL.inkMuted};">${kicker}</div>
            <div style="font-family:${DISP};font-size:30px;font-weight:500;letter-spacing:-0.02em;line-height:1.1;color:${EMAIL.ink};margin-top:12px;">${title}</div>
            <div style="font-family:${SANS};font-size:15px;line-height:1.65;color:${EMAIL.inkSec};margin-top:18px;max-width:46ch;">${body}</div>
            ${action}
            <div style="font-family:${SANS};font-size:13px;line-height:1.65;color:${EMAIL.inkMuted};margin-top:28px;max-width:46ch;">${closing}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:34px 40px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid ${EMAIL.hair};">
              <tr>
                <td style="padding-top:18px;">
                  <div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${EMAIL.inkMuted};">Pulse is the client portal of neonburro, a digital studio in Ridgway, Colorado. This message was sent to {{ .Email }} because of an action on that account.</div>
                  <div style="font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL.inkMuted};line-height:1.8;margin-top:16px;">The Burroship, LLC · PO Box 2111, Ridgway CO 81432 · hello@neonburro.com</div>
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
</html>
`;

const LINK = '{{ .ConfirmationURL }}';

export const TEMPLATES = {
  recovery: {
    subject: 'Reset your password • neonburro',
    html: page({
      preheader: 'A one time link to choose a new password for Pulse.',
      kicker: 'pulse · password reset',
      title: 'Choose a new password.',
      body: 'Someone asked to reset the password on {{ .Email }}. If that was you, the button opens a page where you set a new one. The link works once and it does not wait around.',
      action: button(LINK, 'Set a new password') + fallback(LINK),
      closing: 'If that was not you, nothing has changed and nothing will. You can leave this here.',
    }),
  },
  invite: {
    subject: 'A seat in Pulse for you • neonburro',
    html: page({
      preheader: 'Someone at neonburro opened a seat for you in Pulse.',
      kicker: 'pulse · invitation',
      title: 'You have a seat.',
      body: 'Someone at neonburro opened a seat for {{ .Email }} in Pulse, the room where the work, the invoices and the conversation live. Accept it, choose a password and you are in.',
      action: button(LINK, 'Accept the invite') + fallback(LINK),
      closing: 'The link is yours alone and it works once. If you were not expecting this, reply and a person will answer.',
    }),
  },
  confirmation: {
    subject: 'Confirm your email • neonburro',
    html: page({
      preheader: 'One click confirms the address and opens the door.',
      kicker: 'pulse · new account',
      title: 'Confirm it is you.',
      body: 'An account on Pulse was started with {{ .Email }}. One click confirms the address and opens the door.',
      action: button(LINK, 'Confirm my email') + fallback(LINK),
      closing: 'If you did not start this, nothing happens without the click. You can leave this here.',
    }),
  },
  magic_link: {
    subject: 'Your sign in link • neonburro',
    html: page({
      preheader: 'A one time link to sign in to Pulse.',
      kicker: 'pulse · sign in',
      title: 'Your way in.',
      body: 'Here is a one time link to sign in to Pulse as {{ .Email }}. It works once, then it is gone.',
      action: button(LINK, 'Sign in to Pulse') + fallback(LINK),
      closing: 'If you did not ask for this, nothing happens without the click.',
    }),
  },
  email_change: {
    subject: 'Confirm your new email • neonburro',
    html: page({
      preheader: 'Confirm the new address and the change is done.',
      kicker: 'pulse · email change',
      title: 'Confirm the new address.',
      body: 'You asked to move your Pulse account from {{ .Email }} to {{ .NewEmail }}. Confirm it and the change is done.',
      action: button(LINK, 'Confirm the new email') + fallback(LINK),
      closing: 'If you did not ask for this, do not click. Your account stays exactly where it is.',
    }),
  },
  reauthentication: {
    subject: 'Your confirmation code • neonburro',
    html: page({
      preheader: 'A short code to confirm it is you.',
      kicker: 'pulse · confirmation',
      title: 'Your code.',
      body: 'You are changing something that matters on Pulse. Enter this code to confirm it is you.',
      action: code('{{ .Token }}'),
      closing: 'It expires in a few minutes. If you did not ask for it, ignore this and nothing changes.',
    }),
  },
};

const OUT = new URL('../supabase/templates/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
for (const [name, t] of Object.entries(TEMPLATES)) {
  writeFileSync(`${OUT}${name}.html`, t.html);
  writeFileSync(`${OUT}${name}.subject.txt`, `${t.subject}\n`);
}
console.log(Object.keys(TEMPLATES).join(' '));
