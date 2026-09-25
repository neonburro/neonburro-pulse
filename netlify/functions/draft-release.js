// netlify/functions/draft-release.js
// SENTINEL: NB_PULSE_DRAFT_RELEASE_V2
//
// Volt drafts a social post. In goes a release id and one line from the
// operator about what the post is for, then optionally a channel, a voice, a
// picture url and its alt line to override what the row already holds.
// Out comes a body in the house voice inside the channel's rails, written
// onto the release row with status drafted. It never stages. A person reads
// it, edits it, stages it and approves it.
//
// The Volt pattern from draft-invoice.js and publish-blog-post.js, a direct
// fetch to Anthropic with one forced tool so the answer is always the shape
// the drawer wants, session gated and staff only because the key costs money
// behind a public url.
//
// ── THE CEILINGS, BINDING ───────────────────────────────────────────────────
// docs/02-engineering/interaction-ceilings.md in the studio repo. A typed
// line here makes the studio spend, so this door carries all three, counted
// off rows in public.release_drafts, never a count header, failing closed,
// staff or not.
//
//   the session    9 drafts in 3 minutes per operator. Tyler's numbers.
//                  Measured as a rolling three minute window because a
//                  function has no session object to measure from, a tenth
//                  inside the window waits.
//   the day        DAY_USD per operator per rolling day, the count derived.
//   the life       LIFE_USD per release row for good, the count derived.
//
// The two dollars are judgement, said plainly. There is no order behind this
// surface yet and so no price to take two percent of, it is a studio cost
// the way burro-chat.js is. When the Meta Business service carries a price
// the life budget becomes two percent of the per post share of it and the
// count is recomputed, never copied forward. The counts are outputs.
//
// ── THE ARITHMETIC, MEASURED 2026-09-25 ─────────────────────────────────────
// Sonnet 5 at $2 per million in and $10 per million out, the first party
// rate confirmed against the API reference on the day and the same pair the
// studio holds in neonburro/netlify/functions/_prices.js. Tokens at 3.6
// characters each, which is conservative for english.
//
//   system prompt              1309 chars     364 tokens
//   tool schema                 438 chars     122
//   channel rail, longest       302 chars      84
//   previous draft, cap 3000              834
//   intent, cap 500 chars                 139
//   bio, lane and row facts               167
//   framing                                60
//   first call in                       1,770    held as 1,800
//   answer, max_tokens                    700
//   correction round in   1,800 + 700 + 60      held as 2,600
//   answer                                700
//   worst case per draft   4,400 in and 1,400 out
//   4,400 x 2 / 1e6 + 1,400 x 10 / 1e6 = 0.0088 + 0.0140 = $0.0228
//
// COST_PER_DRAFT_USD is $0.025, rounded up for prompt growth. If the model,
// the prompt, the caps or the price move, redo the table and move the
// constant. The meter rows in agent_usage are how you check it.
//
// ── THE ORDER OF THINGS ─────────────────────────────────────────────────────
// The trail row is written before anything else so a refused request still
// holds what the operator typed, then the count, then the model. A refusal
// after the trail marks its own row refused and the counts skip it, so a
// refused draft spends nothing. If the trail cannot write or the count
// cannot be taken the door closes, it never answers when it cannot count.
// Every model call writes one agent_usage row, burro volt, site pulse, so
// the meter the studio reads sees this spend too.
//
// ── WHAT IT READS FIRST ─────────────────────────────────────────────────────
// social_review_items, the approved copy library. The live bio for the
// channel, so the draft never contradicts the profile, and the content lane
// for the speaking burro, so warbleur sounds like warbleur and not like
// epoch. Facebook has no bio row yet so it reads the preferred house bio.
//
// ── THE RAILS, CHECKED IN CODE NOT TRUSTED TO THE MODEL ─────────────────────
// facebook under 120 words and no hashtags. instagram under 2200 characters,
// up to three hashtags and only at the end. x under 260. telegram under
// 1024 so a picture can ride with it. Every channel, no exclamation point,
// no em or en dash, no oxford comma. A draft that breaks a rail gets one
// correction round, then the function refuses and returns the draft with
// the issues so a person can see what happened. The price talk rail from
// the posting hands runs here too. The numbers match LIMITS, WORD_LIMITS
// and HASHTAG_LIMITS in src/pages/Releases/components/shared.jsx, change
// them in both places.
//
// ── WHAT IT WRITES ──────────────────────────────────────────────────────────
// body, status drafted, approved false. A staged row drops to drafted
// because the words changed and approval must be read again, the drawer
// follows the same rule. A released row is refused, what left the yard is
// the record.
//
// Needs ANTHROPIC_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the
// Pulse site, plus the 2026-09-25 migration applied for release_drafts.
// Until the table exists every call closes with the count message, which
// is the honest state.
//
// No oxford commas, no em dashes.

import { createDb, gate, json, assetUrl, readsAsPriceTalk } from './_social.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 700;
const INTENT_CHARS = 500;
const PREVIOUS_CHARS = 3000;
const SITE = 'pulse';
const BURRO = 'volt';

// The price pair, dollars per million, the same four numbers as
// PRICES['claude-sonnet-5'] in the studio's _prices.js. Move them together.
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

// The ceilings. See the arithmetic in the header before touching any of these.
const COST_PER_DRAFT_USD = 0.025;
const SESSION_MS = 3 * 60 * 1000;
const SESSION_CAP = 9;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_USD = 1.00;
const LIFE_USD = 0.25;
const DAY_CAP = Math.max(0, Math.floor(DAY_USD / COST_PER_DRAFT_USD));
const LIFE_CAP = Math.max(0, Math.floor(LIFE_USD / COST_PER_DRAFT_USD));

const RAILS = {
  facebook: 'facebook. under 120 words in one to three short paragraphs. no hashtags at all. the link, when there is one, on its own last line.',
  instagram: 'instagram. the first 125 characters carry the whole idea because the feed cuts there, so the first sentence is the post. shorter is better, the rail is 2200 characters. up to three hashtags at the very end on their own line, or none. no url in the caption, instagram does not link them.',
  x: 'x. under 260 characters, one or two quiet sentences, the link on its own last line.',
  telegram: 'telegram. a short paragraph, three or four sentences, under 1024 characters so a picture can ride with it, the link on its own last line.',
  reddit: 'reddit. the first line is a lowercase title, a blank line, then two short paragraphs, then the link.',
};

const SYSTEM = `You are Volt, drafting one social post for neonburro, a small digital studio in Ridgway Colorado on the western slope. The post speaks in the voice of one council burro through the studio account. Write the post only, nothing around it.

The house voice, these are laws not preferences:
- everything lowercase, titles and the first word of a sentence included
- calm plainspoken and dry, specific over grand, one idea per post
- no exclamation points, no hype, no marketing voice, no call to action louder than a door held open
- no oxford commas, no em dashes and no en dashes, do not use a colon as sentence punctuation
- burro characters are named lowercase with a trailing period, for example "warbleur." or "volt.", and are never called donkeys
- the word hue-man is always spelled with an interpunct as hue•man
- the word dashboard is banned
- never talk about price, returns, gains or urgency, never promise anything financial, never say buy
- real places anchor the writing, Ridgway, Ouray, the Uncompahgre, the Cimarrons, the San Juans, the western slope
- the picture is in the post, do not describe it back to the reader, speak from beside it
- never contradict the live profile bio you are given, the post and the bio are one voice

Always answer by calling the draft_release tool.`;

const TOOL = {
  name: 'draft_release',
  description: 'Return one post body for the channel and a one line note to the operator.',
  input_schema: {
    type: 'object',
    properties: {
      body: { type: 'string', description: 'the full paste ready text of the post, nothing else' },
      note: { type: 'string', description: 'one short line to the operator on what the draft leaned on' },
    },
    required: ['body', 'note'],
  },
};

// What a closed door says. Words, never a number the operator did not know
// about, except the counts, which staff may know. The drawer renders these
// verbatim and keeps no copy of its own.
const CLOSED = {
  session: 'that is nine drafts in three minutes. give it a minute and the door opens again.',
  day: `that is ${DAY_CAP} drafts today, the day's budget. tomorrow it opens again, or write this one by hand.`,
  life: `this release has had its ${LIFE_CAP} drafts, the budget for one post. the rest is by hand.`,
  count: 'volt cannot count right now, so the door is closed. try again in a minute.',
  trail: 'volt could not write the trail, so the door is closed. nothing was spent.',
};

const hashtagsOf = (text) => (
  String(text || '').match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []
).map((tag) => tag.trim());

const wordsOf = (text) => {
  const clean = String(text || '').trim();
  return clean ? clean.split(/\s+/).length : 0;
};

const check = (channel, text) => {
  const issues = [];
  const tags = hashtagsOf(text);
  if (channel === 'facebook') {
    const words = wordsOf(text);
    if (words > 120) issues.push(`${words} words, the rail is 120`);
    if (tags.length) issues.push('a hashtag, facebook posts carry none');
  }
  if (channel === 'instagram') {
    if (text.length > 2200) issues.push(`${text.length} characters, the rail is 2200`);
    if (tags.length > 3) issues.push(`${tags.length} hashtags, the rail is three`);
    if (tags.length) {
      const stripped = text.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, '');
      if (hashtagsOf(stripped).length) issues.push('hashtags inside the copy, they go at the end or nowhere');
    }
    if (/https?:\/\//i.test(text)) issues.push('a url in the caption, instagram does not link it');
  }
  if (channel === 'x' && text.length > 260) issues.push(`${text.length} characters, the rail is 260`);
  if (channel === 'telegram' && text.length > 1024) issues.push(`${text.length} characters, the picture caption rail is 1024`);
  if (/[\u2014\u2013]/.test(text)) issues.push('an em or en dash');
  if (/!/.test(text)) issues.push('an exclamation point');
  if (/,\s+(and|or)\s/i.test(text)) issues.push('a comma before and or or, the oxford comma');
  return issues;
};

// ── the meter ───────────────────────────────────────────────────────────────
// One agent_usage row per model call, the same row shape the studio's
// _usage.js writes. Cost is null when the response names a model this file
// does not price, a signal to look, never a zero. Never throws.
const n = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const baseId = (model) => String(model || '').trim().replace(/-\d{8}$/, '');

const costOf = (model, usage = {}) => {
  if (baseId(model) !== MODEL) return null;
  const dollars = (
    n(usage.input_tokens) * PRICE.input
    + n(usage.output_tokens) * PRICE.output
    + n(usage.cache_read_input_tokens) * PRICE.cacheRead
    + n(usage.cache_creation_input_tokens) * PRICE.cacheWrite
  ) / 1_000_000;
  return Math.round(dollars * 1e6) / 1e6;
};

const meter = async (db, data) => {
  try {
    const usage = data?.usage || {};
    const { error } = await db.from('agent_usage').insert({
      burro: BURRO,
      model: String(data?.model || MODEL),
      input_tokens: n(usage.input_tokens),
      output_tokens: n(usage.output_tokens),
      cache_read_tokens: n(usage.cache_read_input_tokens),
      cache_write_tokens: n(usage.cache_creation_input_tokens),
      cost_usd: costOf(data?.model || MODEL, usage),
      source: 'live',
      request_id: data?.id || null,
      site: SITE,
    });
    if (error) console.warn('[draft-release] meter row did not write,', error.message);
  } catch (err) {
    console.warn('[draft-release] meter threw,', err.message);
  }
};

// ── the count ───────────────────────────────────────────────────────────────
// Rows and a limit, never a count header. Refused rows are skipped. Throws
// when it cannot tell, and the caller closes the door on a throw. Cheapest
// window first so an operator already stopped by the session never runs the
// all time read. Refused on greater than, the trail row just written is
// inside the count, so the ninth draft in a session is answered and the
// tenth is not.
const overLimit = async (db, userId, releaseId) => {
  const rows = async (query, cap) => {
    const { data, error } = await query.is('refused', null).limit(cap + 2);
    if (error) throw new Error(error.message);
    return (data || []).length;
  };
  const since = (ms) => new Date(Date.now() - ms).toISOString();

  const inSession = await rows(
    db.from('release_drafts').select('id').eq('user_id', userId).gte('created_at', since(SESSION_MS)),
    SESSION_CAP,
  );
  if (inSession > SESSION_CAP) return { reason: 'session', detail: `${inSession} in three minutes` };

  const inDay = await rows(
    db.from('release_drafts').select('id').eq('user_id', userId).gte('created_at', since(DAY_MS)),
    DAY_CAP,
  );
  if (inDay > DAY_CAP) return { reason: 'day', detail: `${inDay} in a day` };

  const inLife = await rows(
    db.from('release_drafts').select('id').eq('release_id', releaseId),
    LIFE_CAP,
  );
  if (inLife > LIFE_CAP) return { reason: 'life', detail: `${inLife} of ${LIFE_CAP} on this release` };

  return null;
};

// A refusal after the trail marks its own row so the counts skip it. If the
// mark fails the row counts, which fails closed.
const markRefused = async (db, trailId, reason) => {
  if (!trailId) return;
  const { error } = await db.from('release_drafts').update({ refused: true, refusal: reason }).eq('id', trailId);
  if (error) console.warn('[draft-release] could not mark the trail refused, it will count,', error.message);
};

const ask = async (db, messages) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'draft_release' },
      messages,
    }),
  });
  if (!res.ok) {
    console.error('Anthropic error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  await meter(db, data);
  const toolUse = (data.content || []).find((block) => block.type === 'tool_use' && block.name === 'draft_release');
  const body = String(toolUse?.input?.body || '').trim();
  return {
    body,
    note: String(toolUse?.input?.note || '').trim(),
    usage: data.usage || {},
    model: data.model || MODEL,
    requestId: data.id || null,
  };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { error: gated.error });
  if (!ANTHROPIC_API_KEY) return json(503, { error: 'ANTHROPIC_API_KEY is not set on the Pulse site, Volt cannot draft yet.' });

  let input = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Send json.' });
  }
  const releaseId = input.release_id;
  const intent = String(input.intent || '').trim().slice(0, INTENT_CHARS);
  if (!releaseId || !intent) return json(400, { error: 'Send a release_id and one line of intent.' });

  const { data: release, error: readErr } = await db.from('releases').select('*').eq('id', releaseId).maybeSingle();
  if (readErr || !release) return json(404, { error: 'That release does not exist.' });
  if (release.status === 'released') return json(409, { error: 'That release already left. What left the yard is the record.' });

  const channel = String(input.channel || release.channel || 'facebook').trim().toLowerCase();
  const voice = String(input.voice || release.voice || 'warbleur').trim().toLowerCase().replace(/\.$/, '');
  const picture = String(input.picture_url || assetUrl(release) || '').trim();
  const alt = String(input.alt || release.asset_alt || '').trim();
  const link = String(release.link || '').trim();

  // ── the trail, before anything can be spent ───────────────────────────────
  const { data: trail, error: trailErr } = await db
    .from('release_drafts')
    .insert({ release_id: releaseId, user_id: gated.user.id, channel, voice, intent, model: MODEL })
    .select('id')
    .maybeSingle();
  if (trailErr || !trail) {
    console.error('[draft-release] trail did not write, refusing,', trailErr?.message);
    return json(503, { error: CLOSED.trail, message: CLOSED.trail, reason: 'trail' });
  }

  // ── the ceiling, after the trail and before the model ─────────────────────
  let over = null;
  try {
    over = await overLimit(db, gated.user.id, releaseId);
  } catch (err) {
    console.error('[draft-release] could not count, refusing,', err.message);
    await markRefused(db, trail.id, 'count');
    return json(503, { error: CLOSED.count, message: CLOSED.count, reason: 'count' });
  }
  if (over) {
    console.warn(`[draft-release] ${gated.user.id} over the ${over.reason} ceiling, ${over.detail}, refused`);
    await markRefused(db, trail.id, over.reason);
    return json(429, { error: CLOSED[over.reason], message: CLOSED[over.reason], reason: over.reason });
  }

  const { data: items } = await db
    .from('social_review_items')
    .select('kind, slug, title, body, summary, voice, channel, preferred')
    .eq('status', 'approved')
    .in('kind', ['profile_copy', 'content_lane']);
  const bios = (items || []).filter((item) => item.kind === 'profile_copy');
  const bio = bios.find((item) => item.channel === channel)
    || bios.find((item) => item.preferred && item.channel === 'x_github')
    || bios.find((item) => item.preferred)
    || null;
  const lane = (items || []).find((item) => item.kind === 'content_lane' && item.voice === voice) || null;

  const brief = [
    `Channel rails, ${RAILS[channel] || `${channel}. short and plain, the link on its own last line.`}`,
    `The speaking burro is ${voice}. ${lane ? `Their lane, ${lane.title}. ${lane.body} ${lane.summary || ''}` : 'No lane is on file for this voice, keep to the studio voice.'}`.trim(),
    bio ? `The live profile bio for this account reads,\n${bio.body}` : 'No live bio is on file for this channel.',
    `What the post is for, in the operator's words,\n${intent}`,
    release.title ? `The release is titled, ${release.title}` : null,
    release.content_pillar ? `Content lane on the row, ${release.content_pillar}` : null,
    picture ? `A picture rides with the post. Its alt line, ${alt || 'none written'}.` : 'No picture rides with the post.',
    link && channel !== 'instagram' ? `The link to carry exactly as given, ${link}` : null,
    release.body ? `A previous draft exists, replace it,\n${String(release.body).slice(0, PREVIOUS_CHARS)}` : null,
  ].filter(Boolean).join('\n\n');

  const messages = [{ role: 'user', content: brief }];
  const notes = [];
  const spent = { input: 0, output: 0, cost: 0, rounds: 0, requestId: null };
  const tally = (answer) => {
    spent.input += n(answer.usage.input_tokens) + n(answer.usage.cache_read_input_tokens) + n(answer.usage.cache_creation_input_tokens);
    spent.output += n(answer.usage.output_tokens);
    spent.cost += costOf(answer.model, answer.usage) || 0;
    spent.rounds += 1;
    if (!spent.requestId) spent.requestId = answer.requestId;
  };

  let draft = await ask(db, messages);
  if (draft) tally(draft);
  if (!draft || !draft.body) {
    await db.from('release_drafts').update({
      input_tokens: spent.input, output_tokens: spent.output, cost_usd: spent.cost, rounds: spent.rounds, request_id: spent.requestId,
    }).eq('id', trail.id);
    return json(502, { error: 'The model did not return a draft, try again.' });
  }

  let issues = check(channel, draft.body);
  if (issues.length) {
    notes.push(`first pass broke a rail, ${issues.join(', ')}. asked once more.`);
    const retry = await ask(db, [
      ...messages,
      { role: 'assistant', content: [{ type: 'text', text: draft.body }] },
      { role: 'user', content: `That draft breaks the rails, ${issues.join(', ')}. Rewrite it inside the rails and answer with the tool again.` },
    ]);
    if (retry) {
      tally(retry);
      if (retry.body) {
        draft = retry;
        issues = check(channel, draft.body);
      }
    }
  }

  // The spend is real whether or not the draft is kept, so the trail carries
  // it either way and the row counts against the ceilings.
  await db.from('release_drafts').update({
    input_tokens: spent.input, output_tokens: spent.output, cost_usd: spent.cost, rounds: spent.rounds, request_id: spent.requestId,
  }).eq('id', trail.id);

  if (issues.length) {
    return json(422, { error: 'The draft still breaks a rail and was not written.', issues, body: draft.body, notes });
  }
  if (readsAsPriceTalk(draft.body)) {
    return json(422, { error: 'The draft reads as price talk and was not written.', body: draft.body, notes });
  }

  if (release.status === 'staged') notes.push('the row was staged, it drops to drafted because the words changed.');
  if (release.approved) notes.push('approval dropped so the new words can be read.');

  const patch = {
    body: draft.body,
    status: 'drafted',
    approved: false,
    approved_at: null,
    error: null,
    updated_at: new Date().toISOString(),
  };
  const { data: written, error: writeErr } = await db
    .from('releases')
    .update(patch)
    .eq('id', releaseId)
    .neq('status', 'released')
    .select('id')
    .maybeSingle();
  if (writeErr || !written) return json(500, { error: writeErr?.message || 'The draft could not be written.' });

  return json(200, {
    ok: true,
    body: draft.body,
    note: draft.note,
    status: 'drafted',
    channel,
    voice,
    bio: bio ? bio.slug : null,
    lane: lane ? lane.slug : null,
    spent: { rounds: spent.rounds, input_tokens: spent.input, output_tokens: spent.output, cost_usd: Math.round(spent.cost * 1e6) / 1e6 },
    notes,
  });
};
