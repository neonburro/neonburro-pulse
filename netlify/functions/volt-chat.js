// netlify/functions/volt-chat.js
// SENTINEL: NB_PULSE_VOLT_CHAT_V1
//
// Volt's desk. The chat sheet in src/components/Layout/VoltDesk.jsx talks
// to this door. Volt drafts anything within Pulse and hands the rest to a
// person. He never sends, posts, pays or deletes anything, and he has no
// tool that can. Built on the Volt pattern from draft-invoice.js, the Draft
// with Volt door on Invoicing, a direct fetch to Anthropic, session gated
// and staff only through gate() in _social.js because the key costs money
// behind a public url.
//
// Two actions, both POST.
//
//   turn   { chat_id, page, messages }   one model call with the three tools.
//          The answer is text, or text and one tool call. write_ask runs
//          here because it is a row and a mail. The two drafting tools are
//          handed back to the sheet unrun, see the clock below.
//   run    { chat_id, tool }             runs draft_invoice or draft_release
//          in process by importing the handler of draft-invoice.js or
//          draft-release.js and calling it with a synthetic event that
//          carries the operator's own bearer. The same code path, the same
//          gate, the same trail and ceilings those doors keep. No model
//          call of its own.
//
// ── THE CLOCK, WHY A TOOL IS TWO REQUESTS ───────────────────────────────────
// A synchronous Netlify function has ten seconds. A chat turn is one Sonnet
// call, a drafting tool is a second Sonnet call inside draft-invoice or
// draft-release, and two in one request pass ten seconds often enough to
// be a bug. So the sheet carries the loop. turn answers with the tool call,
// the sheet posts run, run answers with the draft, and the sheet keeps the
// tool_use and the tool_result in its history so the next turn sees them.
// One model call per request, always.
//
// ── THE CEILINGS, BINDING ───────────────────────────────────────────────────
// neonburro/docs/02-engineering/interaction-ceilings.md. A typed or spoken
// line here makes the studio spend, so this door carries all three, counted
// off rows in public.desk_turns with kind turn, written before the model is
// called, never a count header, failing closed, staff or not. Every model
// call writes one agent_usage row, burro volt, site pulse, the same row
// shape draft-release.js writes, so the meter the studio reads sees this
// spend too. run writes no turn row, the door it calls keeps its own.
//
//   the session    9 turns in 3 minutes per operator. Tyler's numbers.
//                  Measured as a rolling three minute window because a
//                  function has no session object to measure from, a tenth
//                  inside the window waits.
//   the day        DAY_USD per operator per rolling day, the count derived.
//   the life       LIFE_USD per chat, by chat_id, the count derived. A chat
//                  is one open sheet, the new button mints another id, and
//                  the day still binds across all of them.
//
// The two dollars are judgement, said plainly. There is no order behind this
// surface and so no price to take two percent of, it is a studio cost the
// way the draft door is. If the model, the prompt, the caps or the price
// move, redo the table and move the constant. The counts are outputs.
//
// ── THE ARITHMETIC, MEASURED 2026-09-25 ─────────────────────────────────────
// Sonnet 5 at $2 per million in and $10 per million out, the same pair
// draft-release.js holds and the studio's _prices.js. Tokens at 3.6
// characters each, conservative for english. Measured with node against
// this file and src/data/pulseMap.js on the day.
//
//   role, rules and the voice laws               2,095 chars     582 tokens
//   the map of pulse                             3,727 chars   1,036
//   the three tool schemas                       1,559 chars     434
//   context, 60 clients and 12 releases, cap     5,640 chars   1,567
//   history, HISTORY_MESSAGES 10 at TURN_CHARS  12,000 chars   3,334
//   framing                                                        60
//   worst case in                                               7,013    held as 7,200
//   answer, max_tokens                                            700
//   7,200 x 2 / 1e6 + 700 x 10 / 1e6 = 0.0144 + 0.0070 = $0.0214
//
// COST_PER_TURN_USD is $0.022, rounded up for prompt growth.
//
//   the day     $1.00 / $0.022 = 45.4   DAY_CAP 45 turns per operator
//   the life    $0.50 / $0.022 = 22.7   LIFE_CAP 22 turns per chat
//
// ── THE ORDER OF THINGS ─────────────────────────────────────────────────────
// The trail row is written before anything else so a refused turn still
// holds what the operator typed, then the count, then the model. A refusal
// after the trail marks its own row refused and the counts skip it, so a
// refused turn spends nothing. If the trail cannot write or the count
// cannot be taken the door closes, it never answers when it cannot count.
//
// ── WHAT VOLT IS TOLD ───────────────────────────────────────────────────────
// The role and the house voice laws, the map of every page in Pulse from
// src/data/pulseMap.js, then the context for this turn read fresh, the
// clients on file with their ids so draft_invoice can match one, the
// releases in Socials that can take a draft with their ids so
// draft_release can name one, and the page the operator is on. When a
// thing is outside the three tools he says so and offers to write the ask.
//
// ── THE HISTORY IS THE SHEET'S ──────────────────────────────────────────────
// The browser sends the whole conversation every turn, the way the API
// wants it. It is sanitised here, roles user or assistant only, blocks of
// type text, tool_use and tool_result only, text capped, the last
// HISTORY_MESSAGES kept, and the front trimmed until it starts on a user
// text so a tool_result never arrives without its tool_use. The sheet
// stores assistant content verbatim from the answer so the ids match.
//
// Needs ANTHROPIC_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the
// Pulse site, plus the 2026-09-25 desk migration applied for desk_turns and
// desk_asks. Until the table exists every turn closes with the trail
// message, which is the honest state.
//
// No oxford commas, no em dashes.

import { createDb, gate, json } from './_social.js';
import { writeAsk } from './_desk.js';
import { handler as draftInvoiceDoor } from './draft-invoice.js';
import { handler as draftReleaseDoor } from './draft-release.js';
import { pulseMapText } from '../../src/data/pulseMap.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 700;
const KIND = 'turn';
const SITE = 'pulse';
const BURRO = 'volt';
const TURN_CHARS = 1200;
const RESULT_CHARS = 1200;
const HISTORY_MESSAGES = 10;
const PAGE_CHARS = 200;
const CLIENTS_CAP = 60;
const RELEASES_CAP = 12;
const CHANNELS = ['facebook', 'instagram', 'x', 'telegram', 'reddit'];

// The price pair, dollars per million, the same four numbers as
// PRICES['claude-sonnet-5'] in the studio's _prices.js and PRICE in
// draft-release.js. Move them together.
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

// The ceilings. See the arithmetic in the header before touching any of these.
const COST_PER_TURN_USD = 0.022;
const SESSION_MS = 3 * 60 * 1000;
const SESSION_CAP = 9;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_USD = 1.00;
const LIFE_USD = 0.50;
const DAY_CAP = Math.max(0, Math.floor(DAY_USD / COST_PER_TURN_USD));
const LIFE_CAP = Math.max(0, Math.floor(LIFE_USD / COST_PER_TURN_USD));

// What a closed door says. Words, never a number the operator did not know
// about, except the counts, which staff may know. The sheet renders these
// verbatim and keeps no copy of its own.
const CLOSED = {
  session: 'that is nine turns in three minutes. give it a minute and the desk opens again.',
  day: `that is ${DAY_CAP} turns today, the day's budget. tomorrow it opens again, or write a person.`,
  life: `this chat has had its ${LIFE_CAP} turns, the budget for one chat. start a new one, the day still counts.`,
  count: 'volt cannot count right now, so the desk is closed. try again in a minute.',
  trail: 'volt could not write the trail, so the desk is closed. nothing was spent.',
  key: 'ANTHROPIC_API_KEY is not set on the Pulse site, so volt cannot answer yet.',
};

export const SYSTEM_ROLE = `You are Volt, the operator's assistant inside Pulse, the back office of neonburro, a small digital studio in Ridgway Colorado on the western slope. You draft. You never send, post, pay or delete anything, and you have no tool that can. A person reads what you draft and decides.

What you can do, and only this.
- draft an invoice with draft_invoice. It is the same drafter as Draft with Volt on Invoicing. Say the client and the lines plainly in the text and call the tool, the person previews the draft in the editor.
- draft a social post with draft_release, onto a release that already exists in Socials. Pick the release id from the list you are given. If no release fits, say so and offer to write an ask.
- write an ask for a person with write_ask, when the thing is outside your tools or the operator asks you to. It lands on Today and mails the studio inbox. Put the ask in the operator's words.

When a thing is outside those three, say so plainly in one line and offer to write the ask. Never say you did a thing you did not do. Never invent a client, a release, an amount or a date. When the ask is unclear ask one short question, otherwise act. Before a tool call say in one short line what you are about to draft.

The house voice, laws not preferences.
- everything lowercase, the first word of a sentence included
- calm, plainspoken and dry, specific over grand, short over long, one or two sentences unless a draft needs more
- no exclamation points, no hype, no marketing voice
- no oxford commas, no em dashes and no en dashes, do not use a colon as sentence punctuation
- burro characters are named lowercase, you are volt, and are never called donkeys
- the word hue-man is always spelled with an interpunct as hue•man
- the word dashboard is banned, the page is called Today
- never talk about the coin's price, returns or gains, never promise anything financial
- real places anchor the writing, Ridgway, Ouray, the Uncompahgre, the San Juans

The map of Pulse, every page and what it holds. When the operator asks where a thing lives, answer from this and name the path.`;

export const TOOLS = [
  {
    name: 'draft_invoice',
    description: 'Draft a neonburro invoice from a plain description. The same drafter as Draft with Volt on Invoicing. The person previews it in the editor, nothing is sent.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'what to invoice in the operator words, the client name, the month, the lines and the amounts' },
      },
      required: ['text'],
    },
  },
  {
    name: 'draft_release',
    description: 'Draft a social post onto a release that already exists in Socials. Needs a release id from the list you were given. The person reads, stages and approves it, nothing posts.',
    input_schema: {
      type: 'object',
      properties: {
        release_id: { type: 'string', description: 'the id of the release from the list' },
        intent: { type: 'string', description: 'one line on what the post is for, in the operator words' },
        channel: { type: 'string', enum: CHANNELS, description: 'only when the operator names one, else leave it out and the row decides' },
        voice: { type: 'string', description: 'the speaking burro, only when the operator names one' },
      },
      required: ['release_id', 'intent'],
    },
  },
  {
    name: 'write_ask',
    description: 'Write an ask for a person on the studio. Use it when the thing is outside your tools or when the operator asks for it. It lands on Today and mails the studio inbox.',
    input_schema: {
      type: 'object',
      properties: {
        ask: { type: 'string', description: 'the ask in the operator own words, one to three sentences, with the page it concerns when that matters' },
      },
      required: ['ask'],
    },
  },
];

const n = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const baseId = (model) => String(model || '').trim().replace(/-\d{8}$/, '');
const cut = (text, max) => String(text || '').slice(0, max);

// ── the meter ───────────────────────────────────────────────────────────────
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
    if (error) console.warn('[volt-chat] meter row did not write,', error.message);
  } catch (err) {
    console.warn('[volt-chat] meter threw,', err.message);
  }
};

// ── the count ───────────────────────────────────────────────────────────────
// Rows and a limit, never a count header. Refused rows are skipped. Throws
// when it cannot tell, and the caller closes the door on a throw. Cheapest
// window first. Refused on greater than, the trail row just written is
// inside the count, so the ninth turn in a session is answered and the
// tenth is not.
const overLimit = async (db, userId, chatId) => {
  const rows = async (query, cap) => {
    const { data, error } = await query.eq('kind', KIND).is('refused', null).limit(cap + 2);
    if (error) throw new Error(error.message);
    return (data || []).length;
  };
  const since = (ms) => new Date(Date.now() - ms).toISOString();

  const inSession = await rows(
    db.from('desk_turns').select('id').eq('user_id', userId).gte('created_at', since(SESSION_MS)),
    SESSION_CAP,
  );
  if (inSession > SESSION_CAP) return { reason: 'session', detail: `${inSession} in three minutes` };

  const inDay = await rows(
    db.from('desk_turns').select('id').eq('user_id', userId).gte('created_at', since(DAY_MS)),
    DAY_CAP,
  );
  if (inDay > DAY_CAP) return { reason: 'day', detail: `${inDay} in a day` };

  const inLife = await rows(
    db.from('desk_turns').select('id').eq('chat_id', chatId),
    LIFE_CAP,
  );
  if (inLife > LIFE_CAP) return { reason: 'life', detail: `${inLife} of ${LIFE_CAP} on this chat` };

  return null;
};

const markRefused = async (db, trailId, reason) => {
  if (!trailId) return;
  const { error } = await db.from('desk_turns').update({ refused: true, refusal: reason }).eq('id', trailId);
  if (error) console.warn('[volt-chat] could not mark the trail refused, it will count,', error.message);
};

// ── the history ─────────────────────────────────────────────────────────────
const cleanBlock = (block) => {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'text') {
    const text = cut(block.text, TURN_CHARS).trim();
    return text ? { type: 'text', text } : null;
  }
  if (block.type === 'tool_use') {
    if (!block.id || !TOOLS.some((t) => t.name === block.name)) return null;
    return { type: 'tool_use', id: String(block.id), name: block.name, input: block.input && typeof block.input === 'object' ? block.input : {} };
  }
  if (block.type === 'tool_result') {
    if (!block.tool_use_id) return null;
    return { type: 'tool_result', tool_use_id: String(block.tool_use_id), content: cut(typeof block.content === 'string' ? block.content : JSON.stringify(block.content || ''), RESULT_CHARS) };
  }
  return null;
};

const cleanHistory = (messages) => {
  const kept = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => {
      const blocks = typeof m.content === 'string'
        ? [cleanBlock({ type: 'text', text: m.content })]
        : (Array.isArray(m.content) ? m.content.map(cleanBlock) : []);
      const content = blocks.filter(Boolean);
      return content.length ? { role: m.role, content } : null;
    })
    .filter(Boolean)
    .slice(-HISTORY_MESSAGES);
  while (kept.length && !(kept[0].role === 'user' && kept[0].content[0].type === 'text')) kept.shift();
  return kept;
};

const lastUserText = (history) => {
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') return '';
  const text = last.content.find((b) => b.type === 'text');
  return text ? text.text : '[tool result]';
};

// ── the context, read fresh every turn ──────────────────────────────────────
const context = async (db, page) => {
  const [{ data: clients }, { data: releases }] = await Promise.all([
    db.from('clients').select('id, name, company').order('name').limit(CLIENTS_CAP),
    db.from('releases').select('id, title, channel, voice, status').neq('status', 'released').order('updated_at', { ascending: false }).limit(RELEASES_CAP),
  ]);
  const clientLines = (clients || []).map((c) => `- ${c.name}${c.company ? ` (${c.company})` : ''} [id ${c.id}]`).join('\n');
  const releaseLines = (releases || []).map((r) => `- ${r.title || 'untitled'}, ${r.channel || 'no channel'}, ${r.voice || 'no voice'}, ${r.status} [id ${r.id}]`).join('\n');
  return [
    `Clients on file, match by name and use the id for draft_invoice.\n${clientLines || '(none)'}`,
    `Releases in Socials that can take a draft, use the id for draft_release.\n${releaseLines || '(none, say so and offer an ask)'}`,
    `The operator is on ${page || 'a page of Pulse'} right now.`,
  ].join('\n\n');
};

const ask = async (db, system, messages) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, tools: TOOLS, messages }),
  });
  if (!res.ok) {
    console.error('Anthropic error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  await meter(db, data);
  return data;
};

// ── turn ────────────────────────────────────────────────────────────────────
const turn = async (db, gated, input) => {
  if (!ANTHROPIC_API_KEY) return json(503, { error: CLOSED.key, message: CLOSED.key, reason: 'key' });
  const chatId = String(input.chat_id || '').trim().slice(0, 64);
  if (!chatId) return json(400, { error: 'Send a chat_id.' });
  const page = cut(input.page, PAGE_CHARS).trim() || null;
  const history = cleanHistory(input.messages);
  if (!history.length || history[history.length - 1].role !== 'user') return json(400, { error: 'Send a message.' });
  const prompt = cut(lastUserText(history), TURN_CHARS);

  // The trail, before anything can be spent.
  const { data: trail, error: trailErr } = await db
    .from('desk_turns')
    .insert({ kind: KIND, chat_id: chatId, user_id: gated.user.id, page, prompt, model: MODEL })
    .select('id')
    .maybeSingle();
  if (trailErr || !trail) {
    console.error('[volt-chat] trail did not write, refusing,', trailErr?.message);
    return json(503, { error: CLOSED.trail, message: CLOSED.trail, reason: 'trail' });
  }

  // The ceiling, after the trail and before the model.
  let over = null;
  try {
    over = await overLimit(db, gated.user.id, chatId);
  } catch (err) {
    console.error('[volt-chat] could not count, refusing,', err.message);
    await markRefused(db, trail.id, 'count');
    return json(503, { error: CLOSED.count, message: CLOSED.count, reason: 'count' });
  }
  if (over) {
    console.warn(`[volt-chat] ${gated.user.id} over the ${over.reason} ceiling, ${over.detail}, refused`);
    await markRefused(db, trail.id, over.reason);
    return json(429, { error: CLOSED[over.reason], message: CLOSED[over.reason], reason: over.reason });
  }

  const system = `${SYSTEM_ROLE}\n${pulseMapText()}\n\n${await context(db, page)}`;
  const data = await ask(db, system, history);
  if (!data) {
    await db.from('desk_turns').update({ rounds: 1 }).eq('id', trail.id);
    return json(502, { error: 'volt could not reach the model. try again.' });
  }

  const content = Array.isArray(data.content) ? data.content : [];
  const reply = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const toolUse = content.find((b) => b.type === 'tool_use') || null;
  const usage = data.usage || {};
  await db.from('desk_turns').update({
    input_tokens: n(usage.input_tokens) + n(usage.cache_read_input_tokens) + n(usage.cache_creation_input_tokens),
    output_tokens: n(usage.output_tokens),
    cost_usd: costOf(data.model, usage),
    rounds: 1,
    request_id: data.id || null,
    tool: toolUse ? toolUse.name : null,
  }).eq('id', trail.id);

  const notes = [];
  if (data.stop_reason === 'max_tokens') notes.push('the answer ran to the cap and was cut');

  if (toolUse && toolUse.name === 'write_ask') {
    const written = await writeAsk({ db, user: gated.user, chatId, page, ask: toolUse.input?.ask });
    return json(200, {
      ok: true,
      reply,
      assistant: content,
      tool: { id: toolUse.id, name: toolUse.name, input: toolUse.input || {} },
      result: written.ok
        ? { ok: true, name: 'write_ask', ask_id: written.id, mailed: written.mailed, line: written.line, notes: written.notes }
        : { ok: false, name: 'write_ask', error: written.error, line: `the ask was not written, ${written.error}.` },
      done: true,
      notes,
    });
  }

  if (toolUse) {
    return json(200, {
      ok: true,
      reply,
      assistant: content,
      tool: { id: toolUse.id, name: toolUse.name, input: toolUse.input || {} },
      done: false,
      notes,
    });
  }

  return json(200, { ok: true, reply: reply || 'volt had nothing to say. try again.', assistant: content, done: true, notes });
};

// ── run ─────────────────────────────────────────────────────────────────────
// The operator's own bearer rides into the door so it gates the same person
// the same way. The answer is the door's own body, parsed and handed back
// with the tool name so the sheet knows what it holds.
const callDoor = async (door, event, body) => {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const answer = await door({ httpMethod: 'POST', headers: { authorization }, body: JSON.stringify(body) });
  let parsed = null;
  try {
    parsed = JSON.parse(answer.body || '{}');
  } catch {
    parsed = null;
  }
  return { status: answer.statusCode, data: parsed };
};

const run = async (db, gated, event, input) => {
  const tool = input.tool && typeof input.tool === 'object' ? input.tool : null;
  if (!tool || !tool.name) return json(400, { error: 'Send the tool.' });
  const args = tool.input && typeof tool.input === 'object' ? tool.input : {};

  if (tool.name === 'draft_invoice') {
    const text = cut(args.text, 4000).trim();
    if (!text) return json(400, { error: 'The invoice tool needs text.' });
    const { data: clients } = await db.from('clients').select('id, name, company').order('name').limit(CLIENTS_CAP);
    const { status, data } = await callDoor(draftInvoiceDoor, event, { text, attachments: [], clients: clients || [] });
    if (status !== 200 || !data || data.error || !data.draft) {
      return json(200, { ok: false, name: 'draft_invoice', error: data?.error || `the invoice door answered ${status}` });
    }
    return json(200, { ok: true, name: 'draft_invoice', draft: data.draft });
  }

  if (tool.name === 'draft_release') {
    const releaseId = String(args.release_id || '').trim();
    const intent = cut(args.intent, 500).trim();
    if (!releaseId || !intent) return json(400, { error: 'The release tool needs a release_id and an intent.' });
    const body = { release_id: releaseId, intent };
    if (args.channel && CHANNELS.includes(args.channel)) body.channel = args.channel;
    if (args.voice) body.voice = cut(args.voice, 40);
    const { status, data } = await callDoor(draftReleaseDoor, event, body);
    if (status !== 200 || !data || !data.ok) {
      return json(200, { ok: false, name: 'draft_release', error: data?.message || data?.error || `the release door answered ${status}`, issues: data?.issues || [], body: data?.body || null });
    }
    return json(200, { ok: true, name: 'draft_release', body: data.body, note: data.note, channel: data.channel, voice: data.voice, release_id: releaseId, notes: data.notes || [] });
  }

  return json(400, { error: 'That tool does not run here.' });
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const db = createDb();
  const gated = await gate(db, event);
  if (gated.error) return json(gated.status, { error: gated.error });

  let input = {};
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Send json.' });
  }

  const action = String(input.action || 'turn').trim();
  try {
    if (action === 'turn') return await turn(db, gated, input);
    if (action === 'run') return await run(db, gated, event, input);
    return json(400, { error: 'Send an action, turn or run.' });
  } catch (err) {
    console.error('[volt-chat] error', err);
    return json(500, { error: err.message || 'The desk hit an error.' });
  }
};
