// netlify/functions/release-meta.js
// SENTINEL: NB_PULSE_RELEASE_META_V1
//
// The Meta posting hand. Every five minutes it reads approved facebook and
// instagram releases that are staged and due, resolves the publishing
// account, checks the account is enabled and the env exists, then carries
// the words and the picture through the adapter for the channel. Pulse
// decides what to say. A hue•man decides whether it may leave. This
// function only transports the approved record.
//
// It is the sibling of neonburro/netlify/functions/release-social.js, the
// Telegram hand on the studio site, and follows its claim pattern through
// _social.js. It lives here and not there because the Meta values are set
// on the Pulse site, see netlify.toml. The schedule is written in both
// places and they must agree.
//
// Dark until META_PAGE_ACCESS_TOKEN, META_PAGE_ID and META_IG_USER_ID exist
// on the Pulse site. Until then the account rows stay off, the drawer
// refuses approval on an account that is off, and a row that reaches here
// anyway fails with the missing names spelled out.
//
// No oxford commas, no em dashes.

import { createDb, carry, staleBefore, RELEASE_FIELDS } from './_social.js';
import { facebook } from './publish-facebook.js';
import { instagram } from './publish-instagram.js';

const ADAPTERS = { facebook, instagram };

export default async () => {
  const db = createDb();
  if (!db) return new Response('no database', { status: 500 });
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from('releases')
    .select(RELEASE_FIELDS)
    .eq('status', 'staged')
    .eq('approved', true)
    .lte('release_at', now)
    .in('channel', Object.keys(ADAPTERS))
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore()}`)
    .order('release_at', { ascending: true })
    .limit(10);

  if (error) return new Response(`read failed ${error.message}`, { status: 500 });

  const out = [];
  for (const release of due || []) {
    out.push(await carry(db, release, ADAPTERS[release.channel], now));
  }

  return new Response(JSON.stringify({
    at: now,
    posted: out.filter((item) => item.ok).length,
    failed: out.filter((item) => !item.ok).length,
    out,
  }), {
    headers: { 'content-type': 'application/json' },
  });
};

export const config = { schedule: '*/5 * * * *' };
