// netlify/functions/draft-release.js
// SENTINEL: NB_PULSE_DRAFT_RELEASE_V1
//
// Volt drafts a social post. In goes a release id and one line from the
// operator about what the post is for, then optionally a channel, a voice, a
// picture url and its alt line to override what the row already holds. Out
// comes a body in the house voice inside the channel's rails, written onto
// the release row with status drafted. It never stages. A person reads it,
// edits it, stages it and approves it.
//
// The Volt pattern from draft-invoice.js and publish-blog-post.js, a direct
// fetch to Anthropic with one forced tool so the answer is always the shape
// the drawer wants, session gated and staff only because the key costs money
// behind a public url.
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
// the posting hands runs here too, a draft that reads as price talk is not
// written. The numbers match LIMITS, WORD_LIMITS and HASHTAG_LIMITS in
// src/pages/Releases/components/shared.jsx, change them in both places.
//
// ── WHAT IT WRITES ──────────────────────────────────────────────────────────
// body, status drafted, approved false. A staged row drops to drafted
// because the words changed and approval must be read again, the drawer
// follows the same rule. A released row is refused, what left the yard is
// the record.
//
// Needs ANTHROPIC_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the
// Pulse site. There is no spend ceiling on this door yet, its two sibling
// drafters carry none either, that is an open item in the note of
// 2026-09-25.
//
// No oxford commas, no em dashes.

import { createDb, gate, json, assetUrl, readsAsPriceTalk } from './_social.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 700;

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

const ask = async (messages) => {
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
  const toolUse = (data.content || []).find((block) => block.type === 'tool_use' && block.name === 'draft_release');
  const body = String(toolUse?.input?.body || '').trim();
  if (!body) return null;
  return { body, note: String(toolUse?.input?.note || '').trim(), raw: data.content };
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
  const intent = String(input.intent || '').trim();
  if (!releaseId || !intent) return json(400, { error: 'Send a release_id and one line of intent.' });

  const { data: release, error: readErr } = await db.from('releases').select('*').eq('id', releaseId).maybeSingle();
  if (readErr || !release) return json(404, { error: 'That release does not exist.' });
  if (release.status === 'released') return json(409, { error: 'That release already left. What left the yard is the record.' });

  const channel = String(input.channel || release.channel || 'facebook').trim().toLowerCase();
  const voice = String(input.voice || release.voice || 'warbleur').trim().toLowerCase().replace(/\.$/, '');
  const picture = String(input.picture_url || assetUrl(release) || '').trim();
  const alt = String(input.alt || release.asset_alt || '').trim();
  const link = String(release.link || '').trim();

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
    release.body ? `A previous draft exists, replace it,\n${String(release.body).slice(0, 3000)}` : null,
  ].filter(Boolean).join('\n\n');

  const messages = [{ role: 'user', content: brief }];
  const notes = [];
  let draft = await ask(messages);
  if (!draft) return json(502, { error: 'The model did not return a draft, try again.' });

  let issues = check(channel, draft.body);
  if (issues.length) {
    notes.push(`first pass broke a rail, ${issues.join(', ')}. asked once more.`);
    const retry = await ask([
      ...messages,
      { role: 'assistant', content: [{ type: 'text', text: draft.body }] },
      { role: 'user', content: `That draft breaks the rails, ${issues.join(', ')}. Rewrite it inside the rails and answer with the tool again.` },
    ]);
    if (retry) {
      draft = retry;
      issues = check(channel, draft.body);
    }
  }
  if (issues.length) {
    return json(422, { error: 'The draft still breaks a rail and was not written.', issues, body: draft.body, notes });
  }
  const priceTalk = readsAsPriceTalk(draft.body);
  if (priceTalk) {
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
    notes,
  });
};
