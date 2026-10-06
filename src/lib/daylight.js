// src/lib/daylight.js
// SENTINEL: NB_DAYLIGHT_V1
//
// ── WHAT DAYLIGHT IS, AND WHY IT IS NOT THE CALENDAR ────────────────────────
//
// Tyler, 2026-10-05: "I can fill in my available and unavailable times, or what
// I'm doing that week ... it always shows up to 3 weeks ahead, and stuff starts
// to fill in, so it's an evolving calendar as the stuff pops up ... the client
// side always only shares their availability."
//
// THE CALENDAR AND DAYLIGHT ARE TWO DIFFERENT QUESTIONS AND THAT IS THE WHOLE
// DESIGN. src/pages/Calendar is appointments: a thing that is booked, with a
// time, a title and an invite. Daylight is the shape of the next three weeks
// before anything is booked. One is the record, the other is the offer.
//
// They meet in exactly one place. A client's offer, when Tyler takes it, is
// written into the SAME appointments table by the SAME modal the calendar
// already uses. Daylight never writes an appointment of its own and never
// invents a second notion of what a meeting is. If that ever changes, the two
// pages will drift and a client will see one thing while the studio sees
// another, which is the failure this note exists to prevent.
//
// ── THE THREE MEETING TYPES ARE NOT DEFINED HERE ────────────────────────────
//
// Call, video and in person already live in src/pages/Calendar/calendarConstants
// with their hues and, which is the part Tyler asked for by name, a `hint`
// string each. That hint is the little helper that shows on hover. Daylight
// imports them. DO NOT restate a type, a hue or a hint in this file. The house
// rule is that a component reads from the source and never repeats it, and this
// is the fourth place in the two repos where repeating a roster caused a drift.
//
// ── THE THREE STATES, AND WHY THESE WORDS ───────────────────────────────────
//
// A day is open, tight or gone. They are what somebody would actually say out
// loud about a week, which is the voice the whole studio is written in. An
// unmarked day is not a fourth state, it is simply a day nobody has spoken for
// yet, and it reads as quiet rather than as available. That matters: a client
// looking at an empty three weeks should not read it as "he is free", they
// should read it as "he has not said". Saying nothing is not a promise.
//
// ── WHY THE CLIENT SIDE NEVER TOUCHES SUPABASE ──────────────────────────────
//
// The shared link is public by design, so the page behind it has no session.
// Everything it needs comes through netlify/functions/daylight-public.js, which
// holds the service key and answers only what a token is entitled to.
//
// That is not what makes it safe, though, and the distinction matters. The page
// mounts in the same bundle as the rest of Pulse, so the anon key is in it
// regardless. What makes it safe is that the three daylight tables grant the
// anon role nothing at all, verified on the live database. There is a
// documented case in this org of public tables answering to any anon token and
// a key being hard to reach was never the thing that would have stopped it.
//
// No oxford commas, no em dashes.

import { MEETING_TYPES, TYPE_BY_ID, typeOf, ymd } from '../pages/Calendar/calendarConstants';

export { MEETING_TYPES, TYPE_BY_ID, typeOf, ymd };

// ── HOW FAR AHEAD ───────────────────────────────────────────────────────────
// Three weeks, Tyler's number, said twice. Twenty one days starting today and
// not twenty one days starting Sunday: the board is about what is coming, so
// it begins where the reader is standing. The week rows below are built off
// this and nothing else sets a length.
export const HORIZON_DAYS = 21;

// ── A DAY IS OPEN UNTIL SOMETHING IS IN IT ──────────────────────────────────
//
// Tyler, 2026-10-05: "We don't need to say tight and open. I think we just
// subtly have some colors and greens ... I don't like the word not said."
//
// There are no day states any more and there is no fourth quiet state either.
// A day is open. What gets stored is the hours that are TAKEN and what is
// happening in them, and everything a screen says about a day is derived from
// those blocks. That is also how a person actually thinks about a week: not
// "Tuesday is tight" but "Tuesday I am shooting from twelve to four".
//
// An earlier version had open, tight and gone as words on every cell. It read
// like a form. Colour carries it now and the words are gone.

// The hours anybody is actually offered. Blocks outside it are kept and drawn,
// they just do not count toward how full a day looks, so a 6am gym block does
// not make a wide open day read as busy.
export const DAY_START = 8 * 60;
export const DAY_END = 18 * 60;
export const DAY_SPAN = DAY_END - DAY_START;

// ── THE GREENS ──────────────────────────────────────────────────────────────
// Tyler called the scheme "electrifying light nature". So: one living green
// that gets deeper as a day fills, on the warm paper Pulse already uses. Never
// white, which he ruled out, and never a red for a full day. A full day is not
// an error, it is just a day with things in it.
export const GREEN = {
  free:  '#D8E8C8',   // the lightest, a day with nothing in it
  some:  '#A9CE82',   // something in it
  most:  '#6F9E4C',   // more of it gone than not
  full:  '#3E6B33',   // nothing left in the working hours
  ink:   '#24391C',   // text that sits on the deeper greens
  edge:  '#2F5428',   // the block fill on a timeline
};

// How much of the working day is taken, 0 to 1. Overlaps are merged first so
// two blocks over the same hour do not count that hour twice.
export const mergeBlocks = (blocks) => {
  const clipped = (blocks || [])
    .map((b) => [Math.max(b.start_min, DAY_START), Math.min(b.end_min, DAY_END)])
    .filter(([a, z]) => z > a)
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, z] of clipped) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], z);
    else out.push([a, z]);
  }
  return out;
};

export const fullness = (blocks) => {
  const taken = mergeBlocks(blocks).reduce((n, [a, z]) => n + (z - a), 0);
  return Math.min(1, taken / DAY_SPAN);
};

// The one place a day turns into a colour. Four steps and not a gradient,
// because a continuous ramp makes twenty one days read as noise.
export const dayGreen = (blocks) => {
  const f = fullness(blocks);
  if (f === 0) return GREEN.free;
  if (f < 0.34) return GREEN.some;
  if (f < 0.85) return GREEN.most;
  return GREEN.full;
};

// Text has to stay readable as the ground darkens.
export const onGreen = (blocks) => (fullness(blocks) < 0.34 ? GREEN.ink : '#F4F7EF');

// A day with no room left cannot be offered on. Derived, never stored.
export const isFull = (blocks) => fullness(blocks) >= 0.995;

// What is left, as ranges, which is what a client is actually choosing from.
export const freeRanges = (blocks) => {
  const taken = mergeBlocks(blocks);
  const out = [];
  let cursor = DAY_START;
  for (const [a, z] of taken) {
    if (a > cursor) out.push([cursor, a]);
    cursor = Math.max(cursor, z);
  }
  if (cursor < DAY_END) out.push([cursor, DAY_END]);
  return out;
};

export const isFree = (blocks, min, minutes = 30) =>
  freeRanges(blocks).some(([a, z]) => min >= a && min + minutes <= z);

// ── THE BOARD ───────────────────────────────────────────────────────────────
// Twenty one days as three rows of seven, each row starting on the day of the
// week the horizon started on. NOT calendar weeks: a Sunday aligned grid would
// need leading blanks and would put today in the middle of the first row, and
// the question this page answers is "what do the next three weeks look like
// from here" and not "what does October look like".
export const buildBoard = (from = new Date()) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const rows = [];
  const cursor = new Date(start);
  for (let w = 0; w < HORIZON_DAYS / 7; w += 1) {
    const row = [];
    for (let d = 0; d < 7; d += 1) {
      row.push({
        date: new Date(cursor),
        iso: ymd(cursor),
        isToday: cursor.getTime() === start.getTime(),
        isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(row);
  }
  return rows;
};

// ── TIME OF DAY ─────────────────────────────────────────────────────────────
// Offers are minutes from local midnight, an integer, because a client picking
// "2:00 PM on the 14th" means two in the afternoon where the meeting happens
// and not an instant on a timeline. The absolute instant is resolved once, when
// Tyler takes the offer and the calendar's own combineLocal turns it into an
// appointment. Storing an instant here would mean deciding whose zone it was in
// before anybody had agreed to meet, which is the off-by-an-hour bug the
// calendar's header already warns about.
export const SLOT_MINUTES = [
  8 * 60, 9 * 60, 10 * 60, 11 * 60, 12 * 60,
  13 * 60, 14 * 60, 15 * 60, 16 * 60, 17 * 60,
];

export const fmtMinutes = (m) => {
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ampm}`;
};

// "HH:MM" for the calendar's combineLocal, which is the one parser allowed to
// turn a wall clock into an instant.
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayLabel = (d) => `${DAY_SHORT[d.getDay()]} ${d.getDate()}`;
export const longDay = (d) => `${DAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
