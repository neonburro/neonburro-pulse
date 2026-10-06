// scripts/auth-email-templates.mjs
// Writes every email Supabase Auth can send for project sspbripimqvfdkfbpubq
// into supabase/templates/, thirteen of them, as one family. Supabase does not
// read this folder on its own. The door is the dashboard, Authentication,
// Emails, one template at a time by URL (the slugs are listed below), or the
// management API with a personal token, which no agent holds.
//
// Run:      node scripts/auth-email-templates.mjs
// Preview:  node scripts/auth-email-templates.mjs --preview <dir>
//           writes filled copies with sample values, see THE PREVIEW below.
//
// ── THE THIRTEEN ─────────────────────────────────────────────────────────────
// Six asks, each with one thing to do. confirmation, invite, magic_link,
// email_change, recovery, reauthentication. Seven notices, each telling a
// person something already happened. password_changed, email_changed,
// phone_changed, identity_linked, identity_unlinked, mfa_factor_enrolled and
// mfa_factor_unenrolled, each with _notification on the end. The file names
// are the Supabase config names (mailer_templates_<name>_content in the
// management API, content_path in the CLI config), so nobody has to translate.
// A notice is only sent when its own switch is on in the dashboard, and the
// switches are off until somebody turns them on.
//
// ── ONE PROJECT, SEVERAL DOORS ───────────────────────────────────────────────
// Every property shares this Supabase project, so these mails go out for all
// of them. As of 2026-10-05 recovery is sent by Pulse (/reset-password/),
// by the neonburro.com account door (/account/reset-password/) and by the
// academy (/reset/). magic_link is sent only by the neonburro.com account
// door (signInWithOtp in AccountLogin.jsx). invite is sent only by Pulse
// (send-team-invite.js). password_changed fires after every one of those
// resets and after the first password a person sets in Pulse AcceptInvite or
// the neonburro.com Welcome page, so its line never says "changed" alone.
// The copy names no property, the mark is neonburro. invite is the one
// exception because only Pulse sends it. The 2026-09-17 set said Pulse in
// every mail and the magic link said "Sign in to Pulse" to people signing in
// to neonburro.com. Grep the other repos before naming a property in any of
// these again.
//
// ── THE STANDARD ─────────────────────────────────────────────────────────────
// Tyler, 2026-10-05, after his own reset. "It should feel more app-like,
// like you're in a nice, clean mobile app." "Doesn't need to have too many
// details on it." "neonburro in the top left is always a clickable link, and
// you can always say something kind of witty." So every mail is one app
// screen, in this order and with nothing added.
//   The top bar. The wordmark top left, a link to https://neonburro.com/,
//   and the act in a mono label on the right, the way an app names the
//   screen you are on.
//   A large title, one dry line in the house voice. The wit lives here and
//   only here, humble and never a boast, borrowing the ranch register (the
//   gate, the ring of keys) where it fits. Tyler's own line is the reset,
//   "We all forget at times." Its we is everybody, not the studio, which is
//   why it is the one we in the set.
//   One short plain sentence that says what it means.
//   For the mails that report a change, the specifics in one grouped list,
//   the way a settings screen shows them.
//   One full width pill, the same pill as the Pulse sign in page.
//   One centered line of fine print under it, a few words at most.
//   A quiet foot on the mat under the screen.
// The subject stays plain for the inbox and the preheader is the title, so
// the inbox row reads "Reset your password" over "We all forget at times."
//
// There is no pasted copy of the link under the button. The 2026-09-17 set
// printed the whole verify URL in a well and Tyler read it as "this extra
// link". The button is a plain link in every client that exists, so a second
// copy was only noise. Do not bring it back. Expiry times are not stated
// either, they are a dashboard setting and a number in the copy drifts.
//
// Subjects carry no " • neonburro" tail. The sender name is already
// neonburro (SMTP settings), and the tail put the brand in the inbox twice.
// neonburro is lowercase everywhere, so nothing that contains it ever sits
// in an uppercase mono line, text-transform would shout it.
//
// One lime per mail, on the action. The code mail spends it on the code
// frame. The notices spend none past the disc, their action is an ink
// outline, because when a notice arrives there is usually nothing to do.
// The disc is part of the mark and does not count.
//
// ── THE PAPER ────────────────────────────────────────────────────────────────
// The sign in mails wear the room's paper, colors.paper from
// src/theme/colors.js, read straight from the theme so there is no copy to
// drift. Decided 2026-10-05, the day the room went lighter, because a person
// taps from this mail straight onto the sign in, reset and invite pages and
// those are on that paper. The invoice letter in src/lib/emailTokens.js and
// netlify/functions/_letterhead.js did not move, and the LIGHTER note in
// colors.js says so. Only hex values are email safe, so if colors.paper ever
// grows an rgba or a token reference this script has to stop reading it.
//
// ── WHAT GO DOES TO THIS HTML ────────────────────────────────────────────────
// Supabase parses the body and the subject with Go's html/template. Three
// consequences, all learned from its source and none of them visible in the
// dashboard editor.
//   Every HTML comment is stripped. Outlook conditional comments never
//   arrive, so there are no MSO ghost tables. Classic Outlook on Windows draws
//   the screen full width with square corners and loses the disc, and the
//   pill stays fat there through mso-padding-alt, which is a style property
//   and survives. The path comment at the top of each written file costs a
//   recipient nothing for the same reason.
//   Variables are escaped by context. In an href a variable is URL filtered,
//   in text it is HTML escaped. Never put a variable inside a style attribute
//   or a style block, Go rewrites it into something nobody meant.
//   Only the documented variables exist and each lives in certain templates.
//   Every template has .Email .SiteURL and .Data. The asks add
//   .ConfirmationURL .Token .TokenHash and .RedirectTo, email_change adds
//   .NewEmail, email_changed adds .OldEmail, phone_changed adds .Phone and
//   .OldPhone, the identity pair adds .Provider and the mfa pair adds
//   .FactorType. An if guard sits wherever a value can be empty, .OldPhone
//   when there was no phone before and .Email when an anonymous user links an
//   address. The code is printed whole and never sliced into boxes, because
//   the code length is a dashboard setting and a slice past the end stops
//   the mail from sending at all.
//
// ── PHONE AND DESKTOP ────────────────────────────────────────────────────────
// On a phone the screen runs edge to edge with no corners and no border, so
// there is no container around the content and the paper is the frame. That
// switch lives in the first style block, a max-width 620 media query. The
// inline styles are the desktop look, a phone width screen floating on the
// mat, and also what a client without style blocks gets (classic Outlook,
// the Gmail app on a non Google account). The second style block holds the
// rules Gmail is known to drop, kept apart so a dropped rule cannot take the
// phone layout with it.
//
// No web fonts. The stacks start at the system fonts so the render here is
// what a client sees. Geist is not named because almost nobody has it
// installed and a font only one reader sees is a render nobody can check.
// magic_link carries no code because no door has a code field. If one is
// built, add code('{{ .Token }}') to it.
//
// ── THE DOOR ─────────────────────────────────────────────────────────────────
// pbcopy < supabase/templates/<name>.html, then open
// /dashboard/project/sspbripimqvfdkfbpubq/auth/templates/<slug>, click inside
// the Monaco editor, cmd+a, cmd+v, set the subject from <name>.subject.txt,
// Preview, Save. Slugs for the asks are confirm-sign-up, invite-user,
// magic-link-or-otp, change-email-address, reset-password and
// reauthentication. Clicking rows on the list page misses, go by URL.
//
// ── THE PREVIEW ──────────────────────────────────────────────────────────────
// --preview <dir> runs every template through fill(), a small stand in for
// Go's html/template that knows variables, if, else and end and strips
// comments the way Go does. It throws on anything else, so a template that
// grows syntax the stand in does not know fails here and not in an inbox.
// Then shoot each file with Chrome at phone and desktop width. Headless
// Chrome will not lay a page out narrower than about 500 pixels, so shoot
// the phone through a 390 pixel iframe or the media query never fires, and
// give it --virtual-time-budget and a kill, it writes the png and then hangs.
// Look at every one. A clean run of this script proves it parsed and nothing
// more.
//
// No oxford commas, no em dashes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import colors from '../src/theme/colors.js';

const C = colors.paper;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const HOME = 'https://neonburro.com/';
const LINK = '{{ .ConfirmationURL }}';
const STUDIO = 'hello@neonburro.com';

// ── PIECES ───────────────────────────────────────────────────────────────────

// The house kicker, textStyles.kicker in the studio theme, mono 10px 500
// uppercase 0.2em.
const kicker = (text, align = 'left') =>
  `<div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.2em;line-height:14px;mso-line-height-rule:exactly;text-transform:uppercase;color:${C.inkMuted};text-align:${align};">${text}</div>`;

// The wordmark, always a link home. The disc is a separate lime circle
// 0.16em wide, 0.03em after the last o, the same spec as Hero.jsx and
// Footer.jsx on the studio site.
const wordmark = `<a href="${HOME}" style="font-family:${SANS};font-size:22px;font-weight:600;letter-spacing:-0.035em;line-height:26px;mso-line-height-rule:exactly;color:${C.ink};text-decoration:none;">neonburro<span style="display:inline-block;width:0.16em;height:0.16em;margin-left:0.03em;border-radius:50%;background:${C.lime};vertical-align:baseline;"></span></a>`;

// The one action, full width like the sign in page. lime for an ask,
// outline for a notice. The padding sits on the link for every client and
// again on the cell as mso-padding-alt for classic Outlook, which ignores
// padding on a link.
const pill = (href, label, tone = 'lime') => {
  const lime = tone === 'lime';
  const cell = lime ? `background:${C.lime};` : `border:1.5px solid ${C.ink};`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin-top:32px;">
  <tr>
    <td align="center" style="${cell}border-radius:999px;mso-padding-alt:17px 24px;">
      <a href="${href}" style="display:block;padding:17px 24px;font-family:${SANS};font-size:16px;font-weight:600;line-height:20px;letter-spacing:-0.01em;text-align:center;color:${lime ? C.limeInk : C.ink};text-decoration:none;border-radius:999px;">${label}&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
};

// A short secret set large in mono, centered in a full width well. The lime
// frame is this mail's one lime, the code is the action.
const code = (token) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin-top:32px;">
  <tr>
    <td align="center" style="padding:22px 16px;border:2px solid ${C.lime};border-radius:18px;background:${C.sunken};">
      <div style="font-family:${MONO};font-size:36px;font-weight:600;letter-spacing:0.28em;line-height:42px;mso-line-height-rule:exactly;color:${C.ink};text-align:center;padding-left:0.28em;">${token}</div>
    </td>
  </tr>
</table>`;

// What changed, as one grouped list the way a settings screen shows it.
// Label over value so a long address never fights a label for the width of
// a phone. guard wraps a row in an if, for values that can be empty.
const facts = (rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin-top:28px;background:${C.sunken};border-radius:16px;">
  ${rows
    .map(({ label, value, mono, guard }, i) => {
      const row = `
  <tr>
    <td style="padding:14px 18px 15px;${i ? `border-top:1px solid ${C.hair};` : ''}">
      ${kicker(label)}
      <div style="font-family:${mono ? MONO : SANS};font-size:${mono ? 15 : 16}px;font-weight:600;line-height:22px;mso-line-height-rule:exactly;color:${C.ink};margin-top:4px;overflow-wrap:anywhere;word-break:break-word;">${value}</div>
    </td>
  </tr>`;
      return guard ? `{{ if ${guard} }}${row}{{ end }}` : row;
    })
    .join('')}
</table>`;

// The fine print under the pill, a few words, centered.
const small = (text) =>
  `<div style="font-family:${SANS};font-size:13px;line-height:19px;mso-line-height-rule:exactly;color:${C.inkMuted};text-align:center;margin-top:16px;">${text}</div>`;

// A notice's one action, a reply to the studio with the notice named.
const notMe = (what) =>
  pill(`mailto:${STUDIO}?subject=${encodeURIComponent(`Not me, ${what}`)}`, 'This was not me', 'outline');

// ── THE SCREEN ───────────────────────────────────────────────────────────────

// Hidden filler after the preheader keeps the inbox preview from running on
// into the body text.
const FILLER = '&#847;&zwnj;&nbsp;'.repeat(40);

const page = ({ name, kick, title, line, action }) => `<!-- supabase/templates/${name}.html, written by scripts/auth-email-templates.mjs. Edit the script and run it, never this file. Go strips this comment before sending. -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
@media only screen and (max-width:620px){
.nb-outer{padding:0!important;}
.nb-screen{border:0!important;border-radius:0!important;}
.nb-pad{padding-left:24px!important;padding-right:24px!important;}
.nb-bar{padding-top:22px!important;}
.nb-body{padding-top:44px!important;padding-bottom:40px!important;}
.nb-foot{padding:22px 24px 40px!important;}
}
</style>
<style>
:root{color-scheme:light;supported-color-schemes:light;}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
</style>
</head>
<body style="margin:0;padding:0;background:${C.mat};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${title}${FILLER}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.mat}" style="border-collapse:collapse;background:${C.mat};">
  <tr>
    <td align="center" class="nb-outer" style="padding:48px 12px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="nb-screen" bgcolor="${C.sheet}" style="border-collapse:separate;max-width:480px;background:${C.sheet};border:1px solid ${C.hair};border-radius:28px;">
        <tr>
          <td class="nb-pad nb-bar" style="padding:28px 36px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td valign="middle" style="padding:0;">${wordmark}</td>
                <td valign="middle" align="right" style="padding:0 0 0 16px;">${kicker(kick, 'right')}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="nb-pad nb-body" style="padding:56px 36px 40px;">
            <div style="font-family:${SANS};font-size:32px;font-weight:700;letter-spacing:-0.03em;line-height:36px;mso-line-height-rule:exactly;color:${C.ink};text-wrap:balance;">${title}</div>
            <div style="font-family:${SANS};font-size:16px;line-height:24px;mso-line-height-rule:exactly;color:${C.inkSec};margin-top:12px;text-wrap:pretty;">${line}</div>
            ${action}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" class="nb-outer" style="padding:0 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:480px;">
        <tr>
          <td class="nb-foot" align="center" style="padding:24px 36px 56px;">
            {{ if .Email }}<div style="font-family:${SANS};font-size:12px;line-height:18px;mso-line-height-rule:exactly;color:${C.inkMuted};text-align:center;margin-bottom:8px;">For {{ .Email }}</div>{{ end }}
            ${kicker('The Burroship, LLC<br>PO Box 2111 · Ridgway CO 81432', 'center')}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;

// ── THE COPY ─────────────────────────────────────────────────────────────────
// kick names the screen, title is the dry line, line says what it means.
// Brief. No exclamation points, no colons, no dashes, no oxford commas and
// no I or we past Tyler's one.

const ONCE = 'Works once. Not you? Ignore it.';

const ASKS = {
  confirmation: {
    subject: 'Confirm your email',
    kick: 'New account',
    title: 'Almost through the gate.',
    line: 'Confirm {{ .Email }} and the account is ready.',
    action: pill(LINK, 'Confirm my email') + small(ONCE),
  },
  invite: {
    subject: 'A seat in Pulse for you',
    kick: 'Pulse',
    title: 'Pull up a chair.',
    line: 'A seat in Pulse is saved for {{ .Email }}.',
    action: pill(LINK, 'Accept the invite') + small('Works once and only for you.'),
  },
  magic_link: {
    subject: 'Your sign in link',
    kick: 'Sign in',
    title: 'The short way in.',
    line: 'No password needed for {{ .Email }}.',
    action: pill(LINK, 'Sign in') + small(ONCE),
  },
  email_change: {
    subject: 'Confirm your new email',
    kick: 'Email change',
    title: 'New address, same you.',
    line: 'Confirm the move and the mail follows.',
    action:
      facts([
        { label: 'From', value: '{{ .Email }}', guard: '.Email' },
        { label: 'To', value: '{{ .NewEmail }}' },
      ]) +
      pill(LINK, 'Confirm the change') +
      small(ONCE),
  },
  recovery: {
    subject: 'Reset your password',
    kick: 'Password reset',
    title: 'We all forget at times.',
    line: 'A new password for {{ .Email }} is one tap away.',
    action: pill(LINK, 'Set a new password') + small(ONCE),
  },
  reauthentication: {
    subject: '{{ .Token }} is your code',
    kick: 'Code',
    title: 'Just to be sure it is you.',
    line: 'Enter this code to confirm the change.',
    action: code('{{ .Token }}') + small('Works once. Not you? Reply to this email.'),
  },
};

const SET = 'If that was you, all set.';

const NOTICES = {
  password_changed_notification: {
    subject: 'Your password was changed',
    kick: 'Password',
    title: 'Fresh password on file.',
    line: `{{ .Email }} has a new password. ${SET}`,
    action: notMe('password changed'),
  },
  email_changed_notification: {
    subject: 'Your email was changed',
    kick: 'Email',
    title: 'Mail goes somewhere new now.',
    line: `This account answers to a new address. ${SET}`,
    action:
      facts([
        { label: 'From', value: '{{ .OldEmail }}', guard: '.OldEmail' },
        { label: 'To', value: '{{ .Email }}' },
      ]) + notMe('email changed'),
  },
  phone_changed_notification: {
    subject: 'Your phone number was changed',
    kick: 'Phone',
    title: 'A new number on file.',
    line: `The phone on {{ .Email }} changed. ${SET}`,
    action:
      facts([
        { label: 'From', value: '{{ .OldPhone }}', guard: '.OldPhone' },
        { label: 'To', value: '{{ .Phone }}' },
      ]) + notMe('phone number changed'),
  },
  identity_linked_notification: {
    subject: 'A sign in method was added',
    kick: 'Sign in',
    title: 'Another key on the ring.',
    line: `A new way into {{ .Email }}. ${SET}`,
    action: facts([{ label: 'Added', value: '{{ .Provider }}', mono: true }]) + notMe('sign in method added'),
  },
  identity_unlinked_notification: {
    subject: 'A sign in method was removed',
    kick: 'Sign in',
    title: 'One key off the ring.',
    line: `One less way into {{ .Email }}. ${SET}`,
    action: facts([{ label: 'Removed', value: '{{ .Provider }}', mono: true }]) + notMe('sign in method removed'),
  },
  mfa_factor_enrolled_notification: {
    subject: 'A verification step was added',
    kick: 'Verification',
    title: 'A second lock on the gate.',
    line: `Signing in as {{ .Email }} now takes one more step. ${SET}`,
    action: facts([{ label: 'Added', value: '{{ .FactorType }}', mono: true }]) + notMe('verification step added'),
  },
  mfa_factor_unenrolled_notification: {
    subject: 'A verification step was removed',
    kick: 'Verification',
    title: 'One lock off the gate.',
    line: `Signing in as {{ .Email }} takes one less step. ${SET}`,
    action: facts([{ label: 'Removed', value: '{{ .FactorType }}', mono: true }]) + notMe('verification step removed'),
  },
};

export const TEMPLATES = Object.fromEntries(
  Object.entries({ ...ASKS, ...NOTICES }).map(([name, t]) => [
    name,
    { subject: t.subject, html: page({ name, ...t }) },
  ]),
);

// ── THE PREVIEW ──────────────────────────────────────────────────────────────

const SAMPLE = {
  SiteURL: 'https://pulse.neonburro.com',
  ConfirmationURL:
    'https://sspbripimqvfdkfbpubq.supabase.co/auth/v1/verify?token=pkce_8c4e1f0b2a7d93e6c51f4a08b7d2e9c3a6f1b05d48e7&type=recovery&redirect_to=https://pulse.neonburro.com/reset-password/',
  Token: '482913',
  TokenHash: 'pkce_8c4e1f0b2a7d93e6c51f4a08b7d2e9c3a6f1b05d48e7',
  RedirectTo: 'https://pulse.neonburro.com/reset-password/',
  Email: 'jordan@example.com',
  NewEmail: 'jordan.reyes@example.com',
  OldEmail: 'jordan@example.com',
  Phone: '19705550142',
  OldPhone: '19705550188',
  Provider: 'google',
  FactorType: 'totp',
};
// In the email changed notice .Email is already the new address.
const SAMPLE_FOR = { email_changed_notification: { Email: 'jordan.reyes@example.com' } };

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;');

// A stand in for html/template, enough for these files and no more.
export const fill = (src, data) => {
  const parts = src.replace(/<!--[\s\S]*?-->/g, '').split(/({{[^}]*}})/);
  const out = [];
  const stack = [];
  const live = () => stack.every((s) => s.on);
  for (const part of parts) {
    const m = part.match(/^{{\s*(.*?)\s*}}$/);
    if (!m) {
      if (live()) out.push(part);
      continue;
    }
    const expr = m[1];
    let g;
    if ((g = expr.match(/^if\s+\.(\w+)$/))) stack.push({ on: Boolean(data[g[1]]) });
    else if (expr === 'else') stack[stack.length - 1].on = !stack[stack.length - 1].on;
    else if (expr === 'end') stack.pop();
    else if ((g = expr.match(/^\.(\w+)$/))) {
      if (!(g[1] in data)) throw new Error(`no sample for .${g[1]}`);
      if (live()) out.push(esc(data[g[1]]));
    } else throw new Error(`the preview does not know {{ ${expr} }}`);
  }
  if (stack.length) throw new Error('an if without an end');
  return out.join('');
};

// ── WRITE ────────────────────────────────────────────────────────────────────

const OUT = new URL('../supabase/templates/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
for (const [name, t] of Object.entries(TEMPLATES)) {
  writeFileSync(`${OUT}${name}.html`, t.html);
  writeFileSync(`${OUT}${name}.subject.txt`, `${t.subject}\n`);
}

const preview = process.argv.includes('--preview') ? process.argv[process.argv.indexOf('--preview') + 1] : null;
if (preview) {
  const dir = resolve(preview);
  mkdirSync(dir, { recursive: true });
  for (const [name, t] of Object.entries(TEMPLATES)) {
    const data = { ...SAMPLE, ...(SAMPLE_FOR[name] || {}) };
    writeFileSync(join(dir, `${name}.html`), fill(t.html, data));
    writeFileSync(join(dir, `${name}.subject.txt`), `${fill(t.subject, data)}\n`);
  }
  console.log(`preview in ${dir}`);
}

console.log(Object.keys(TEMPLATES).join(' '));
