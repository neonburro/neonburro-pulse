// netlify/functions/_client-report.js
// SENTINEL: NB_PULSE_CLIENT_REPORT_V1
//
// The monthly client report. One core, three callers, which is the whole
// reason this file exists as an underscore module rather than living inside
// a function. The underscore keeps Netlify from deploying it, the same
// convention as _letterhead.js and _social.js beside it.
//
//   client-report-preview.js   admin, renders, sends nothing, saves nothing
//   client-report-send.js      admin presses send for one client, now
//   client-report-monthly.js   scheduled, every approved client, the 1st
//
// If the preview and the send could disagree about a number or a colour then
// the preview is worthless, so all three call buildReport and renderReport
// here and neither the page nor the schedule owns a template of its own.
// This is the shape cimarron-pulse proved over six months in
// netlify/functions/lib/growth-core.cjs, which Jonathan reads every Monday.
// That checkout is another client's system and read only. The pattern is
// lifted, nothing there was touched.
//
// ── EVERY FIGURE COMES FROM A QUERY ─────────────────────────────────────────
//
// There is not one typed number below. The moment a report carries a
// client's own logo and colours it reads as coming from inside their
// company, so a wrong figure stops being our error and becomes their
// embarrassment in front of their own staff. Two rules hold that line.
//
//   1. A number that cannot be derived is LEFT OUT. Not zeroed, not
//      estimated, not filled with a dash that implies we looked. The
//      section simply does not render. Every block in renderReport is
//      guarded on having rows.
//   2. The narrative is written by RULE and never by a model. Each
//      sentence restates a figure printed beside it, so a reader can check
//      it. No model is called anywhere in this file, which is also why the
//      three interaction ceilings in
//      neonburro/docs/02-engineering/interaction-ceilings.md do not apply
//      here and there is no desk_turns row. If a model is ever added to
//      write this prose, the ceilings and the trail row come with it and
//      the arithmetic goes in this header.
//
// ── WHAT THIS DATABASE CAN HONESTLY SAY, 2026-09-27 ─────────────────────────
//
// Checked against the shared project before a line was written. Per client
// the derivable facts are:
//
//   netlify_deploys   what shipped. 425 rows, 399 ready, across 5 clients.
//   client_sites      where it lives, and whether the client may see it.
//   invoices          what was billed and what is open.
//   payments          what was actually received, and on which rail.
//   subscriptions     what renews next. Zero active rows today.
//   appointments      what is booked next. Zero rows today.
//
// There is NO per client web traffic in this database. page_views carries a
// path and nothing that ties a row to a client site, and gauge_events is the
// coin. So this report does not speak about visitors, and must not be made
// to. Cimarron's report leads on visits because cimarron-eng.com writes
// site_events; ours does not exist yet. When a per client beacon lands, add
// the section here and the preview shows it to Tyler before anybody receives
// it.
//
// ── THE DEPLOY DATE TRAP ────────────────────────────────────────────────────
//
// netlify_deploys.published_at is NULL on every row since 2026-07-22 while
// created_at keeps filling. Keying the period off published_at alone drops
// every recent release and the report reads as though nothing shipped. The
// effective date is published_at or created_at, computed in js because
// PostgREST cannot coalesce inside a filter, and the fetch widens the window
// by SYNC_LAG_DAYS on the near side so a row synced after the period closed
// is still considered. If published_at is ever backfilled this keeps working.
//
// ── THE CONTRAST TRAP ───────────────────────────────────────────────────────
//
// A client's accent is whatever their brand kit says, and some brands are
// pale. White text on a pale accent button is unreadable, and it is
// unreadable only in their inbox, never in a build. readable() derives the
// text colour from the fill's luminance instead of storing it, so no palette
// can ship an invisible button.
//
// ── THE SENDER ──────────────────────────────────────────────────────────────
//
// A burro is never named without a face, Tyler 2026-09-12. Every report is
// signed by one burro with the avatar beside the name. clients.report_sender
// overrides, and when it is null senderFor derives it from what the report
// actually carries, which is Tyler's own rule: a decision comes from Tyler,
// shipped work comes from Aster, the numbers come from Volt.
//
// AVATARS ARE WEBP. Gmail, Apple Mail and Outlook.com render webp. Outlook on
// Windows does not and shows the alt text instead. The name is printed as
// text beside the image and never inside it, so a blocked or unsupported
// avatar leaves a named burro and not a hole. If a jpg set is ever cut for
// mail, AVATAR_BASE and AVATAR_EXT below are the only two lines to change.
//
// No oxford commas, no em dashes.

import { Resend } from 'resend';

// ── house constants ─────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const STUDIO_EMAIL = process.env.NOTIFICATION_EMAIL || 'hello@neonburro.com';
const FROM_EMAIL = 'neonburro <hello@neonburro.com>';
const REPLY_TO = 'hello@neonburro.com';
const PULSE_URL = 'https://pulse.neonburro.com';

// The avatar set, see the note above. Two lines, one place.
const AVATAR_BASE = 'https://neonburro.com/burros';
const AVATAR_EXT = 'webp';
const avatarFor = (slug) => `${AVATAR_BASE}/${slug}/${slug}-avatar.${AVATAR_EXT}`;

// The nine, mirrored from src/lib/personas.js. A netlify function bundles on
// its own and cannot import from src, so the names live here too. If a
// burro's name or lane changes there, change it here in the same commit.
const BURROS = {
  volt: { name: 'Volt', line: 'keeps the count' },
  aster: { name: 'Aster', line: 'ships the work' },
  echo: { name: 'Echo', line: 'keeps the record' },
  lyra: { name: 'Lyra', line: 'design and brand' },
  cypher: { name: 'Cypher', line: 'systems and integration' },
  pixel: { name: 'Pixel', line: 'motion and interface' },
  skye: { name: 'Skye', line: 'pipelines and delivery' },
  ion: { name: 'Ion', line: 'research and discovery' },
  warbleur: { name: 'Warbleur', line: 'runs the yard' },
};

// Tyler signs in his own name and not as a burro, so he carries no avatar
// path and the block prints an accent disc instead. The rule above says a
// decision comes from him.
const TYLER = { name: 'Tyler Reagan', line: 'neonburro' };

// The house letterhead, mirrored from netlify/functions/_letterhead.js. A
// client with no palette gets exactly this. If a value moves there, move it
// here in the same commit.
export const HOUSE_BRAND = {
  ink: '#241A16',
  soft: '#4A382F',
  accent: '#C5D957',
  edge: '#E4DBCB',
  paper: '#FBF9F4',
  mat: '#E7DFD1',
  mark_url: null,
};

const SANS = "'Geist','Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const MONO = "'Geist Mono','JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace";

const DAY = 86400000;
const SYNC_LAG_DAYS = 3;
const OPEN_STATUSES = ['sent', 'viewed', 'partial', 'overdue'];

// ── small helpers ───────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const n = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');
const money = (v) => `$${(Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const plural = (count, one, many) => (Number(count) === 1 ? one : many);

const longDate = (d) => new Date(`${iso(d)}T12:00:00Z`).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric',
});
const shortDate = (d) => new Date(`${iso(d)}T12:00:00Z`).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric',
});
const monthName = (d) => new Date(`${iso(d)}T12:00:00Z`).toLocaleDateString('en-US', {
  month: 'long', year: 'numeric',
});

// sRGB relative luminance, the WCAG formula. See the contrast trap above.
// Returns the ink that reads on this fill, derived and never stored.
export const readable = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return HOUSE_BRAND.ink;
  const v = parseInt(m[1], 16);
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * channel((v >> 16) & 255) + 0.7152 * channel((v >> 8) & 255) + 0.0722 * channel(v & 255);
  return L > 0.45 ? '#1A1512' : '#FBF9F4';
};

// Every row, not the first 1000. PostgREST caps a request at 1000 rows and
// truncates silently, which would make a busy client's report quietly wrong
// rather than loudly broken.
const allRows = async (build) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

// ── the period ──────────────────────────────────────────────────────────────
//
// A calendar month, always whole. periodEnd names any day inside the month to
// report on and defaults to the last day of the month before today, so a run
// on the 1st covers the month that just closed.

export const monthWindow = (periodEnd) => {
  const now = new Date();
  const anchor = periodEnd
    ? new Date(`${String(periodEnd).slice(0, 10)}T12:00:00Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - DAY);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  return {
    start: iso(Date.UTC(y, m, 1)),
    end: iso(Date.UTC(y, m + 1, 1) - DAY),
  };
};

// ── the brand ───────────────────────────────────────────────────────────────
//
// Returns the palette plus house:true when the client has no kit at all. A
// partial kit keeps the keys it has and borrows the rest from the house, so a
// client with only an accent gets their accent on house paper rather than a
// hole. house is true only when NOTHING was set, which is what the preview
// banner and client_reports.brand_house both mean.

export const brandFor = (client) => {
  const keys = ['ink', 'soft', 'accent', 'edge', 'paper'];
  const given = keys.filter((k) => client?.[`brand_${k}`]);
  const brand = { ...HOUSE_BRAND };
  for (const k of given) brand[k] = client[`brand_${k}`];
  if (client?.brand_mark_url) brand.mark_url = client.brand_mark_url;
  brand.house = given.length === 0 && !client?.brand_mark_url;
  brand.partial = given.length > 0 && given.length < keys.length;
  brand.missing = keys.filter((k) => !client?.[`brand_${k}`]);
  // The mat is the wrapper behind the sheet. Derived from what was given
  // rather than stored, because a client who supplies one ground should not
  // have to supply two.
  brand.mat = client?.brand_paper ? brand.edge : HOUSE_BRAND.mat;
  return brand;
};

// ── the sender ──────────────────────────────────────────────────────────────
//
// Tyler's rule, in his words: the numbers can come from you, what shipped can
// come from Aster, anything needing a decision comes from Tyler. A decision
// means money is open on the account, which is the only thing in this report
// a client has to act on.

export const senderFor = (data, client) => {
  const override = String(client?.report_sender || '').trim().toLowerCase();
  if (override === 'tyler') return { slug: 'tyler', ...TYLER, avatar: null };
  if (override && BURROS[override]) return { slug: override, ...BURROS[override], avatar: avatarFor(override) };
  if (data.money.open_total > 0) return { slug: 'tyler', ...TYLER, avatar: null };
  if (data.shipped.releases > 0) return { slug: 'aster', ...BURROS.aster, avatar: avatarFor('aster') };
  return { slug: 'volt', ...BURROS.volt, avatar: avatarFor('volt') };
};

// The report goes to that client only. Never a list, never a bcc pile.
export const resolveRecipients = (client, contacts = []) => {
  const override = Array.isArray(client?.report_to) ? client.report_to : null;
  const raw = override && override.length
    ? override
    : [client?.email, ...(contacts || []).filter((c) => c.is_primary).map((c) => c.email)];
  return [...new Set(raw.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
};

// ── build ───────────────────────────────────────────────────────────────────

export const buildReport = async (db, { clientId, periodEnd } = {}) => {
  if (!clientId) throw new Error('buildReport needs a clientId');
  const period = monthWindow(periodEnd);
  const startTs = `${period.start}T00:00:00Z`;
  const endTs = `${iso(new Date(`${period.end}T12:00:00Z`).getTime() + DAY)}T00:00:00Z`;
  const fetchFrom = iso(new Date(`${period.start}T12:00:00Z`).getTime() - SYNC_LAG_DAYS * DAY);

  const { data: client, error: clientErr } = await db
    .from('clients')
    .select('id, name, company, email, website, status, report_approved, report_approved_at, report_to, report_sender, brand_ink, brand_soft, brand_accent, brand_edge, brand_paper, brand_mark_url')
    .eq('id', clientId)
    .maybeSingle();
  if (clientErr) throw clientErr;
  if (!client) throw new Error('no such client');

  const [sites, deploys, invoices, payments, subs, appts, contacts] = await Promise.all([
    allRows(() => db.from('client_sites')
      .select('id, display_name, netlify_site_name, primary_url, show_activity_to_client')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })),
    allRows(() => db.from('netlify_deploys')
      .select('id, site_id, state, branch, context, commit_message, created_at, published_at')
      .eq('client_id', clientId)
      .or(`created_at.gte.${fetchFrom}T00:00:00Z,published_at.gte.${fetchFrom}T00:00:00Z`)
      .order('created_at', { ascending: false })),
    allRows(() => db.from('invoices')
      .select('id, invoice_number, status, total, total_paid, sent_at, paid_at, due_date')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })),
    allRows(() => db.from('payments')
      .select('id, invoice_id, amount, method, received_at')
      .eq('client_id', clientId)
      .gte('received_at', startTs)
      .lt('received_at', endTs)
      .order('received_at', { ascending: true })),
    allRows(() => db.from('subscriptions')
      .select('id, name, amount, interval, status, current_period_end, next_invoice_at')
      .eq('client_id', clientId)
      .eq('status', 'active')),
    allRows(() => db.from('appointments')
      .select('id, title, meeting_type, starts_at, status')
      .eq('client_id', clientId)
      .gte('starts_at', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true })),
    allRows(() => db.from('client_contacts')
      .select('email, is_primary')
      .eq('client_id', clientId)),
  ]);

  return composeReport({ client, sites, deploys, invoices, payments, subs, appts, contacts, period });
};

/**
 * Everything after the fetching. Separate from buildReport on purpose: this
 * is the part that can be wrong in a way a build never catches, so it takes
 * plain rows and returns the whole report, and a harness can hand it real
 * rows pulled any other way and read what comes out. buildReport is then
 * only the queries.
 *
 * period is { start, end } from monthWindow.
 */
export const composeReport = ({ client, sites = [], deploys = [], invoices = [], payments = [], subs = [], appts = [], contacts = [], period }) => {
  // ── what shipped. See the deploy date trap in the header.
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const visible = (siteId) => {
    const s = siteById.get(siteId);
    return !s || s.show_activity_to_client !== false;
  };
  const at = (d) => iso(d.published_at || d.created_at);
  const inPeriod = (d) => at(d) >= period.start && at(d) <= period.end;

  // PRODUCTION ONLY. netlify_deploys carries context and branch, and every
  // row in the table today is production on main, but that is what the
  // webhook has happened to record and not a guarantee. A deploy preview or a
  // branch deploy is not something that went live for a client, so it is
  // filtered here rather than trusted to be absent. A null context is
  // treated as production because nothing recorded says otherwise, and a
  // stricter test would silently drop real releases if the column were ever
  // left unset.
  const live = (d) => d.state === 'ready' && (!d.context || d.context === 'production');

  const shippedRows = deploys.filter((d) => live(d) && inPeriod(d) && visible(d.site_id));
  const failedRows = deploys.filter((d) => d.state === 'error' && inPeriod(d) && (!d.context || d.context === 'production'));
  const lastRelease = deploys.filter(live).map(at).sort().pop() || null;

  // ── WHY THE HEADLINE FIGURE IS DAYS AND NOT DEPLOYS ───────────────────────
  //
  // Found on real April rows, 2026-09-27. One client's April was 200 ready
  // production deploys. Printing "200 releases went live" is true and it is
  // commercially awful. A deploy count measures our git habits, not anything
  // delivered, and a client who reads 200 and cannot see 200 changes reads it
  // as padding or asks a question we do not want to answer. 168 of those 200
  // were to an internal tool rather than the public site.
  //
  // Days with a release is derived from the same rows, is the same kind of
  // fact, and answers the question a client is actually asking, which is how
  // often somebody was working on this. The raw count stays in the data for
  // the studio notification, where it is ours to read and means something.
  const days = [...new Set(shippedRows.map(at))];

  // ── COMMIT SUBJECTS DO NOT GO TO THE CLIENT ───────────────────────────────
  //
  // Found by reading the rendered April report, 2026-09-27, which is the only
  // way this was ever going to be found. The subjects that came out were
  // "hotfix: remove stray char at EOF of create-stripe-setup (was causing
  // 502)" and "v5: fix payment gate" and ten more like them. A commit subject
  // is written for whoever reads the log next, and printing it inside a
  // document wearing the client's own logo is worse than printing nothing. It
  // reads as noise at best and at worst it tells a paying client which of
  // their things was broken and for how long.
  //
  // There is no rule that separates a client safe subject from an internal
  // one. This house writes them as plain prose and the April repo used
  // conventional commit prefixes, and a heuristic that guessed between them
  // would be exactly the kind of guessing this whole file refuses.
  //
  // So they are collected here, kept in data, carried in the STUDIO
  // notification where they are ours to read and are useful, and renderReport
  // does not print them. What the client reads about shipping is the number
  // of days, which is a fact about them rather than about our log.
  //
  // What would make this section worth reading is one line a person wrote,
  // per client per month. That is not derivable and nothing writes it yet, so
  // it is named in the handoff note and not invented here.
  const subject = (msg) => String(msg || '').split('\n')[0].trim().slice(0, 140);
  const notes = [...new Set(shippedRows.map((d) => subject(d.commit_message)).filter(Boolean))].slice(0, 12);

  const shipped = {
    releases: shippedRows.length,
    days: days.length,
    failed: failedRows.length,
    notes,
    last_release: lastRelease,
    sites: sites
      .filter((s) => s.show_activity_to_client !== false && s.primary_url)
      .map((s) => ({
        name: s.display_name || s.netlify_site_name || null,
        url: s.primary_url,
        releases: shippedRows.filter((d) => d.site_id === s.id).length,
        days: [...new Set(shippedRows.filter((d) => d.site_id === s.id).map(at))].length,
      })),
  };

  // ── the account.
  //
  // The period filters are applied HERE and not only in the query. buildReport
  // narrows payments in Postgres, but this function must be correct for any
  // rows it is handed, because it is the part a harness tests and a filter
  // that lives only in a caller is a filter that can quietly go missing.
  const within = (ts) => !!ts && iso(ts) >= period.start && iso(ts) <= period.end;
  const sentInPeriod = invoices.filter((i) => within(i.sent_at) && i.status !== 'cancelled');
  const paidInPeriod = invoices.filter((i) => within(i.paid_at) && i.status === 'paid');
  const open = invoices.filter((i) => OPEN_STATUSES.includes(i.status));
  const overdue = invoices.filter((i) => i.status === 'overdue');
  const paidHere = payments.filter((p) => within(p.received_at));

  const moneyBlock = {
    billed: sentInPeriod.reduce((a, i) => a + Number(i.total || 0), 0),
    billed_count: sentInPeriod.length,
    received: paidHere.reduce((a, p) => a + Number(p.amount || 0), 0),
    received_count: paidHere.length,
    paid_count: paidInPeriod.length,
    open_total: open.reduce((a, i) => a + (Number(i.total || 0) - Number(i.total_paid || 0)), 0),
    open_count: open.length,
    overdue_count: overdue.length,
    overdue_oldest: overdue.map((i) => i.due_date).filter(Boolean).sort()[0] || null,
    // The rails the money actually arrived on, from payments.method, which
    // stripe-payment-webhook.js writes. Read, never assumed.
    rails: [...new Set(paidHere.map((p) => p.method).filter(Boolean))],
    invoices: [...sentInPeriod, ...paidInPeriod.filter((i) => !sentInPeriod.some((s) => s.id === i.id))]
      .slice(0, 8)
      .map((i) => ({
        number: i.invoice_number,
        status: i.status,
        total: Number(i.total || 0),
        paid: Number(i.total_paid || 0),
      })),
  };

  // ── what is next. Both are empty across the whole book today, which is
  // exactly why they are guarded rather than assumed. The status and future
  // filters are repeated here for the same reason as the payments filter
  // above, so this function is right whatever it is handed.
  const nowIso = new Date().toISOString();
  const next = {
    renewals: subs
      .filter((s) => s.status === 'active')
      .map((s) => ({
        name: s.name,
        amount: Number(s.amount || 0),
        interval: s.interval,
        on: (s.next_invoice_at || s.current_period_end) ? iso(s.next_invoice_at || s.current_period_end) : null,
      }))
      .filter((r) => r.on),
    meetings: appts
      .filter((a) => a.status !== 'cancelled' && a.starts_at && a.starts_at >= nowIso)
      .slice(0, 4)
      .map((a) => ({
        title: a.title,
        kind: a.meeting_type,
        on: a.starts_at,
      })),
  };

  const data = {
    period: { start: period.start, end: period.end, label: monthName(period.start) },
    shipped,
    money: moneyBlock,
    next,
    // Counting since, so a first report never implies the studio has been
    // watching longer than it has.
    counting_since: deploys.length ? deploys.map(at).sort()[0] : null,
  };

  return {
    client,
    brand: brandFor(client),
    sender: senderFor(data, client),
    recipients: resolveRecipients(client, contacts),
    kind: 'monthly',
    period_start: period.start,
    period_end: period.end,
    data,
    narrative: narrate(data, client),
    // An empty report has nothing to say in any section. The schedule skips
    // these rather than mailing a client a page about nothing.
    empty: shipped.releases === 0
      && moneyBlock.billed_count === 0
      && moneyBlock.received_count === 0
      && moneyBlock.open_count === 0
      && next.renewals.length === 0
      && next.meetings.length === 0,
  };
};

// ── the narrative, written by rule ──────────────────────────────────────────
//
// Each sentence restates a figure printed beside it. Nothing here compares
// against a number the reader cannot also see, and nothing here is generated.

const narrate = (d, client) => {
  const who = client?.company || client?.name || 'you';
  const lines = [];

  if (d.shipped.releases > 0) {
    // Days, not deploys. The reason is in composeReport above.
    lines.push(`Work went live for ${who} on ${n(d.shipped.days)} ${plural(d.shipped.days, 'day', 'separate days')} in ${d.period.label}.`);
  } else if (d.shipped.last_release) {
    lines.push(`Nothing shipped in ${d.period.label}. The last release was ${longDate(d.shipped.last_release)}.`);
  }

  if (d.money.received > 0) {
    lines.push(`${money(d.money.received)} received across ${n(d.money.received_count)} ${plural(d.money.received_count, 'payment', 'payments')}.`);
  }
  if (d.money.billed_count > 0) {
    lines.push(`${n(d.money.billed_count)} ${plural(d.money.billed_count, 'invoice', 'invoices')} sent, ${money(d.money.billed)} in total.`);
  }
  if (d.money.open_total > 0) {
    lines.push(
      d.money.overdue_count > 0
        ? `${money(d.money.open_total)} is open and ${n(d.money.overdue_count)} ${plural(d.money.overdue_count, 'invoice is', 'invoices are')} past due.`
        : `${money(d.money.open_total)} is open across ${n(d.money.open_count)} ${plural(d.money.open_count, 'invoice', 'invoices')}.`,
    );
  } else if (d.money.received > 0 || d.money.billed_count > 0) {
    lines.push('Nothing is open on the account.');
  }

  if (d.next.renewals.length) {
    const r = d.next.renewals[0];
    lines.push(`${r.name} renews ${longDate(r.on)} at ${money(r.amount)}.`);
  }
  if (d.next.meetings.length) {
    lines.push(`Next on the calendar is ${shortDate(d.next.meetings[0].on)}.`);
  }

  return lines.join(' ');
};

// ── render ──────────────────────────────────────────────────────────────────
//
// Table layout throughout, inline styles only, no external stylesheet and no
// remote asset the report cannot survive losing. Everything but the client's
// own mark and the sender's avatar renders with images off.

const disc = (color) => `<span style="display:inline-block;width:0.16em;height:0.16em;border-radius:99px;background:${color};margin-left:0.03em;vertical-align:baseline;"></span>`;

const kickerLine = (B, text) => `<div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:${B.soft};">${esc(text)}</div>`;

const section = (B, title, inner) => (inner ? `
      <tr><td style="padding:30px 40px 0;">
        <div style="border-top:1px solid ${B.edge};padding-top:18px;">
          ${kickerLine(B, title)}
          ${inner}
        </div>
      </td></tr>` : '');

const figures = (B, pairs) => (pairs.length ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
  <tr>
    ${pairs.map(([label, value]) => `
    <td width="${Math.floor(100 / pairs.length)}%" valign="top" style="padding-right:16px;">
      <div style="font-family:${SANS};font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${B.ink};line-height:1.1;">${esc(value)}</div>
      <div style="font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${B.soft};margin-top:6px;">${esc(label)}</div>
    </td>`).join('')}
  </tr>
</table>` : '');

const lines = (B, rows) => (rows.length ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
  ${rows.map((r, i) => `
  <tr>
    <td style="padding:10px 0;${i === 0 ? '' : `border-top:1px solid ${B.edge};`}font-family:${SANS};font-size:14px;line-height:1.5;color:${B.ink};">${r.left}</td>
    ${r.right ? `<td align="right" style="padding:10px 0 10px 16px;${i === 0 ? '' : `border-top:1px solid ${B.edge};`}font-family:${MONO};font-size:12px;color:${B.soft};white-space:nowrap;vertical-align:top;">${esc(r.right)}</td>` : ''}
  </tr>`).join('')}
</table>` : '');

export const renderReport = ({ client, brand, sender, data, narrative }) => {
  const B = brand;
  const onAccent = readable(B.accent);
  const who = client.company || client.name || 'your business';
  const d = data;

  const header = B.mark_url
    ? `<img src="${esc(B.mark_url)}" alt="${esc(who)}" width="140" style="display:block;width:140px;max-width:140px;height:auto;border:0;">
         <div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:-0.02em;color:${B.soft};margin-top:10px;">built and kept by neonburro${disc(B.accent)}</div>`
    : `<div style="font-family:${SANS};font-size:22px;font-weight:600;letter-spacing:-0.035em;color:${B.ink};line-height:1;">${esc(who)}</div>
         <div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:-0.02em;color:${B.soft};margin-top:8px;">built and kept by neonburro${disc(B.accent)}</div>`;

  const shippedBlock = (d.shipped.releases > 0 || d.shipped.last_release)
    ? section(B, 'what shipped', `
          ${/* Guarded on days and not on releases. They agree when the report
                comes from composeReport, and guarding on the figure actually
                printed means no path can ever set this block to "0 days we
                shipped" beside a month that shipped. A figure is printed only
                when it is positive, the same rule the account block follows. */
            figures(B, d.shipped.days > 0 ? [
              [plural(d.shipped.days, 'day we shipped', 'days we shipped'), n(d.shipped.days)],
              ...(d.shipped.sites.filter((s) => s.releases > 0).length > 1
                ? [['sites touched', n(d.shipped.sites.filter((s) => s.releases > 0).length)]]
                : []),
            ] : [])}
          ${d.shipped.releases === 0 && d.shipped.last_release
            ? `<div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${B.soft};margin-top:12px;">Nothing went live this month. The last release was ${longDate(d.shipped.last_release)}.</div>`
            : ''}`)
    : '';

  // ── NO PER SITE COUNT HERE, AND THAT IS DELIBERATE ────────────────────────
  //
  // Read off the rendered April report, 2026-09-27. With a count in this
  // column the section said 14 days on one site and 23 on the other against a
  // headline of 24 days we shipped. All three numbers are right, because a
  // day with a release to both sites is one day in the total and one day in
  // each site, and a reader who adds 14 and 23 and gets 37 has no way to know
  // that. A figure that is correct and reads as a contradiction is worth less
  // than no figure.
  //
  // This section's job is to say where their things live. The counting is done
  // once, above. The per site numbers stay in data for us.
  const sitesBlock = d.shipped.sites.length
    ? section(B, 'where it lives', lines(B, d.shipped.sites.map((s) => ({
      left: `<a href="${esc(s.url)}" style="color:${B.ink};text-decoration:none;border-bottom:1px solid ${B.accent};">${esc(s.name || s.url.replace(/^https?:\/\//, ''))}</a>`,
    }))))
    : '';

  // Every figure guarded on its own, so a month with a payment and no invoice
  // prints one figure rather than a row of zeroes.
  const moneyFigures = [
    ...(d.money.received > 0 ? [['received', money(d.money.received)]] : []),
    ...(d.money.billed_count > 0 ? [['invoiced', money(d.money.billed)]] : []),
    ...(d.money.open_total > 0 ? [['open', money(d.money.open_total)]] : []),
  ];
  const moneyBlock = (moneyFigures.length || d.money.invoices.length)
    ? section(B, 'the account', `
          ${figures(B, moneyFigures)}
          ${lines(B, d.money.invoices.map((i) => ({
            left: `${esc(i.number || 'Invoice')}<span style="color:${B.soft};"> · ${esc(i.status)}</span>`,
            right: money(i.total),
          })))}
          ${d.money.overdue_count > 0
            ? `<div style="font-family:${SANS};font-size:14px;line-height:1.6;color:${B.ink};margin-top:14px;">${n(d.money.overdue_count)} ${plural(d.money.overdue_count, 'invoice is', 'invoices are')} past due${d.money.overdue_oldest ? `, the oldest since ${longDate(d.money.overdue_oldest)}` : ''}. Reply to this mail and we will sort it out.</div>`
            : ''}`)
    : '';

  const nextBlock = (d.next.renewals.length || d.next.meetings.length)
    ? section(B, 'coming up', lines(B, [
      ...d.next.renewals.map((r) => ({ left: esc(r.name || 'Subscription'), right: `${money(r.amount)} on ${shortDate(r.on)}` })),
      ...d.next.meetings.map((m) => ({ left: esc(m.title || 'A call'), right: shortDate(m.on) })),
    ]))
    : '';

  const face = sender.avatar
    ? `<img src="${esc(sender.avatar)}" alt="${esc(sender.name)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:99px;border:1px solid ${B.edge};">`
    : `<div style="width:44px;height:44px;border-radius:99px;background:${B.accent};"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(who)} · ${esc(d.period.label)}</title>
</head>
<body style="margin:0;padding:0;background:${B.mat};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(narrative.slice(0, 140))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${B.mat};">
  <tr><td align="center" style="padding:36px 16px 48px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:600px;background:${B.paper};border-radius:18px;overflow:hidden;">

      <tr><td style="height:3px;background:${B.accent};font-size:0;line-height:0;">&nbsp;</td></tr>

      <tr><td style="padding:34px 40px 0;">${header}</td></tr>

      <tr><td style="padding:28px 40px 0;">
        ${kickerLine(B, `${d.period.label} · monthly report`)}
        <div style="font-family:${SANS};font-size:30px;font-weight:600;letter-spacing:-0.03em;line-height:1.15;color:${B.ink};margin-top:10px;">What happened this month.</div>
        ${narrative ? `<div style="font-family:${SANS};font-size:15px;line-height:1.65;color:${B.soft};margin-top:14px;">${esc(narrative)}</div>` : ''}
      </td></tr>
${shippedBlock}${sitesBlock}${moneyBlock}${nextBlock}
      <tr><td style="padding:34px 40px 0;">
        <div style="border-top:1px solid ${B.edge};padding-top:22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td width="44" valign="top" style="padding-right:14px;">${face}</td>
              <td valign="top">
                <div style="font-family:${SANS};font-size:15px;font-weight:600;color:${B.ink};line-height:1.3;">${esc(sender.name)}</div>
                <div style="font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${B.soft};margin-top:4px;">${esc(sender.line)}</div>
              </td>
            </tr>
          </table>
          <div style="font-family:${SANS};font-size:14px;line-height:1.65;color:${B.soft};margin-top:16px;">Reply to this mail and it reaches a person in Ridgway. If a figure here looks wrong, say so and we will go and check it.</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:22px;">
            <tr><td style="border-radius:999px;background:${B.accent};">
              <a href="mailto:${REPLY_TO}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${onAccent};text-decoration:none;border-radius:999px;">Reply to the studio</a>
            </td></tr>
          </table>
        </div>
      </td></tr>

      <tr><td style="padding:30px 40px 34px;">
        <div style="font-family:${MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${B.soft};line-height:1.8;border-top:1px solid ${B.edge};padding-top:18px;">
          ${esc(longDate(d.period.start))} to ${esc(longDate(d.period.end))}${d.counting_since ? ` · counting since ${esc(longDate(d.counting_since))}` : ''}<br>
          The Burroship, LLC · PO Box 2111, Ridgway CO 81432 · ${REPLY_TO}
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
};

// ── save and send ───────────────────────────────────────────────────────────
//
// A preview calls neither. Nothing is written until something goes out, so
// the table is a record of what clients received and not a pile of drafts.

export const saveReport = async (db, report, html, emailedTo) => {
  const { data, error } = await db
    .from('client_reports')
    .upsert({
      client_id: report.client.id,
      kind: report.kind,
      period_start: report.period_start,
      period_end: report.period_end,
      data: report.data,
      narrative: report.narrative,
      sender: report.sender.slug,
      brand_house: !!report.brand.house,
      html,
      emailed_to: emailedTo,
      emailed_at: new Date().toISOString(),
    }, { onConflict: 'client_id,kind,period_start' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
};

// Every send tells the studio. Tyler has asked for this twice in different
// words, nothing leaves the building without the studio knowing. Who it went
// to, when, and a link to exactly what they got, which is the stored html on
// the saved row and not a re-render.
const notifyStudio = async (resend, { report, reportId }) => {
  const { client, sender, recipients, brand, data } = report;
  const when = `${new Date().toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })} MT`;
  const link = reportId ? `${PULSE_URL}/reports/?client=${client.id}&report=${reportId}` : `${PULSE_URL}/reports/?client=${client.id}`;
  const rows = [
    ['to', recipients.join(', ')],
    ['sent', when],
    ['signed', sender.name],
    ['palette', brand.house
      ? 'house, this client has no brand kit yet'
      : (brand.partial ? `theirs, partial, missing ${brand.missing.join(' ')}` : 'theirs')],
    // The raw deploy count belongs here and not in the client's report. See
    // the note in composeReport about why days is the figure they read.
    ['shipped', `${n(data.shipped.days)} ${plural(data.shipped.days, 'day', 'days')}, ${n(data.shipped.releases)} ${plural(data.shipped.releases, 'deploy', 'deploys')}`],
    ['open', money(data.money.open_total)],
  ];

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${HOUSE_BRAND.mat};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${HOUSE_BRAND.mat};">
 <tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:560px;background:${HOUSE_BRAND.paper};border-radius:18px;overflow:hidden;">
   <tr><td style="height:3px;background:${HOUSE_BRAND.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
   <tr><td style="padding:30px 36px 34px;">
    <div style="font-family:${MONO};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${HOUSE_BRAND.soft};">pulse · a report went out</div>
    <div style="font-family:${SANS};font-size:24px;font-weight:600;letter-spacing:-0.03em;color:${HOUSE_BRAND.ink};margin-top:10px;line-height:1.2;">${esc(client.company || client.name)} got their ${esc(data.period.label)} report.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:22px;">
     ${rows.map(([k, v], i) => `<tr>
      <td style="padding:10px 0;border-top:${i === 0 ? `2px solid ${HOUSE_BRAND.ink}` : `1px solid ${HOUSE_BRAND.edge}`};font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${HOUSE_BRAND.soft};padding-right:20px;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
      <td align="right" style="padding:10px 0;border-top:${i === 0 ? `2px solid ${HOUSE_BRAND.ink}` : `1px solid ${HOUSE_BRAND.edge}`};font-family:${SANS};font-size:13px;color:${HOUSE_BRAND.ink};">${esc(v)}</td>
     </tr>`).join('')}
    </table>
    ${data.shipped.failed ? `<div style="font-family:${SANS};font-size:13px;line-height:1.6;color:${HOUSE_BRAND.soft};margin-top:16px;">${n(data.shipped.failed)} ${plural(data.shipped.failed, 'build', 'builds')} failed in the period. The client's report does not mention them, this line is for us.</div>` : ''}
    ${data.shipped.notes?.length ? `
    <div style="font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${HOUSE_BRAND.soft};margin-top:22px;">what actually shipped, ours only</div>
    <div style="font-family:${SANS};font-size:13px;line-height:1.7;color:${HOUSE_BRAND.ink};margin-top:8px;">${data.shipped.notes.map((note) => esc(note)).join('<br>')}</div>
    <div style="font-family:${SANS};font-size:12px;line-height:1.6;color:${HOUSE_BRAND.soft};margin-top:10px;">These are commit subjects and they are NOT in the client's report, on purpose. If one of them is worth telling them about, tell them in your own words.</div>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;">
     <tr><td style="border-radius:999px;background:${HOUSE_BRAND.accent};">
      <a href="${link}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:14px;font-weight:600;color:${readable(HOUSE_BRAND.accent)};text-decoration:none;border-radius:999px;">Read exactly what they got</a>
     </td></tr>
    </table>
   </td></tr>
  </table>
 </td></tr>
</table></body></html>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: STUDIO_EMAIL,
    reply_to: REPLY_TO,
    subject: `${client.company || client.name} got their ${data.period.label} report • neonburro`,
    html,
  });
  if (error) throw new Error(error.message || 'the studio notification did not go');
};

/**
 * Sends one report and records it. The caller checks the approval gate,
 * because the schedule checks it per client and the manual door is a
 * person's own hand on the button. Returns { ok, id, to, notes } or
 * { ok: false, error }.
 */
export const sendReport = async (db, report) => {
  if (!RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY is not set on the Pulse site' };
  if (!report.recipients.length) return { ok: false, error: 'this client has no email address and no primary contact' };

  const html = renderReport(report);
  const resend = new Resend(RESEND_API_KEY);
  const who = report.client.company || report.client.name;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: report.recipients,
    reply_to: REPLY_TO,
    subject: `${who} · ${report.data.period.label}`,
    html,
  });
  if (error) return { ok: false, error: error.message || 'the report did not go' };

  // The row is written after the send and carries the bytes that went. If
  // this throws the client still has the mail, so the notes say so rather
  // than the caller reporting a failure that did not happen.
  const notes = [];
  let saved = null;
  try {
    saved = await saveReport(db, report, html, report.recipients);
  } catch (err) {
    console.error('[client-report] the row did not save,', err.message);
    notes.push('the mail went and the record did not save, the client_reports table may not exist yet');
  }

  try {
    await notifyStudio(resend, { report, reportId: saved?.id || '' });
  } catch (err) {
    console.error('[client-report] the studio notification did not go,', err.message);
    notes.push('the report went and the studio notification did not');
  }

  return { ok: true, id: saved?.id || null, to: report.recipients, notes };
};
