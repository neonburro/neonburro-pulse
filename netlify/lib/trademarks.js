// netlify/lib/trademarks.js
// SENTINEL: NB_PULSE_TRADEMARKS_CORE_V2
//
// The trademark watch, everything but the doors. netlify/functions/
// trademark-watch.js is the door a person uses and
// netlify/functions/trademark-watch-scheduled.js is the door the night uses.
// Both read and write through this file and nothing else, so the shape of a
// list, the way the register is read and the way a change is written down
// exist once.
//
// ── WHY THIS FILE IS NOT IN netlify/functions ───────────────────────────────
// Netlify deploys every js file in the functions folder as a function, a
// leading underscore does not hide it. Aster proved it on 2026-09-28, four
// shared modules there answer 502 on the live site. A module that lives here
// is bundled into the two functions that import it and is never a door.
//
// ── THE STORE ───────────────────────────────────────────────────────────────
// Netlify Blobs on the Pulse site, store studio-trademarks. One blob per list.
//   words              the studio's own list, the key v1 used, kept so the
//                      words seeded on 2026-10-05 are the studio list today
//   client/<uuid>      one client's list, opened by the studio, never by
//                      the client
// v1 wrote a bare array. v2 writes { v, owner, entries, reads, probes }.
// normalize() reads both, so the first v2 write upgrades the studio list in
// place and nothing has to be migrated by hand.
//
// NO WORD IS EVER WRITTEN IN THIS REPO. neonburro-pulse is public on GitHub
// and a list of names somebody means to file is exactly what a squatter
// would race to file first. Words live in the store and nowhere else, and the
// functions log counts, never words.
//
// ── TWO HANDS, ONE BLOB ─────────────────────────────────────────────────────
// The night run and a person can write the same list in the same minute. A
// plain read then write would let one quietly undo the other, the same shape
// as the jsonb PATCH that replaced instead of merging in September. So every
// write goes through mutate(), which reads with an etag, applies a change to
// the fresh copy and writes with onlyIfMatch, and tries again when somebody
// got there first. The slow part, the register read, happens BEFORE mutate
// and only its result is applied inside, so a retry never reads the office
// twice. Reads are strong, which is why both functions use the modern
// function signature. connectLambda cannot give a strong read.
//
// ── THE REGISTER ────────────────────────────────────────────────────────────
// tmsearch.uspto.gov posts an Elasticsearch body to prod-stage-v1-0-0/
// tmsearch and answers a plain server request. Read off the page's own
// request by Ion and Aster on 2026-10-05. Each record carries statusCode and
// statusDescription, registrationDate, affidavit and the dates of death, so
// a status change and the maintenance clock can both be read from the index
// alone, without TSDR. Two reads a word, the same as v1:
//   exact   WM phrase and match plus the PM pseudo mark, every status. A hit
//           counts only when its wordmark, flattened to letters and digits,
//           equals the word.
//   close   a fuzzy WM match, live marks only. A made up spelling of a common
//           word meets the common word at examination, so this is where a
//           filing would actually be refused.
// A probe, used for suggestions, is the exact read alone.
//
// ── TSDR ────────────────────────────────────────────────────────────────────
// tsdr.uspto.gov/statusview/sn{serial} is the HTML the TSDR page loads. It
// holds what the index does not, the status date, the notice of allowance
// date and the prosecution history, which is how an unanswered office action
// or an intent to use clock is found. It answers 503 with a hidden
// statusServerError line when a serial does not exist or the office is down.
// TSDR's own FAQ says its APIs need a registered key since 2020-10-02, at 60
// requests a minute, and on 2026-10-05 it answered 403 to the second of four
// reads sent 350ms apart and 200 to one read a minute later. So TSDR is read
// one mark a call, only when a PERSON opens a word or a mark, at most four
// marks a word, a few seconds apart, and cached on the mark for a day, the
// way a person clicking through would read it. The night run never touches
// TSDR.
// If the studio ever wants TSDR on a schedule, register a key first.
// Attorney emails and phones on that page are never kept.
//
// ── THE OFFICE'S TERMS, READ 2026-10-05 ─────────────────────────────────────
// uspto.gov terms of use: anybody "generating unusually high numbers of
// database accesses ... whether generated manually or in an automated
// fashion, may be denied access ... without notice", and bulk users are sent
// to the bulk data products. This watch is the opposite of bulk. A word is
// two requests, and the night run reads at most nine words every twenty
// minutes between 03:00 and 08:59 UTC, which is after ten at night and
// before five in the morning on the east coast in either season. A person's
// reads are capped per list by the ceilings below.
//
// ── THE CEILINGS ────────────────────────────────────────────────────────────
// The house rule says every surface where a person can make the studio spend
// carries a session, a day and a lifetime ceiling. Nothing here calls a model
// or a paid API, so the two percent arithmetic in
// neonburro/docs/02-engineering/interaction-ceilings.md comes to zero. What is
// scarce is the office's patience, so the three ceilings count requests to
// the office caused by a person on one list. The day and the lifetime are
// kept on the list blob and enforced here. The session is counted by the
// page, which is the only place a session exists. The night run is bounded
// by its own pace and does not count against a person.
//
// ── THE DATES THAT MATTER, 15 USC 1058 AND 1059 ─────────────────────────────
//   section 8     between year 5 and year 6 after registration, then a six
//                 month grace. Nothing filed and the office cancels it.
//   renewal       section 8 and 9 together in the year before every tenth
//                 anniversary, then a six month grace.
//   use           an intent to use filing with a notice of allowance must
//                 show use within six months, extendable in six month steps
//                 to thirty six months from the notice.
//   answer        an office action allows three months to answer, three more
//                 with the extension fee. Unanswered and it is abandoned.
//   revival       an abandoned filing can be revived on petition, two months
//                 from the notice of abandonment.
// A registration from before 1989-11-16 ran a twenty year term, so its clock
// is not worked out here and the page sends a person to TSDR for it.
// A registration that misses its filing is cancelled weeks or months after
// the grace ends, never on the day. And a dead filing does not end rights a
// business holds by USING the name, so the page never says a word is safe,
// only that the federal register shows it free.
//
// No oxford commas, no em dashes.

export const STORE = 'studio-trademarks';
export const STUDIO_KEY = 'words';
export const CLIENT_PREFIX = 'client/';
export const clientKey = (id) => `${CLIENT_PREFIX}${id}`;
export const keyFor = (owner) => (owner === 'studio' ? STUDIO_KEY : clientKey(owner));
export const ownerOf = (key) => (key === STUDIO_KEY ? 'studio' : key.slice(CLIENT_PREFIX.length));
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Days between scheduled reads. Monthly is thirty days and not the calendar
// month, so a word set on the 31st never skips February.
export const CADENCES = { off: 0, daily: 1, weekly: 7, biweekly: 14, monthly: 30 };

// Requests to the office a person may cause on one list. The page reads
// session from the list answer, so the numbers live here and only here.
export const LIMITS = {
  studio: { words: 300, session: 300, day: 600, life: 100000 },
  client: { words: 25, session: 60, day: 80, life: 4000 },
};

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One lowercase word, letters and digits, Tyler's rule.
export const cleanWord = (raw) => String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const flat = cleanWord;

export const isoDay = (when = Date.now()) => new Date(when).toISOString().slice(0, 10);

export const addMonths = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};
export const addYears = (iso, n) => addMonths(iso, n * 12);

export const say = (iso) => (iso
  ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  : '');

// ── the register ────────────────────────────────────────────────────────────

const SEARCH = 'https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch';
const TSDR_PAGE = (serial) => `https://tsdr.uspto.gov/#caseNumber=${serial}&caseType=SERIAL_NO&searchType=statusSearch`;
const TSDR_HTML = (serial) => `https://tsdr.uspto.gov/statusview/sn${serial}`;
const FIELDS = [
  'alive', 'abandonDate', 'cancelDate', 'filedDate', 'internationalClass', 'ownerName',
  'registrationDate', 'registrationId', 'wordmark', 'currentBasis', 'statusCode',
  'statusDescription', 'affidavit', 'renewalDate',
];

const statusOf = (s) => {
  if (s.alive) return s.registrationId ? 'registered' : 'pending';
  if (s.cancelDate) return 'cancelled';
  if (s.abandonDate) return 'abandoned';
  if (/EXPIRED/i.test(s.statusDescription || '')) return 'expired';
  return 'dead';
};

const day10 = (v) => (v ? String(v).slice(0, 10) : null);

const shape = (hit) => {
  const s = hit.source || {};
  return {
    serial: hit.id,
    mark: s.wordmark || '',
    alive: !!s.alive,
    status: statusOf(s),
    statusCode: s.statusCode || null,
    statusText: String(s.statusDescription || '').trim(),
    owner: String((s.ownerName || [])[0] || '').split(' (')[0],
    classes: (s.internationalClass || [])
      .filter((c) => !/CANCELLED|DELETED/i.test(c))
      .map((c) => c.replace(/^IC\s*/i, '').replace(/\.$/, '')),
    basis: (s.currentBasis || []).map((b) => String(b).toLowerCase()),
    affidavit: s.affidavit || [],
    filed: day10(s.filedDate),
    registered: day10(s.registrationDate),
    renewed: day10(s.renewalDate),
    abandoned: day10(s.abandonDate),
    cancelled: day10(s.cancelDate),
    link: TSDR_PAGE(hit.id),
  };
};

const ask = async (body) => {
  const res = await fetch(SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`the register answered ${res.status}`);
  const data = await res.json();
  if (!data?.hits) throw new Error('the register sent something unexpected');
  return data.hits;
};

const exactQuery = (word) => ({
  query: { bool: { must: [{ bool: { should: [
    { match_phrase: { WM: { query: word, boost: 5 } } },
    { match: { WM: { query: word, boost: 2 } } },
    { match_phrase: { PM: { query: word, boost: 2 } } },
  ] } }] } },
  size: 100, from: 0, track_total_hits: true, _source: FIELDS,
});

const closeQuery = (word) => ({
  query: { bool: {
    must: [{ fuzzy: { WM: { value: word, fuzziness: 'AUTO', max_expansions: 30 } } }],
    filter: [{ term: { LD: 'true' } }],
  } },
  size: 30, track_total_hits: true, _source: FIELDS,
});

const verdictOf = (exact) => (exact.some((m) => m.alive) ? 'taken' : exact.length ? 'dead' : 'clear');

// Live marks first, then the newest. Forty is plenty, a word with more exact
// filings than that is not a word anybody here should file.
const order = (marks) => [...marks]
  .sort((a, b) => (Number(b.alive) - Number(a.alive)) || String(b.filed || '').localeCompare(String(a.filed || '')))
  .slice(0, 40);

// Two requests. Returns what applyRead() writes onto an entry.
export const readRegister = async (word) => {
  const [exactHits, closeHits] = await Promise.all([ask(exactQuery(word)), ask(closeQuery(word))]);
  const shaped = (exactHits.hits || []).map(shape);
  const exact = order(shaped.filter((m) => flat(m.mark) === word));
  // Close is two kinds of live mark. The ones that CONTAIN the word, which
  // the exact read already returned and which an examiner weighs first, and
  // the fuzzy spellings. The fuzzy read alone came back empty for a word with
  // many exact filings, its top thirty were all the word itself.
  const containing = shaped.filter((m) => m.alive && flat(m.mark) !== word).slice(0, 4);
  const fuzzy = (closeHits.hits || []).map(shape).filter((m) => flat(m.mark) !== word);
  const close = [...new Map([...containing, ...fuzzy].map((m) => [m.serial, m])).values()].slice(0, 8);
  return {
    verdict: verdictOf(exact),
    exact,
    close,
    closeTotal: Math.max(0, (closeHits.totalValue || 0) - exact.filter((m) => m.alive).length),
    readAt: new Date().toISOString(),
  };
};

// One request. The exact read alone, for a suggestion nobody watches yet.
export const probeRegister = async (word) => {
  const hits = await ask(exactQuery(word));
  const exact = (hits.hits || []).map(shape).filter((m) => flat(m.mark) === word);
  const live = exact.filter((m) => m.alive);
  return {
    verdict: verdictOf(exact),
    holder: live[0]?.owner || '',
    live: live.length,
    dead: exact.length - live.length,
    at: new Date().toISOString(),
  };
};

// ── TSDR ────────────────────────────────────────────────────────────────────

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const tsdrDay = (value) => {
  const m = /([A-Za-z]{3,4})\.?\s+(\d{1,2}),\s+(\d{4})/.exec(value || '');
  if (!m || !MONTHS[m[1].toLowerCase()]) return null;
  return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
};
const unhtml = (s) => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

export const parseTsdr = (html) => {
  const pairs = {};
  const pairRe = /<div class="key"[^>]*>\s*([^<]*?)\s*<\/div>\s*<div class="value[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = pairRe.exec(html))) {
    const key = m[1].replace(/:$/, '').trim();
    if (!key) continue;
    (pairs[key] = pairs[key] || []).push(unhtml(m[2]));
  }
  const one = (key) => (pairs[key] || [])[0] || '';
  const tm5 = /TM5 Common Status Descriptor[\s\S]*?<p[^>]*>\s*([\s\S]*?)\s*<\/p>\s*<p[^>]*>\s*([\s\S]*?)\s*<\/p>/.exec(html);

  const history = [];
  const at = html.indexOf('data-sectionTitle="Prosecution History"');
  if (at !== -1) {
    const end = html.indexOf('expand_wrapper', at + 40);
    const slice = html.slice(at, end === -1 ? undefined : end);
    const rowRe = /<tr[^>]*>\s*<td valign="top">\s*([\s\S]*?)<\/td>\s*<td valign="top">\s*([\s\S]*?)<\/td>/g;
    let r;
    while ((r = rowRe.exec(slice)) && history.length < 40) {
      const date = tsdrDay(unhtml(r[1]));
      if (date) history.push({ date, what: unhtml(r[2]) });
    }
  }

  return {
    readAt: new Date().toISOString(),
    statusText: one('Status'),
    statusDate: tsdrDay(one('Status Date')),
    tm5: tm5 ? { label: unhtml(tm5[1]), say: unhtml(tm5[2]) } : null,
    filed: tsdrDay(one('Application Filing Date')),
    registered: tsdrDay(one('Registration Date')),
    published: tsdrDay(one('Publication Date')),
    allowed: tsdrDay(one('Notice of Allowance Date')),
    abandoned: tsdrDay(one('Abandonment Date')),
    cancelled: tsdrDay(one('Cancellation Date')),
    owner: one('Owner Name') || one('Registrant'),
    classes: (pairs['International Class(es)'] || []).map((c) => c.replace(/\s*-\s*Primary Class/i, '')),
    classStatus: pairs['Class Status'] || [],
    use: one('Currently Use') === 'Yes',
    itu: one('Currently ITU') === 'Yes',
    madrid: one('Currently 66A') === 'Yes',
    history,
  };
};

export const readTsdr = async (serial) => {
  if (!/^\d{8}$/.test(String(serial))) throw new Error('A serial is eight digits.');
  const res = await fetch(TSDR_HTML(serial), {
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  });
  const html = await res.text();
  const said = /id="statusServerError" value="([^"]*)"/.exec(html)?.[1]?.trim();
  if (!res.ok || said) throw new Error(said ? `TSDR said ${said.replace(/\s+/g, ' ')}` : `TSDR answered ${res.status}`);
  const facts = parseTsdr(html);
  // The history is the long part. Twenty rows reach back past any clock this
  // file reads and keep the blob small.
  return { ...facts, history: facts.history.slice(0, 20) };
};

export const FACTS_FRESH_MS = DAY;
export const factsStale = (mark, now = Date.now()) => !mark.facts || now - Date.parse(mark.facts.readAt) > FACTS_FRESH_MS;

// ── the dates that matter ───────────────────────────────────────────────────
//
// Each moment is { kind, serial, mark, owner, date, tone, say }. date is the
// one that decides it, and the one a page sorts by.
//   free    the owner has missed something and the mark could come free
//   look    a date somebody set to look again
//   watch   a clock is running that decides whether it stays
//   soon    a window that opens later, worth knowing
//   kept    the owner did what keeps it alive
//   gone    dead, and why

const statusWords = (m) => `${m.facts?.statusText || ''} ${m.statusText || ''}`.toUpperCase();
const hist = (m) => m.facts?.history || [];
const TEN_YEAR_TERM = '1989-11-16';

const sec8Kept = (m) => {
  const t = statusWords(m);
  if (/RENEWED/.test(t)) return true;
  if (/(SECTION|SEC\.) ?(8|71)\b/.test(t) && /ACCEPT/.test(t)) return true;
  if ((m.affidavit || []).some((a) => /SECTION ?(8|71)/i.test(a))) return true;
  return hist(m).some((h) => /(SEC\.|SECTION) ?(8|71)\b.*ACCEPTED/i.test(h.what));
};

const renewalKept = (m, opens) => hist(m).some((h) => h.date >= opens && /RENEWED|SEC\. 9|SECTION 9/i.test(h.what) && !/REMINDER/i.test(h.what))
  || (/RENEWED/.test(statusWords(m)) && (m.facts?.statusDate || '') >= opens);

const maintenance = (m, today) => {
  const out = [];
  const reg = m.registered || m.facts?.registered;
  if (!reg) return out;
  const base = { serial: m.serial, mark: m.mark, owner: m.owner };
  if (reg < TEN_YEAR_TERM) {
    return [{ ...base, kind: 'renew', tone: 'soon', date: null, say: `Registered ${say(reg)}, under the old twenty year term, so its renewal clock is on TSDR rather than worked out here.` }];
  }
  const madrid = m.facts?.madrid || (m.basis || []).includes('66a');

  // Year six.
  const opens8 = addYears(reg, 5);
  const closes8 = addYears(reg, 6);
  const grace8 = addMonths(closes8, 6);
  const tenth = addYears(reg, 10);
  if (today < addMonths(tenth, -12)) {
    if (sec8Kept(m)) {
      if (today >= opens8) out.push({ ...base, kind: 'sec8', tone: 'kept', date: closes8, say: 'Its year six declaration is on the record, so it stays alive.' });
    } else if (today < opens8) {
      if (addYears(today, 2) >= opens8) out.push({ ...base, kind: 'sec8', tone: 'soon', date: opens8, say: `Its first maintenance window opens ${say(opens8)} and closes ${say(closes8)}.` });
    } else if (today <= closes8) {
      out.push({ ...base, kind: 'sec8', tone: 'watch', date: closes8, say: `The owner has until ${say(closes8)} to file the ${madrid ? 'section 71' : 'section 8'} declaration that keeps it alive, then a six month grace to ${say(grace8)}. Most owners file.` });
    } else if (today <= grace8) {
      out.push({ ...base, kind: 'sec8', tone: 'free', date: grace8, say: `The year six deadline passed on ${say(closes8)} with nothing on the record we can see. The owner can still file in grace until ${say(grace8)}. If they do not, the office cancels it.` });
    } else {
      out.push({ ...base, kind: 'sec8', tone: 'free', date: grace8, say: `The grace ended ${say(grace8)} and the record we can see shows no year six filing. The office cancels a registration like this, often weeks or months later. Worth a look again date.` });
    }
  }

  // Every tenth anniversary. The next one whose grace has not ended.
  let n = 1;
  while (addMonths(addYears(reg, 10 * n), 6) < today) n += 1;
  const anniversary = addYears(reg, 10 * n);
  const opens = addYears(reg, 10 * n - 1);
  const grace = addMonths(anniversary, 6);
  const where = madrid ? ' Renewal of an international registration runs through WIPO, so the US record may not show it.' : '';
  if (today < opens) {
    if (addYears(today, 2) >= opens) out.push({ ...base, kind: 'renew', tone: 'soon', date: anniversary, say: `Renewal is due by ${say(anniversary)}, the window opens ${say(opens)}.${where}` });
  } else if (renewalKept(m, opens)) {
    out.push({ ...base, kind: 'renew', tone: 'kept', date: anniversary, say: `Renewed for the ten years to ${say(addYears(anniversary, 10))}.` });
  } else if (today <= anniversary) {
    out.push({ ...base, kind: 'renew', tone: 'watch', date: anniversary, say: `Renewal is due by ${say(anniversary)}, then a six month grace to ${say(grace)}.${where}` });
  } else {
    out.push({ ...base, kind: 'renew', tone: 'free', date: grace, say: `The renewal date passed on ${say(anniversary)} with no renewal on the record we can see. The grace runs to ${say(grace)}, then the registration expires.${where}` });
  }
  return out;
};

const ANSWERED = /RESPONSE|REQUEST FOR RECONSIDERATION|APPEAL|AMENDMENT|APPROVED FOR PUB|PUBLISHED|ALLOWANCE/i;
const ACTION = /NON-FINAL ACTION (E-)?MAILED|FINAL REFUSAL (E-)?MAILED/i;

const pending = (m, today) => {
  const out = [];
  const base = { serial: m.serial, mark: m.mark, owner: m.owner };
  const allowed = m.facts?.allowed;
  const t = statusWords(m);

  if (allowed && !/STATEMENT OF USE.*(ACCEPT|RECEIVED|PROCESSING)|SOU.*(ACCEPT|RECEIVED)/.test(t)) {
    const due = addMonths(allowed, 6);
    const last = addMonths(allowed, 36);
    if (today <= last) {
      out.push({ ...base, kind: 'use', tone: 'watch', date: today <= due ? due : last, say: `Allowed on ${say(allowed)}. The owner has to show use by ${say(due)} and can buy six month extensions up to ${say(last)}. No use by then and it is abandoned.` });
    } else {
      out.push({ ...base, kind: 'use', tone: 'free', date: last, say: `The last possible date to show use, ${say(last)}, has passed. The office abandons an application like this.` });
    }
  } else if (!m.facts && /ALLOWANCE/.test(t)) {
    out.push({ ...base, kind: 'use', tone: 'soon', date: null, say: 'Allowed and waiting on proof of use. Open it to read the clock from TSDR.' });
  }

  const h = hist(m);
  const at = h.findIndex((row) => ACTION.test(row.what));
  if (at !== -1 && !h.slice(0, at).some((row) => ANSWERED.test(row.what))) {
    const sent = h[at].date;
    const due = addMonths(sent, 3);
    const extended = addMonths(sent, 6);
    if (today <= extended) {
      out.push({ ...base, kind: 'answer', tone: 'watch', date: today <= due ? due : extended, say: `The examiner wrote on ${say(sent)}. The owner has until ${say(due)} to answer, or ${say(extended)} with the extension. Unanswered and it is abandoned.` });
    } else {
      out.push({ ...base, kind: 'answer', tone: 'free', date: extended, say: `The time to answer the examiner ran out on ${say(extended)} with no answer on the record we can see. Watch for abandonment.` });
    }
  }
  return out;
};

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const dead = (m, today) => {
  const base = { serial: m.serial, mark: m.mark, owner: m.owner };
  const abandoned = m.abandoned || m.facts?.abandoned;
  const cancelled = m.cancelled || m.facts?.cancelled;
  if (abandoned) {
    const revive = addMonths(abandoned, 2);
    if (today <= revive) {
      return [{ ...base, kind: 'revive', tone: 'watch', date: revive, say: `Abandoned on ${say(abandoned)}. The owner can petition to revive it until about ${say(revive)}.` }];
    }
    return [{ ...base, kind: 'gone', tone: 'gone', date: abandoned, say: `Abandoned on ${say(abandoned)}, past the two month revival window.` }];
  }
  if (cancelled) return [{ ...base, kind: 'gone', tone: 'gone', date: cancelled, say: `Cancelled on ${say(cancelled)}.` }];
  return [{ ...base, kind: 'gone', tone: 'gone', date: null, say: `${m.statusText ? capital(m.statusText.toLowerCase()) : 'Dead'}.` }];
};

export const momentsFor = (m, today = isoDay()) => {
  if (!m.alive) return dead(m, today);
  if (m.status === 'registered') return maintenance(m, today);
  return pending(m, today);
};

const TONE_RANK = { free: 0, look: 1, watch: 2, soon: 3, kept: 4, gone: 5 };

// ── an entry, read for a page ───────────────────────────────────────────────

const ENTRY = {
  note: '', addedAt: null, addedBy: '', cadence: 'off', lookAgain: null,
  checkedAt: null, checkedBy: '', verdict: null, exact: [], close: [], closeTotal: 0,
  error: null, failedAt: null, changes: [], seen: [],
};

export const normalize = (raw, owner) => {
  if (raw === null || raw === undefined) return null;
  const doc = Array.isArray(raw) ? { entries: raw } : { ...raw };
  return {
    v: 2,
    owner,
    openedAt: doc.openedAt || null,
    openedBy: doc.openedBy || '',
    reads: { day: doc.reads?.day || '', count: doc.reads?.count || 0, life: doc.reads?.life || 0 },
    probes: doc.probes || {},
    entries: (doc.entries || []).map((e) => ({ ...ENTRY, ...e })),
  };
};

export const emptyList = (owner, by) => ({
  v: 2, owner, openedAt: new Date().toISOString(), openedBy: by || '', reads: { day: '', count: 0, life: 0 }, probes: {}, entries: [],
});

export const nextReadOn = (entry) => {
  const days = CADENCES[entry.cadence] || 0;
  if (!days) return null;
  if (!entry.checkedAt) return isoDay();
  return isoDay(Date.parse(entry.checkedAt) + days * DAY);
};

const registerLine = (entry) => {
  if (!entry.checkedAt) return 'not read yet';
  const live = entry.exact.filter((m) => m.alive);
  if (live.length) return `${live[0].owner || 'an owner not listed'}${live.length > 1 ? ` and ${live.length - 1} more` : ''}`;
  if (entry.exact.length) return `${entry.exact.length} lapsed ${entry.exact.length === 1 ? 'filing' : 'filings'}`;
  return 'nothing with this word';
};

export const decorate = (entry, today = isoDay()) => {
  const exact = entry.exact.map((m) => ({ ...m, moments: momentsFor(m, today) }));
  const close = entry.close.map((m) => ({ ...m, moments: momentsFor(m, today) }));
  const moments = exact.flatMap((m) => m.moments);
  if (entry.lookAgain) {
    moments.push({
      kind: 'look',
      tone: 'look',
      date: entry.lookAgain,
      say: entry.lookAgain <= today ? 'The look again date you set has come. The next night read takes it.' : 'A date you set to look again.',
    });
  }
  moments.sort((a, b) => (TONE_RANK[a.tone] - TONE_RANK[b.tone]) || String(a.date || '9').localeCompare(String(b.date || '9')));
  const { seen, ...rest } = entry;
  return {
    ...rest,
    exact,
    close,
    moments,
    chance: moments.some((x) => x.tone === 'free') ? 'free' : null,
    nextRead: nextReadOn(entry),
    register: registerLine(entry),
  };
};

// ── what changed between two reads ──────────────────────────────────────────

const label = (m) => `${m.mark || m.serial}${m.owner ? ` by ${m.owner}` : ''}`;
const lower = (m) => (m.statusText || m.status || '').toLowerCase();
const VERDICT_WORD = { clear: 'clear', dead: 'dead marks only', taken: 'taken' };

export const diffRead = (entry, read) => {
  const out = [];
  if (entry.verdict && entry.verdict !== read.verdict) {
    out.push({ kind: 'verdict', from: entry.verdict, to: read.verdict, say: `Went from ${VERDICT_WORD[entry.verdict]} to ${VERDICT_WORD[read.verdict]}.` });
  }
  const before = new Map(entry.exact.map((m) => [m.serial, m]));
  for (const m of read.exact) {
    const old = before.get(m.serial);
    if (!old) {
      out.push({ kind: 'filed', serial: m.serial, say: `A new filing for this exact word, ${label(m)}${m.filed ? `, filed ${say(m.filed)}` : ''}.` });
    } else if (old.alive && !m.alive) {
      out.push({ kind: 'dead', serial: m.serial, say: `${label(m)} went dead, ${lower(m)}.` });
    } else if (!old.alive && m.alive) {
      out.push({ kind: 'revived', serial: m.serial, say: `${label(m)} came back to life, ${lower(m)}.` });
    } else if (old.statusText && m.statusText ? old.statusText !== m.statusText : old.status !== m.status) {
      out.push({ kind: 'status', serial: m.serial, from: old.statusText, to: m.statusText, say: `${label(m)} moved from ${lower(old)} to ${lower(m)}.` });
    }
  }
  // The close list is a ranked top eight, so a mark falling out of it says
  // nothing. A new close spelling counts only if it was filed recently and
  // has never been seen, otherwise re-ranking would read as news.
  const seen = new Set(entry.seen || []);
  const recent = isoDay(Date.now() - 120 * DAY);
  for (const m of read.close) {
    if (!seen.has(m.serial) && m.filed && m.filed >= recent) {
      out.push({ kind: 'close', serial: m.serial, say: `A close spelling was filed, ${label(m)} on ${say(m.filed)}.` });
    }
  }
  return out;
};

const firstLine = (read) => {
  if (read.verdict === 'clear') return 'First read. Nothing on the register with this word.';
  if (read.verdict === 'dead') return `First read. Only lapsed filings, ${read.exact.length} of them.`;
  const live = read.exact.filter((m) => m.alive);
  return `First read. ${live.length} live ${live.length === 1 ? 'filing holds' : 'filings hold'} this word.`;
};

// Writes a read onto an entry in place. by is person or schedule. TSDR facts
// already read for a mark ride across to the new read, so a night run never
// throws away what a person opened.
export const applyRead = (entry, read, by) => {
  const at = read.readAt;
  const changes = entry.checkedAt ? diffRead(entry, read) : [{ kind: 'first', say: firstLine(read) }];
  const facts = new Map([...entry.exact, ...entry.close].filter((m) => m.facts).map((m) => [m.serial, m.facts]));
  const carry = (m) => (facts.has(m.serial) ? { ...m, facts: facts.get(m.serial) } : m);
  entry.verdict = read.verdict;
  entry.exact = read.exact.map(carry);
  entry.close = read.close.map(carry);
  entry.closeTotal = read.closeTotal;
  entry.checkedAt = at;
  entry.checkedBy = by;
  entry.error = null;
  entry.failedAt = null;
  entry.seen = [...new Set([...read.close.map((m) => m.serial), ...(entry.seen || [])])].slice(0, 300);
  entry.changes = [...changes.map((c) => ({ ...c, at, by })), ...(entry.changes || [])].slice(0, 80);
  return changes;
};

export const recordFailure = (entry, message) => {
  entry.error = `${capital(message)}. The last good read is kept.`;
  entry.failedAt = new Date().toISOString();
};

// ── the night ───────────────────────────────────────────────────────────────

// Why a word is due tonight, or null. A three hour slack lets a word read at
// 03:20 one night be due again at 03:00 the next. A word whose read failed
// waits six hours, so an office that is down is not asked again all night.
export const dueReason = (entry, now = Date.now()) => {
  if (entry.failedAt && now - Date.parse(entry.failedAt) < 6 * HOUR) return null;
  if (entry.lookAgain && entry.lookAgain <= isoDay(now)) return 'look';
  const days = CADENCES[entry.cadence] || 0;
  if (!days) return null;
  if (!entry.checkedAt) return 'cadence';
  return now - Date.parse(entry.checkedAt) >= days * DAY - 3 * HOUR ? 'cadence' : null;
};

// ── the ceilings ────────────────────────────────────────────────────────────

export class Ceiling extends Error {}

// Reserves n requests on a list, inside a mutate, before they are made.
export const charge = (doc, n, limits) => {
  const today = isoDay();
  if (doc.reads.day !== today) doc.reads = { ...doc.reads, day: today, count: 0 };
  if (doc.reads.life + n > limits.life) {
    throw new Ceiling('This list has used every read it is allowed. The studio can raise it.');
  }
  if (doc.reads.count + n > limits.day) {
    throw new Ceiling('That is as many reads of the register as this list gets in a day. The night reads still run.');
  }
  doc.reads.count += n;
  doc.reads.life += n;
};

// ── the store, one change at a time ─────────────────────────────────────────

export class NotOpen extends Error {}

// fn(doc) changes doc in place. Returning false means nothing changed and
// nothing is written. A missing studio list is created, a missing client
// list is an error, because only the studio opens one.
export const mutate = async (store, key, fn) => {
  const owner = ownerOf(key);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const got = await store.getWithMetadata(key, { type: 'json' });
    let doc = normalize(got?.data, owner);
    if (!doc) {
      if (owner !== 'studio') throw new NotOpen('The studio has not opened a trademark watch for this client.');
      doc = emptyList('studio', 'the store');
    }
    const result = await fn(doc);
    if (result === false) return { doc, result };
    const { modified } = await store.setJSON(key, doc, got ? { onlyIfMatch: got.etag } : { onlyIfNew: true });
    if (modified) return { doc, result };
    await pause(150 * (attempt + 1));
  }
  throw new Error('The list changed under us five times running. Try again.');
};

export const readList = async (store, key) => normalize(await store.get(key, { type: 'json' }), ownerOf(key));

// ── suggestions ─────────────────────────────────────────────────────────────
//
// Tyler's rule is one merged lowercase word, never two words, so every
// suggestion is letters only and nothing is ever spaced. The kinds are told
// apart because the office treats them differently, and the page says so.
//   coined     a made up word grown from the stem. The strongest kind of mark
//              there is, the office calls it fanciful.
//   merged     the word joined to a second word, the way neon and burro make
//              neonburro. Holds up when the second word does real work.
//   front      a short word in front.
//   sound      a sound alike. An examiner reads a sound alike as the same
//              word, so it rarely gets past a taken mark. Shown last and said.
// No model writes these. It is string work, so it costs nothing and gives the
// same answer twice, and round turns the wheel for a fresh set.

const STUDIO_PARTNERS = ['burro', 'herd', 'hoof', 'bray', 'volt', 'arc', 'wire', 'ridge', 'mesa', 'camp', 'spark', 'yard'];
const CLIENT_PARTNERS = ['yard', 'field', 'ridge', 'works', 'craft', 'house', 'post', 'camp', 'light', 'spark', 'mesa', 'line'];
const FRONTS = ['go', 'hey', 'true', 'ever', 'all', 'neo'];
const ENDINGS = ['a', 'o', 'io', 'ix', 'ora', 'ari', 'elo', 'ive', 'ent', 'umi', 'ova', 'ly'];

const stemOf = (w) => w.replace(/[aeiouy]+$/, '') || w;
// The first beat of the word, its opening vowel and up to two consonants
// after it. lantern gives lant, so a coined word reads lantora and not
// lanternora, which is shorter and fits on a shirt.
const beatOf = (w) => {
  const m = /^[^aeiouy]*[aeiouy]+[^aeiouy]{0,2}/.exec(w);
  return m && m[0].length >= 3 && m[0].length < w.length - 1 ? m[0] : null;
};
const tidy = (w) => w.replace(/(.)\1\1+/g, '$1$1');
const rotate = (list, by) => list.map((_, i) => list[(i + by) % list.length]);
const seed = (w) => [...w].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7);

const soundAlikes = (w) => {
  const out = [];
  if (/ck/.test(w)) out.push(w.replace(/ck/g, 'k'));
  if (/c(?![hk])/.test(w)) out.push(w.replace(/c(?![hk])/, 'k'));
  if (/ph/.test(w)) out.push(w.replace(/ph/g, 'f'));
  if (/s$/.test(w)) out.push(w.replace(/s$/, 'z'));
  if (/er$/.test(w)) out.push(w.replace(/er$/, 'r'));
  if (/y$/.test(w)) out.push(w.replace(/y$/, 'ie'));
  if (/i/.test(w)) out.push(w.replace(/i/, 'y'));
  return out;
};

export const suggest = (word, { owner = 'studio', round = 0, skip = [] } = {}) => {
  const w = cleanWord(word);
  if (w.length < 2) return [];
  const turn = seed(w) + round * 3;
  const stem = stemOf(w);
  const partners = rotate(owner === 'studio' ? STUDIO_PARTNERS : CLIENT_PARTNERS, turn % 12);
  const pick = [];
  const seenWords = new Set([w, ...skip]);
  const add = (cand, kind, why) => {
    const c = tidy(cleanWord(cand));
    if (c.length < 4 || c.length > 16 || /^\d+$/.test(c) || seenWords.has(c)) return;
    seenWords.add(c);
    pick.push({ word: c, kind, why });
  };
  const beat = beatOf(w);
  const endings = rotate(ENDINGS, turn % ENDINGS.length);
  for (const end of endings.slice(0, beat ? 2 : 4)) add(stem + end, 'coined', 'a coined word, the strongest kind of mark');
  if (beat) for (const end of endings.slice(2, 5)) add(beat + end, 'coined', 'a coined word, the strongest kind of mark');
  for (const p of partners.slice(0, 2)) add(w + p, 'merged', `${w} joined to ${p}`);
  for (const p of partners.slice(2, 4)) add(p + w, 'merged', `${p} joined to ${w}`);
  for (const f of rotate(FRONTS, turn % FRONTS.length).slice(0, 2)) add(f + w, 'front', `${f} in front`);
  for (const s of soundAlikes(w).slice(0, 2)) add(s, 'sound', 'a sound alike, weak against a taken word');
  return pick.slice(0, 12);
};

export const PROBE_FRESH_MS = 7 * DAY;

// Keeps the probe cache to the newest two hundred.
export const keepProbe = (doc, word, result) => {
  doc.probes[word] = result;
  const keys = Object.keys(doc.probes);
  if (keys.length > 200) {
    keys.sort((a, b) => String(doc.probes[a].at).localeCompare(String(doc.probes[b].at)));
    for (const k of keys.slice(0, keys.length - 200)) delete doc.probes[k];
  }
};
