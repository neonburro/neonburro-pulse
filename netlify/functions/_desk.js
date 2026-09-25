// netlify/functions/_desk.js
// SENTINEL: NB_PULSE_DESK_HAND_V1
//
// The one thing Volt's desk hands to a person, the ask. volt-chat.js calls
// writeAsk when the model uses its write_ask tool, and nothing else writes
// a desk_asks row. The underscore keeps Netlify from deploying it as a
// function, the same convention as _letterhead.js and _social.js beside it.
//
// An ask is a row in public.desk_asks and one mail to the studio inbox,
// NOTIFICATION_EMAIL or hello@neonburro.com, on the letterhead from
// _letterhead.js with the subject in the house mark style the PIN mail
// uses. The row is written first so a mail that does not go still leaves
// the ask on Today, and mailed on the row says which happened. The Today
// list in src/pages/Dashboard/components/VoltAsks.jsx reads the last five
// rows and a hand marks them done.
//
// The transcript column holds the ask in the operator's words as Volt
// wrote them. The name is kept from the first design where every ask was a
// recording, the meaning is the same, what was said.
//
// No oxford commas, no em dashes.

import { Resend } from 'resend';
import { letterhead, button, escapeHtml, C, MONO } from './_letterhead.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TEAM_EMAIL = process.env.NOTIFICATION_EMAIL || 'hello@neonburro.com';
const FROM_EMAIL = 'neonburro <hello@neonburro.com>';
const PULSE_URL = 'https://pulse.neonburro.com/today/';
const ASK_CHARS = 2000;

export const firstNameOf = (profile, user) => {
  const name = String(profile?.display_name || profile?.username || user?.email?.split('@')[0] || '').trim();
  return name.split(/\s+/)[0] || 'somebody';
};

const quote = (text) => `
<div style="margin-top:22px;padding:18px 20px;border-left:3px solid ${C.signal};background:${C.sheet2};border-radius:0 12px 12px 0;font-size:16px;line-height:1.6;color:${C.ink};white-space:pre-wrap;">${escapeHtml(text)}</div>`;

const meta = (page) => `
<div style="margin-top:14px;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${C.inkMuted};">asked on ${escapeHtml(page || 'pulse')}</div>`;

const mail = async ({ first, ask, page }) => {
  if (!RESEND_API_KEY) return 'RESEND_API_KEY is not set on the Pulse site, the mail did not go';
  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEAM_EMAIL,
      reply_to: 'hello@neonburro.com',
      subject: `${first} asked Volt • neonburro`,
      html: letterhead({
        preheader: ask.slice(0, 120),
        kicker: 'pulse · volt',
        title: `${first} asked Volt.`,
        body: `Said to Volt in Pulse, and it is outside what he can draft, so it is for a person.${quote(ask)}${meta(page)}`,
        action: button(PULSE_URL, 'Open Today in Pulse'),
        closing: 'Mark it done on Today when it is. Every ask sits in the last five there until a hand does.',
      }),
    });
    if (error) {
      console.error('[desk] resend error', error.message || error);
      return 'the mail did not go';
    }
    return null;
  } catch (err) {
    console.error('[desk] resend threw', err.message);
    return 'the mail did not go';
  }
};

// Returns { ok, id, mailed, notes, line } where line is what Volt tells the
// operator, or { ok: false, error }.
export const writeAsk = async ({ db, user, chatId, page, ask }) => {
  const text = String(ask || '').trim().slice(0, ASK_CHARS);
  if (!text) return { ok: false, error: 'the ask was empty' };

  const { data: row, error: insErr } = await db
    .from('desk_asks')
    .insert({ user_id: user.id, chat_id: chatId || null, page: page || null, transcript: text, status: 'new' })
    .select('id')
    .maybeSingle();
  if (insErr || !row) {
    console.error('[desk] the ask did not write,', insErr?.message);
    return { ok: false, error: 'the ask could not be written, the desk_asks table may not exist yet' };
  }

  const { data: profile } = await db.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle();
  const first = firstNameOf(profile, user);
  const notes = [];
  const mailNote = await mail({ first, ask: text, page });
  if (mailNote) notes.push(mailNote);
  const mailed = !mailNote;
  await db.from('desk_asks').update({ mailed }).eq('id', row.id);

  return {
    ok: true,
    id: row.id,
    mailed,
    notes,
    line: mailed
      ? 'the ask is on today and the studio inbox has it. a person picks it up from here.'
      : `the ask is on today. ${mailNote}.`,
  };
};
