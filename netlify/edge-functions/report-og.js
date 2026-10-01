// netlify/edge-functions/report-og.js
// SENTINEL: NB_PULSE_REPORT_OG_V1
//
// Per report link previews. Prepared 2026-09-29 by Aster after Tyler texted
// himself a pulse link twice and got the boardroom fish both times.
//
// ── WHY THE FISH KEPT SHOWING ───────────────────────────────────────────
//
// index.html carries ONE hardcoded og block, the portal card, and
// netlify.toml rewrites /* to /index.html at 200. So every url on this
// domain serves the same head. A crawler never runs our javascript, which
// means React setting meta tags after mount changes nothing about what
// iMessage, Slack or WhatsApp render. Swapping the image would not have
// helped either, because any single image is wrong for a per client report.
//
// This is the first edge function in the repo. It runs BEFORE the SPA catch
// all, on /r/* only, takes the page the catch all would have served and
// rewrites four tags in it. Humans get exactly the same app they got before.
// Crawlers get the client's own card.
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────
//
// It reads a slug and answers with a title, a description and an image url.
// It never renders a figure, never touches client_reports.html and never
// says anything a stranger could not already see on the cover of the report.
// A link preview is shown to whoever the message was forwarded to, so
// nothing behind the access code belongs in these tags.
//
// If the slug is unknown, or Supabase is unreachable, or anything at all
// goes wrong, it serves the page untouched. A broken preview is a bad day
// and a broken page is a worse one, so every path here falls through to the
// original response.
//
// ── TESTING IT, WHICH IS WHERE THE TIME GOES ────────────────────────────
//
// iMessage, Slack and Facebook all cache a preview against the URL, hard,
// for days. Re sending the same link after a deploy shows the OLD card and
// tells you nothing. There is no reset on the phone. Test with a url the
// scraper has never seen, either a fresh slug or the same one with
// ?v=2 on the end, or push it through
// https://developers.facebook.com/tools/debug/ which has a scrape again
// button. Do that before concluding this does not work.
//
// No oxford commas, no em dashes.

const SITE = 'https://pulse.neonburro.com';
const FALLBACK_CARD = `${SITE}/og/pulse-dome-boardroom-observer-fish-night-card.jpg`;

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Replace a meta tag's content in place, or leave the document alone if the
// tag is not there. We never add tags, because index.html already owns the
// full set and a duplicate og:image is worse than a wrong one.
const swap = (html, attr, name, value) => {
  const re = new RegExp(
    `(<meta\\s+[^>]*${attr}=["']${name}["'][^>]*content=["'])([^"']*)(["'])`,
    'i',
  );
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$3`);
  const re2 = new RegExp(
    `(<meta\\s+[^>]*content=["'])([^"']*)(["'][^>]*${attr}=["']${name}["'])`,
    'i',
  );
  return re2.test(html) ? html.replace(re2, `$1${esc(value)}$3`) : html;
};

const monthName = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export default async (request, context) => {
  const res = await context.next();

  try {
    const slug = new URL(request.url).pathname.split('/').filter(Boolean)[1];
    if (!slug || !/^[A-Za-z0-9_-]{4,64}$/.test(slug)) return res;

    const base = Netlify.env.get('SUPABASE_URL');
    const key = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY') || Netlify.env.get('SUPABASE_SECRET_KEY');
    if (!base || !key) return res;

    const q = `${base}/rest/v1/client_reports`
      + `?slug=eq.${encodeURIComponent(slug)}`
      + `&select=period_end,og_card_url,clients(name)`
      + `&limit=1`;

    const r = await fetch(q, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!r.ok) return res;

    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return res;

    const client = row.clients?.name || '';
    const month = monthName(row.period_end);
    const title = [client, month].filter(Boolean).join(', ') || 'Your monthly report';
    const desc = `Your ${month || 'monthly'} report from neonburro. How the month went, what is worth doing next, and a few questions for you.`;
    const card = row.og_card_url || FALLBACK_CARD;
    const url = `${SITE}/r/${slug}`;

    let html = await res.text();
    html = swap(html, 'property', 'og:title', title);
    html = swap(html, 'property', 'og:description', desc);
    html = swap(html, 'property', 'og:image', card);
    html = swap(html, 'property', 'og:url', url);
    html = swap(html, 'property', 'og:image:alt', `${title}, prepared by neonburro`);
    html = swap(html, 'name', 'twitter:title', title);
    html = swap(html, 'name', 'twitter:description', desc);
    html = swap(html, 'name', 'twitter:image', card);
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);

    return new Response(html, {
      status: res.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Short, so a card corrected after a send is picked up by the next
        // scraper rather than sitting wrong at the edge for a day.
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch {
    return res;
  }
};

export const config = { path: '/r/*' };
