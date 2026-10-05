// src/lib/mailRender.js
// SENTINEL: NB_PULSE_MAIL_RENDER_V2
//
// THE ONE RENDERER. renderMail(doc, context) returns { subject, preheader,
// html, text, hashInput } and it is the only thing in this repository that
// turns a Mail document into a message. The editor's live preview calls it
// in the browser, netlify/functions/mail-send.js calls it in Node on the row
// it just read, netlify/functions/mail-digest.js calls it for the one quiet
// digest a day, and scripts/mail-render.mjs calls it by hand. One function,
// so the preview and the send cannot drift. If you are about to write a
// second template for a Mail letter anywhere, stop and change this one.
//
// ── WHY IT LOOKS LIKE THIS ──────────────────────────────────────────────────
// It is the Greenville September letter of 2026-10-05 made general. A light
// ground, a centred 600px column, opening paragraphs in plain dark type above
// everything, one dark hero card with a small uppercase kicker, a two line
// headline, a lede, an accent button and a code line, then the sections on
// light cards, then a row of link cards each with a kicker, a short accent
// rule, a title, a line and the path, then a pale signature card. Tyler, "I
// love what you just did there. It's centered, and the content's in the
// container."
//
// ── THE CONTEXT ─────────────────────────────────────────────────────────────
// context.items is the client's open items, status open, oldest first, each
// { title, detail, kind, opened_at, token }. An open_items section prints
// them with their age counted to doc.asOf and an approve and a deny link to
// the public answer page. The browser and the door read the same rows with
// the same order, so the same items make the same bytes. If an item is
// answered between a test and a send the bytes change and the door asks for
// another test, which is right, the letter did change.
//
// ── WHAT EVERY MAIL CLIENT GETS ─────────────────────────────────────────────
// Tables for layout, every style inline, Arial, bgcolor attributes beside
// background colours, explicit widths. Gmail strips most of a head, Outlook
// on Windows renders with Word and ignores max-width and border-radius,
// Apple Mail paints anything that looks like a phone number blue. So the
// column is width 100 percent with max-width 600px, and Outlook alone gets a
// fixed 600 table in a conditional comment. The Gmail draft used width 600
// with max-width 100 percent, and rendered in Chrome at a 600 wide window
// that column ran off the right edge by the gutter, because a percentage
// max on a table inside an auto sized cell resolves to nothing. Measured,
// not guessed, see docs/mail/README.md. Corners round where they can and stay
// square in Outlook, the button carries mso-padding-alt so Word gives it a
// body, and the head carries only the Apple detector reset.
//
// ── LINKS GO OUT EXACTLY AS WRITTEN ─────────────────────────────────────────
// An href here is the address typed into the field, escaped for html and
// nothing else. No tracking, no redirect, no rewriting. Link cards make each
// line its own anchor rather than wrapping a table inside one, because a
// block link is invalid html and Outlook drops it. The phone is always a
// tel: link built from its digits, never javascript:void(0), which is what a
// Gmail paste left behind in the 2026-10-04 draft.
//
// The approve and deny links on an open item land on a page that asks for a
// press before it records anything. A mail scanner that follows every link
// in a message, Outlook safe links does, must never be able to answer for
// the client. See src/pages/Answer/index.jsx.
//
// ── DETERMINISTIC ON PURPOSE ────────────────────────────────────────────────
// No clock, no random, no locale. Ages count to doc.asOf, never to now. The
// same document and the same items always render the same bytes in a
// browser and in Node, because mail-send.js refuses a real send unless a
// test of the exact same bytes went to tyler@neonburro.com first, and it
// compares them by a sha256 of hashInput, computed on both sides.
//
// No oxford commas, no em dashes.

import {
  normalizeMail, resolvePalette, pathOf, telOf, shortDate, ageLabel, ageDays, answerLink, ITEM_KINDS, CHECK_STATES,
} from './mailDocument.js';

const FONT = 'Arial,Helvetica,sans-serif';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Two typed spaces stay two spaces, the kicker "report  ·  September" reads
// with air on both sides of the dot the way it was written. fragment keeps
// the edges, a piece of a sentence beside the bright code needs its space.
// inline is a whole field and trims.
const fragment = (s) => esc(String(s ?? '')).replace(/ {2}/g, '&nbsp; ');
const inline = (s) => fragment(String(s ?? '').trim());

// Inside a short field a new line is a line break.
const lines = (s) => inline(s).replace(/\r?\n/g, '<br>');

// A blank line starts a paragraph. A single new line inside one is a break.
const paragraphs = (s) => String(s ?? '')
  .replace(/\r\n/g, '\n')
  .split(/\n[ \t]*\n/)
  .map((p) => p.trim())
  .filter(Boolean);

const type = ({ size, line = '1.5', weight = 'normal', color, spacing, upper = false }) => [
  `font-family:${FONT}`,
  `font-size:${size}px`,
  `line-height:${line}`,
  `font-weight:${weight}`,
  `color:${color}`,
  spacing ? `letter-spacing:${spacing}` : '',
  upper ? 'text-transform:uppercase' : '',
].filter(Boolean).join(';');

const spacer = (h) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;

const href = (url) => esc(String(url || '').trim());

// The code inside the code line, set bright. First exact match only.
const codeLine = (lineText, code, c) => {
  const text = String(lineText || '').trim();
  const token = String(code || '').trim();
  if (!token || !text.includes(token)) return inline(text);
  const at = text.indexOf(token);
  return `${fragment(text.slice(0, at))}<span style="color:${c.cardHead};font-weight:bold;letter-spacing:1px;">${esc(token)}</span>${fragment(text.slice(at + token.length))}`;
};

// The studio period. neonburro.com is the house mark and its period wears
// the house colour. Any other site label is printed as typed.
const siteMark = (label, c) => {
  const text = String(label || '').trim();
  const m = text.match(/^neonburro(\.)(.*)$/i);
  if (!m) return inline(text);
  return `neonburro<span style="color:${c.period};">.</span>${fragment(m[2])}`;
};

const openingBlock = (doc, c) => {
  const ps = paragraphs(doc.opening);
  if (!ps.length) return '';
  const body = ps.map((p, i) => `<p style="margin:0 0 ${i === ps.length - 1 ? 0 : 14}px;${type({ size: 15.5, line: '1.62', color: c.ink })};">${lines(p)}</p>`).join('\n          ');
  return `<tr>
        <td style="padding:2px 4px 24px;">
          ${body}
        </td>
      </tr>`;
};

const heroBlock = (doc, c) => {
  const h = doc.hero;
  const has = [h.kicker, h.headline, h.lede, h.buttonLabel, h.codeLine].some((v) => String(v || '').trim());
  if (!has) return '';
  const parts = [];
  if (h.kicker.trim()) parts.push(`<p style="margin:0;${type({ size: 10, line: '1.2', weight: 'bold', color: c.cardKicker, spacing: '2px', upper: true })};">${inline(h.kicker)}</p>`);
  if (h.headline.trim()) parts.push(`<p style="margin:${parts.length ? 16 : 0}px 0 0;${type({ size: 30, line: '1.14', weight: 'bold', color: c.cardHead })};">${lines(h.headline)}</p>`);
  if (h.lede.trim()) parts.push(`<p style="margin:16px 0 0;${type({ size: 16, line: '1.6', color: c.cardLede })};">${lines(h.lede)}</p>`);
  if (h.buttonLabel.trim() && h.buttonUrl.trim()) {
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-collapse:separate;">
              <tr>
                <td bgcolor="${c.accent}" style="background-color:${c.accent};border-radius:9px;mso-padding-alt:15px 30px;">
                  <a href="${href(h.buttonUrl)}" style="display:inline-block;padding:15px 30px;${type({ size: 15, line: '1', weight: 'bold', color: c.onAccent })};text-decoration:none;border-radius:9px;">${inline(h.buttonLabel)}</a>
                </td>
              </tr>
            </table>`);
  }
  if (h.codeLine.trim()) parts.push(`<p style="margin:20px 0 0;${type({ size: 13, line: '1.5', color: c.cardKicker })};">${codeLine(h.codeLine, h.code, c)}</p>`);
  return `<tr>
        <td bgcolor="${c.card}" style="background-color:${c.card};border-radius:14px;padding:34px 30px 32px;">
            ${parts.join('\n            ')}
        </td>
      </tr>`;
};

// ── sections, each on a light card ──────────────────────────────────────────

const sectionTitle = (title, c) => (String(title || '').trim()
  ? `<p style="margin:0 0 14px;${type({ size: 10, line: '1.2', weight: 'bold', color: c.muted, spacing: '2px', upper: true })};">${inline(title)}</p>`
  : '');

const hair = (c, top = 0) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${top}px 0 0;"><tr><td height="1" bgcolor="${c.sheetEdge}" style="height:1px;background-color:${c.sheetEdge};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

const lightCard = (inner, c) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.sheet}" style="background-color:${c.sheet};border:1px solid ${c.sheetEdge};border-radius:14px;">
              <tr>
                <td style="padding:24px 26px 24px;">
                  ${inner}
                </td>
              </tr>
            </table>`;

const textSection = (s, c) => {
  const ps = paragraphs(s.body);
  if (!ps.length) return '';
  return `${sectionTitle(s.title, c)}${ps.map((p, i) => `<p style="margin:${i ? 10 : 0}px 0 0;${type({ size: 14.5, line: '1.6', color: c.ink })};">${lines(p)}</p>`).join('')}`;
};

const listSection = (s, c) => {
  const items = s.items.map((i) => String(i || '').trim()).filter(Boolean);
  if (!items.length) return '';
  const rows = items.map((item, i) => `<tr>
                      <td width="14" valign="top" style="width:14px;padding:${i ? 9 : 0}px 0 0;${type({ size: 14, line: '1.55', color: c.faint })};">&#8226;</td>
                      <td valign="top" style="padding:${i ? 9 : 0}px 0 0;${type({ size: 14, line: '1.55', color: c.ink })};">${lines(item)}</td>
                    </tr>`).join('');
  return `${sectionTitle(s.title, c)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
};

const tableSection = (s, c) => {
  const rows = s.rows.filter((r) => r.some((cell) => String(cell || '').trim()));
  if (!rows.length) return '';
  const cols = s.columns.length;
  const head = s.columns.some((h) => h.trim())
    ? `<tr>${s.columns.map((h, i) => `<td valign="bottom" style="padding:0 ${i === cols - 1 ? 0 : 12}px 8px 0;border-bottom:1px solid ${c.sheetEdge};${type({ size: 10, line: '1.3', weight: 'bold', color: c.muted, spacing: '1.5px', upper: true })};">${inline(h)}</td>`).join('')}</tr>`
    : '';
  const body = rows.map((r) => `<tr>${r.map((cell, i) => `<td valign="top" style="padding:9px ${i === cols - 1 ? 0 : 12}px 9px 0;border-bottom:1px solid ${c.sheetEdge};${type({ size: 13.5, line: '1.45', weight: i === 0 ? 'bold' : 'normal', color: i === 0 ? c.ink : c.muted })};">${lines(cell)}</td>`).join('')}</tr>`).join('');
  return `${sectionTitle(s.title, c)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${head}${body}</table>`;
};

const mark = (state, c) => {
  if (state === 'attention') return `<span style="${type({ size: 10, line: '1', weight: 'bold', color: c.warn, spacing: '1.5px', upper: true })};">${CHECK_STATES.attention.label}</span>`;
  if (state === 'info') return `<span style="${type({ size: 10, line: '1', weight: 'bold', color: c.faint, spacing: '1.5px', upper: true })};">${CHECK_STATES.info.label}</span>`;
  return `<span style="${type({ size: 10, line: '1', weight: 'bold', color: c.good, spacing: '1.5px', upper: true })};">&#10003; ${CHECK_STATES.pass.label}</span>`;
};

const checklistSection = (s, c) => {
  const items = s.items.filter((i) => i.label.trim());
  if (!items.length) return '';
  const rows = items.map((it, i) => `<tr>
                      <td valign="top" style="padding:${i ? 11 : 0}px 14px ${i === items.length - 1 ? 0 : 11}px 0;${i ? `border-top:1px solid ${c.sheetEdge};` : ''}">
                        <p style="margin:0;${type({ size: 14, line: '1.45', weight: 'bold', color: c.ink })};">${inline(it.label)}</p>
                        ${it.note.trim() ? `<p style="margin:3px 0 0;${type({ size: 13, line: '1.45', color: c.muted })};">${lines(it.note)}</p>` : ''}
                      </td>
                      <td valign="top" align="right" style="padding:${i ? 13 : 2}px 0 0;white-space:nowrap;${i ? `border-top:1px solid ${c.sheetEdge};` : ''}">${mark(it.state, c)}</td>
                    </tr>`).join('');
  return `${sectionTitle(s.title, c)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
};

const workSection = (s, c) => {
  const items = s.items.filter((i) => i.text.trim());
  if (!items.length) return `${sectionTitle(s.title, c)}<p style="margin:0;${type({ size: 14, line: '1.55', color: c.muted })};">Nothing new since the last report.</p>`;
  const rows = items.map((it, i) => `<tr>
                      <td width="64" valign="top" style="width:64px;padding:${i ? 9 : 0}px 12px 0 0;white-space:nowrap;${type({ size: 12, line: '1.7', weight: 'bold', color: c.faint, spacing: '0.5px' })};">${esc(shortDate(it.date))}</td>
                      <td valign="top" style="padding:${i ? 9 : 0}px 0 0;${type({ size: 14, line: '1.55', color: c.ink })};">${lines(it.text)}</td>
                    </tr>`).join('');
  return `${sectionTitle(s.title, c)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
};

// The answer links are small bordered pills, ink on the light card, never
// the accent, so the accent stays the one button in the hero.
// They sit inline in one paragraph rather than in table cells so three
// choices wrap onto a second line on a phone instead of squeezing, and each
// one keeps its words on one line. Outlook on Windows draws no border on an
// inline link and shows them as plain bold links, which still work.
const pill = (url, label, color, edge) => `<a href="${href(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:7px 14px;border:1px solid ${edge};border-radius:999px;white-space:nowrap;${type({ size: 12, line: '1', weight: 'bold', color })};text-decoration:none;">${label}</a>`;

const openItemsSection = (s, c, items, asOf) => {
  if (!items.length) {
    return `${sectionTitle(s.title, c)}<p style="margin:0;${type({ size: 14, line: '1.55', color: c.muted })};">Nothing is waiting on you.</p>`;
  }
  const intro = `<p style="margin:0 0 6px;${type({ size: 13, line: '1.55', color: c.muted })};">Each one stays open until it is answered and carries into every report until then. A tap on approve or deny opens a page with one button, nothing else is needed.</p>`;
  const rows = items.map((it) => {
    const old = ageDays(it.opened_at, asOf) >= 14;
    const kind = ITEM_KINDS[it.kind] ? ITEM_KINDS[it.kind].label : 'decision';
    return `<tr>
                      <td style="padding:16px 0 8px;border-top:1px solid ${c.sheetEdge};">
                        <p style="margin:0;${type({ size: 15, line: '1.4', weight: 'bold', color: c.ink })};">${inline(it.title)}</p>
                        ${String(it.detail || '').trim() ? `<p style="margin:4px 0 0;${type({ size: 13.5, line: '1.5', color: c.muted })};">${lines(it.detail)}</p>` : ''}
                        <p style="margin:8px 0 0;${type({ size: 11, line: '1.4', color: old ? c.warn : c.faint, spacing: '0.5px' })};"><span style="text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;">${esc(kind)}</span> &nbsp;&middot;&nbsp; open since ${esc(shortDate(it.opened_at))}, ${esc(ageLabel(it.opened_at, asOf))}</p>
                        <p style="margin:12px 0 0;line-height:1;">${it.choices.length
    ? it.choices.map((choice, n) => pill(answerLink(it.token, n), inline(choice), c.ink, n === 0 ? c.ink : c.sheetEdge)).join(' ')
    : `${pill(answerLink(it.token, 'approve'), 'Approve', c.ink, c.ink)} ${pill(answerLink(it.token, 'deny'), 'Deny', c.muted, c.sheetEdge)}`}</p>
                      </td>
                    </tr>`;
  }).join('');
  return `${sectionTitle(s.title, c)}${intro}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
};

const sectionsBlock = (doc, c, items) => {
  const cards = doc.sections.map((s) => {
    if (s.type === 'text') return textSection(s, c);
    if (s.type === 'list') return listSection(s, c);
    if (s.type === 'table') return tableSection(s, c);
    if (s.type === 'checklist') return checklistSection(s, c);
    if (s.type === 'work_done') return workSection(s, c);
    if (s.type === 'open_items') return openItemsSection(s, c, items, doc.asOf);
    return '';
  }).filter(Boolean).map((inner) => lightCard(inner, c));
  if (!cards.length) return '';
  const gap = '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>';
  return `<tr>
        <td>
            ${cards.join(`\n            ${gap}\n            `)}
        </td>
      </tr>`;
};

const cardBlock = (card, c) => {
  const url = href(card.url);
  const a = (inner, style) => `<a href="${url}" style="${style};text-decoration:none;">${inner}</a>`;
  const rows = [];
  if (card.kicker.trim()) {
    rows.push(`<p style="margin:0;${type({ size: 10, line: '1.2', weight: 'bold', color: c.cardKicker, spacing: '2px', upper: true })};">${a(inline(card.kicker), `color:${c.cardKicker}`)}</p>`);
    rows.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;"><tr><td width="32" height="3" bgcolor="${c.accent}" style="width:32px;height:3px;background-color:${c.accent};font-size:0;line-height:0;">&nbsp;</td></tr></table>`);
  }
  rows.push(`<p style="margin:${rows.length ? 14 : 0}px 0 0;${type({ size: 20, line: '1.22', weight: 'bold', color: c.cardHead })};">${a(inline(card.title), `color:${c.cardHead}`)}</p>`);
  if (card.line.trim()) rows.push(`<p style="margin:8px 0 0;${type({ size: 14, line: '1.5', color: c.cardLine })};">${a(lines(card.line), `color:${c.cardLine}`)}</p>`);
  rows.push(`<p style="margin:16px 0 0;${type({ size: 11, line: '1.3', weight: 'bold', color: c.cardHead, spacing: '1px' })};">${a(`${esc(pathOf(card.url))} &#8250;`, `color:${c.cardHead}`)}</p>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.card}" style="background-color:${c.card};border-radius:12px;">
              <tr>
                <td style="padding:22px 24px 24px;">
                  ${rows.join('\n                  ')}
                </td>
              </tr>
            </table>`;
};

const cardsBlock = (doc, c) => {
  const cards = doc.cards.filter((card) => card.title.trim() && card.url.trim());
  if (!cards.length) return '';
  const label = doc.cardsLabel.trim()
    ? `<p style="margin:0 0 14px;${type({ size: 11, line: '1.2', weight: 'bold', color: c.muted, spacing: '2px', upper: true })};">${inline(doc.cardsLabel)}</p>`
    : '';
  const gap = '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>';
  return `<tr>
        <td>
            ${label}
            ${cards.map((card) => cardBlock(card, c)).join(`\n            ${gap}\n            `)}
        </td>
      </tr>`;
};

const signatureBlock = (doc, c) => {
  const s = doc.signature;
  const parts = [];
  const lead = s.tagline.trim() || s.subline.trim();
  if (s.tagline.trim()) parts.push(`<p style="margin:0;${type({ size: 17, line: '1.4', weight: 'bold', color: c.link })};">${lines(s.tagline)}</p>`);
  if (s.subline.trim()) parts.push(`<p style="margin:${s.tagline.trim() ? 6 : 0}px 0 0;${type({ size: 14, line: '1.5', color: c.muted })};">${lines(s.subline)}</p>`);
  if (lead) parts.push(hair(c, 22));
  if (s.name.trim()) parts.push(`<p style="margin:${lead ? 20 : 0}px 0 0;${type({ size: 16, line: '1.3', weight: 'bold', color: c.ink })};">${inline(s.name)}</p>`);
  if (s.title.trim()) parts.push(`<p style="margin:3px 0 0;${type({ size: 13, line: '1.3', color: c.muted })};">${inline(s.title)}</p>`);

  const strong = `color:${c.link};text-decoration:none;font-weight:bold;`;
  const dot = ' &middot; ';
  const first = [];
  const tel = telOf(s.phone);
  if (s.phone.trim() && tel) first.push(`<a href="${tel}" style="${strong}">${inline(s.phone)}</a>`);
  if (s.email.trim()) first.push(`<a href="mailto:${href(s.email)}" style="${strong}">${inline(s.email)}</a>`);
  const second = [];
  if (s.siteLabel.trim() && s.siteUrl.trim()) second.push(`<a href="${href(s.siteUrl)}" style="${strong}">${siteMark(s.siteLabel, c)}</a>`);
  if (s.loginLabel.trim() && s.loginUrl.trim()) second.push(`<a href="${href(s.loginUrl)}" style="color:${c.muted};text-decoration:none;">${inline(s.loginLabel)}</a>`);
  const contactRows = [first.join(dot), second.join(dot)].filter(Boolean);
  if (contactRows.length) parts.push(`<p style="margin:14px 0 0;${type({ size: 14, line: '1.9', color: c.muted })};">${contactRows.join('<br>')}</p>`);
  if (s.signoff.trim()) parts.push(`<p style="margin:18px 0 0;${type({ size: 11, line: '1.2', color: c.faint, spacing: '2px', upper: true })};">${inline(s.signoff)}</p>`);

  if (!parts.length) return '';
  return `<tr>
        <td bgcolor="${c.sheet}" style="background-color:${c.sheet};border:1px solid ${c.sheetEdge};border-radius:14px;padding:26px 28px;">
            ${parts.join('\n            ')}
        </td>
      </tr>`;
};

// Invisible characters after a preheader stop the inbox from pulling the
// opening paragraph in behind it.
const PREHEADER_PAD = '&#8199;&#65279;&#847; '.repeat(40);

const textVersion = (doc, items) => {
  const out = [];
  const push = (v) => { const t = String(v || '').trim(); if (t) out.push(t); };
  const join = (arr) => arr.map((v) => String(v || '').trim()).filter(Boolean).join('\n');
  paragraphs(doc.opening).forEach(push);
  const h = doc.hero;
  push(h.kicker);
  push(h.headline);
  push(h.lede);
  if (h.buttonLabel.trim() && h.buttonUrl.trim()) push(`${h.buttonLabel.trim()}\n${h.buttonUrl.trim()}`);
  push(h.codeLine);
  doc.sections.forEach((s) => {
    if (s.type === 'text') push(join([s.title, s.body]));
    if (s.type === 'list') push(join([s.title, ...s.items.filter((i) => i.trim()).map((i) => `• ${i.trim()}`)]));
    if (s.type === 'table') push(join([s.title, s.columns.join('  |  '), ...s.rows.map((r) => r.join('  |  '))]));
    if (s.type === 'checklist') push(join([s.title, ...s.items.filter((i) => i.label.trim()).map((i) => `${CHECK_STATES[i.state].label}  ${i.label.trim()}${i.note.trim() ? `, ${i.note.trim()}` : ''}`)]));
    if (s.type === 'work_done') push(join([s.title, ...s.items.filter((i) => i.text.trim()).map((i) => `${shortDate(i.date)}  ${i.text.trim()}`)]));
    if (s.type === 'open_items') {
      push(join([s.title, items.length ? '' : 'Nothing is waiting on you.']));
      items.forEach((it) => push(join([
        it.title,
        it.detail,
        `open since ${shortDate(it.opened_at)}, ${ageLabel(it.opened_at, doc.asOf)}`,
        ...(it.choices.length
          ? it.choices.map((choice, n) => `${choice} ${answerLink(it.token, n)}`)
          : [`approve ${answerLink(it.token, 'approve')}`, `deny ${answerLink(it.token, 'deny')}`]),
      ])));
    }
  });
  const cards = doc.cards.filter((card) => card.title.trim() && card.url.trim());
  if (cards.length) {
    push(doc.cardsLabel);
    cards.forEach((card) => push(join([card.kicker, card.title, card.line, card.url])));
  }
  const s = doc.signature;
  push(join([s.tagline, s.subline]));
  push(join([
    s.name,
    s.title,
    s.phone,
    s.email,
    s.siteUrl,
    s.loginLabel.trim() && s.loginUrl.trim() ? `${s.loginLabel.trim()} ${s.loginUrl.trim()}` : '',
  ]));
  push(s.signoff);
  return `${out.join('\n\n')}\n`;
};

// Only what the renderer prints, in one fixed order, so the browser and the
// door hand it the same thing however their queries came back.
export const cleanItems = (items) => (Array.isArray(items) ? items : [])
  .filter((it) => it && it.token && String(it.title || '').trim())
  .map((it) => ({
    title: String(it.title),
    detail: String(it.detail || ''),
    kind: String(it.kind || 'decision'),
    opened_at: String(it.opened_at || '').slice(0, 10),
    token: String(it.token),
    choices: (Array.isArray(it.choices) ? it.choices : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4),
  }))
  .sort((a, b) => (a.opened_at === b.opened_at ? a.token.localeCompare(b.token) : a.opened_at.localeCompare(b.opened_at)));

export const renderMail = (input, context = {}) => {
  const doc = normalizeMail(input);
  const c = resolvePalette(doc.theme);
  const items = cleanItems(context.items);
  const subject = doc.subject.trim();
  const preheader = doc.preheader.trim();

  const opening = openingBlock(doc, c);
  const blocks = [opening, heroBlock(doc, c), sectionsBlock(doc, c, items), cardsBlock(doc, c), signatureBlock(doc, c)].filter(Boolean);
  // The opening carries its own 24px foot, every other block is parted by 26.
  const body = blocks.map((b, i) => {
    if (i === 0) return b;
    const prevIsOpening = i === 1 && opening !== '';
    return `${prevIsOpening ? '' : `${spacer(26)}\n      `}${b}`;
  }).join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}</style>
<!--[if mso]><style>table,td,p,a,span{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body bgcolor="${c.ground}" style="margin:0;padding:0;background-color:${c.ground};-webkit-text-size-adjust:100%;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${esc(preheader)}${PREHEADER_PAD}</div>\n` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.ground}" style="background-color:${c.ground};">
  <tr>
    <td align="center" style="padding:28px 14px 40px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;">
      ${body}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>
`;

  return {
    subject,
    preheader,
    html,
    text: textVersion(doc, items),
    hashInput: `${subject}\n${html}`,
  };
};

export default renderMail;
