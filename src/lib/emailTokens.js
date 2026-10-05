// src/lib/emailTokens.js
// Single source of truth for colors + assets used in EMAIL HTML.
// Emails cannot read the Chakra theme, so this mirrors the brand palette as raw
// hex for template literals. Edit here to retune every email at once.
//
// ALL emails (client + admin) use one light system: bone surfaces, near-black
// ink, warm brown accents, Topo Lime signal, banana for amounts due.
//
// ── THE WARM-PAPER INVOICE SET (2026-08, sheet + hair + lime* keys) ──────────
// On 2026-10-05 Pulse's own paper in src/theme/colors.js went lighter than
// this set on purpose, the room lighter than the letter. This set did not
// move. See the LIGHTER note there before bringing the two back together.
// The invoice document (invoiceEmailTemplate.js) is a real letterhead now, so
// it uses a brighter, sharper paper than the older banner-led emails: `sheet`
// is the invoice card, `sheet2` the inset panels, `hair`/`hairSoft` the rules,
// `limeInk` the ink that sits ON the lime button, `limeDeep` a lime dark enough
// to read as small text on paper. The older keys (page, card, raised, signal)
// still drive receipts, the admin copy and the invite until those are migrated
// onto this same paper. Keep both until every email matches.

export const EMAIL = {
  // Signal — Topo Lime (replaced cyan #00E5E5 everywhere)
  signal:       '#C5D957',
  signalDeep:   '#A6B84A',  // for text on light, passes contrast better

  // Accents
  banana:     '#FFE500',
  bananaDeep: '#9A8B00',  // banana text on light (legible)
  coral:      '#C2402F',  // overdue / destructive on light

  // Funding-mode colors (legible on light surfaces)
  fundFull:    '#6F8A1F',  // Fund in Full (deep lime, readable on bone)
  fundDeposit: '#9A7B00',  // 50% to Start (deep banana)
  fundConfirm: '#6B5245',  // Confirm Scope (burro hide brown)

  // Light surfaces — older banner-led emails
  page:     '#E7DFD1',  // Ridge Bone, the outer mat behind the sheet
  card:     '#F3EDE3',  // Sun Paper, older card
  raised:   '#FFFFFF',  // inner panels
  line:     '#DDD2C2',  // Ivory Dust, borders
  lineSoft: '#EBE3D6',  // faint inner rules

  // Warm-paper invoice set
  sheet:    '#FBF9F4',  // the invoice card, brighter warm white
  sheet2:   '#F5F0E6',  // inset panels (totals hero, CTA, footer)
  hair:     '#E4DBCB',  // sprint + section rules
  hairSoft: '#EFE9DC',  // faintest inner rules
  limeInk:  '#3A4319',  // ink that sits on the lime button (brand.900)
  limeDeep: '#6E7A30',  // lime dark enough to read as small text on paper

  // Ink (text) — warm near-blacks and browns
  ink:      '#241A16',  // Night Tack, primary
  inkSec:   '#4A382F',  // Canyon Stitch, secondary
  inkMuted: '#6B5245',  // Burro Hide, labels/muted
  inkFaint: '#9A8574',  // faintest meta

  // Brand assets
  banner: 'https://pulse.neonburro.com/neon-burro-email-banner.png',
  logo:   'https://pulse.neonburro.com/neon-burro-email-logo.png',
};

export default EMAIL;
