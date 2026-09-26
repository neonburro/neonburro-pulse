// src/theme/layout.js
// SENTINEL: NB_PULSE_LAYOUT_V3
//
// ── THE INVARIANT, SAME AS THE STUDIO ───────────────────────────────────────
//
//   Content is LEFT ALIGNED, not centred. Every page in Pulse starts on the
//   same x, at every viewport width, and that x is one number.
//
// V1 of AppShell used maxW 1400px with mx auto and a five step gutter
// (base 4, sm 5, md 6, lg 8, xl 10). Two consequences, both bad in a tool
// somebody stares at for six hours a day.
//
//   1. On a wide monitor the whole app drifted to the middle of the screen
//      while the sidebar stayed pinned left, so the gap between the nav and
//      the content grew as the window did.
//   2. Five gutter steps means the left edge of the content moves four times
//      between a phone and a desktop, so nothing ever lines up with anything
//      for long enough to be learned.
//
// One rail. One sheet. Left aligned. Same decision the marketing site made and
// for the same reason, which is that a fixed element can only match a fixed
// left edge.
//
// ── V3, 2026-09-25. THE LAYOUT LAW, IN TYLER'S WORDS ────────────────────────
//
//   "Everything within Pulse needs to be left-aligned and all the same size.
//   Any text within containers or placeholder text shouldn't be hugging the
//   curved line on the left. There should be a little spacing in the
//   placeholder text, but it's left-aligned. It's not going to be full width
//   on everything. Some things will act as if there's a sidebar on the right
//   or something, so it doesn't stretch very far. Everything needs to be
//   left-aligned and all the same format throughout."
//
// V2 had the rail and the sheet and no page read either. Seventeen pages
// each carried their own Container with their own max width, 1500, 1380,
// 1180, 1100, 1040, 960, 900, and their own gutter, and five of them carried
// their own copy of an input style. The tokens below are the four rules
// written as numbers, and src/components/common/Page.jsx is the kit that
// applies them. A page reads the kit. A page does not type a width, a
// gutter, an inset or a font size.
//
//   ONE LEFT EDGE   every page column starts on the rail. mx is 0, never
//                   auto. Nothing inside the column is centred, not a
//                   heading, not an empty state, not a spinner row.
//   ONE MEASURE     the working column is CONTENT wide and stops there, so
//                   a wide monitor reads like there is a sidebar on the
//                   right. Forms and reading text sit on MEASURE. Plates
//                   fill the column, never the screen.
//   ONE INSET       every input, select, textarea and search box carries
//                   INSET on the left and right, so a value or a placeholder
//                   never touches the rounded edge. One placeholder colour.
//                   Buttons carry one height and one padding per size.
//   ONE FORMAT      a page head is kicker, title, lede in that order with
//                   the same gaps. A section is a kicker and a plate or a
//                   table. An empty state is one line in the same place.
//
// ── WHY THE NUMBERS DIFFER FROM THE STUDIO ──────────────────────────────────
// neonburro.com is a magazine and runs a 40px rail against a 1680px sheet.
// Pulse is a tool. It already spends 236px on a sidebar, its rows are dense and
// its readers are working rather than reading, so the rail is tighter and the
// sheet is wider. The SHAPE is identical, the values are tuned.
//
// ── WHY CONTENT IS 1200 ─────────────────────────────────────────────────────
// The widest things on any page are the month grid beside its rail on the
// Calendar (seven cells at 116px plus a 330px rail plus the gap, about 1160)
// and the invoice list row with its six columns. Both fit at 1200 with room.
// On a 1920 monitor with the sidebar open that leaves about 430px of cream on
// the right, which is the phantom sidebar Tyler described. Below 1200 the
// column is the window minus the rail, the same as before.
//
// ── THE THEME READS THIS FILE ───────────────────────────────────────────────
// src/theme/index.js wires INPUT into the default Input, Textarea and Select
// variants and BUTTON into the Button sizes, so a bare <Input> or <Button>
// in a page already carries the law. Do not restate these numbers in a page.
// src/pages/Releases/components/shared.jsx and src/lib/invoiceConstants.js
// re-export from here for the files that still import from them.
//
// No oxford commas, no em dashes.

import colors from './colors';

const P = colors.paper;

// ── the rail ────────────────────────────────────────────────────────────────
export const RAIL = { base: 5, md: 7 };
export const RAIL_PX = { base: 20, md: 28 };

// ── the sheet ───────────────────────────────────────────────────────────────
export const SHEET = '1560px';

// ── the working column, see the note above ──────────────────────────────────
export const CONTENT = '1200px';
export const CONTENT_PX = 1200;

// ── the sidebar ─────────────────────────────────────────────────────────────
export const SIDEBAR_W = '236px';
export const SIDEBAR_W_COLLAPSED = '68px';

// ── the bottom bar ──────────────────────────────────────────────────────────
export const TABBAR_H = '64px';
export const TABBAR_PAD = 'calc(64px + env(safe-area-inset-bottom) + 16px)';

// ── measure, forms and reading text ─────────────────────────────────────────
export const MEASURE = '620px';

// ── rhythm ──────────────────────────────────────────────────────────────────
export const BAND_Y = { base: 6, md: 9 };
export const STACK = { base: 8, md: 12 };
export const PAGE_Y = { base: 6, md: 8 };
export const HEAD_GAP = { base: 7, md: 9 };
export const SECTION_GAP = 4;

// ── the inset, the little spacing inside every rounded edge ─────────────────
// 14px. An input, a select, a textarea, a search box and the text inside a
// plate all sit this far from the curve. Chakra spacing units, 3.5 is 14px.
export const INSET = 3.5;
export const INSET_PX = 14;

// ── the field ───────────────────────────────────────────────────────────────
export const FIELD_H = '44px';
export const FIELD_H_SM = '36px';
export const FIELD_RADIUS = '12px';
export const PLACEHOLDER = P.inkFaint;

// ── the plate ───────────────────────────────────────────────────────────────
export const PLATE_RADIUS = '18px';
export const PLATE_PAD = { base: 4, md: 5 };

// ── motion ──────────────────────────────────────────────────────────────────
export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const FAST = '160ms';
export const SLOW = '260ms';

// ── FLUID TYPE ──────────────────────────────────────────────────────────────
//
// Breakpoint type jumps. At 767px a heading is 26px and at 768px it is 44px, so
// there is one pixel of window width where the whole page reorganises itself.
// Nobody sees that on a phone or on a desktop. Everybody sees it on a tablet, on
// a split screen, and every time somebody drags a window.
//
// fluid() interpolates instead. The value grows continuously between a small
// viewport and the sheet, then stops. Below 380px it holds the minimum so a
// small phone never gets unreadable, above 1560px it holds the maximum so a
// television does not get a headline you can read from the kitchen.
//
// Use it for anything whose size should track the window: headings, hero
// numbers, section titles. Do NOT use it for body copy, labels or table text.
// Those want one size everywhere, because a row of data that changes size as
// you resize the window is a row that is harder to scan, and 14px is 14px for a
// reason at every width.
export const fluid = (min, max, minVw = 380, maxVw = 1560) =>
  `clamp(${min}px, calc(${min}px + ${max - min} * ((100vw - ${minVw}px) / ${maxVw - minVw})), ${max}px)`;

// The scale. Named by job rather than by size, so a component asks for what it
// is instead of guessing a number. A page never types a font size, it names
// the job. If a job is missing add it here, once.
export const TYPE = {
  hero: fluid(30, 60),     // the one number or phrase a page is about
  title: fluid(21, 32),    // page titles
  section: fluid(15, 18),  // sub heads inside a section, modal titles
  figure: fluid(24, 30),   // a stat figure, tabular numerals
  lede: '15px',            // the line under a page title
  body: '14px',            // fixed. see the note above
  small: '13px',
  label: '11px',
  kicker: '10px',          // mono, 500, uppercase, tracked
  micro: '9px',
};

// ── the kicker, one style for every section head and every field label ──────
export const KICKER = {
  fontFamily: 'mono',
  fontSize: TYPE.kicker,
  fontWeight: '500',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: P.inkMuted,
  lineHeight: '1.4',
};

export const FIELD_LABEL = {
  ...KICKER,
  letterSpacing: '0.18em',
  display: 'block',
  mb: 1.5,
};

// ── the field styles, wired into the theme as the default variants ──────────
export const INPUT = {
  bg: P.sheet,
  border: '1px solid',
  borderColor: P.hair,
  borderRadius: FIELD_RADIUS,
  color: P.ink,
  fontSize: TYPE.body,
  h: FIELD_H,
  px: INSET,
  _placeholder: { color: PLACEHOLDER },
  _hover: { borderColor: P.inkFaint },
  _focus: { borderColor: P.limeDeep, boxShadow: 'none', outline: 'none' },
  _focusVisible: { borderColor: P.limeDeep, boxShadow: 'none', outline: 'none' },
  _readOnly: { color: P.inkMuted },
  _disabled: { opacity: 0.55, cursor: 'not-allowed' },
};

export const TEXTAREA = {
  ...INPUT,
  h: 'auto',
  minH: '96px',
  py: 3,
  lineHeight: '1.6',
  resize: 'vertical',
};

// The search box is a field with round ends. Same inset, same height.
export const SEARCH = {
  bg: P.sheet,
  border: '1px solid',
  borderColor: P.hair,
  borderRadius: 'full',
  h: FIELD_H,
  px: INSET,
  color: P.ink,
  _hover: { borderColor: P.inkFaint },
  _focusWithin: { borderColor: P.limeDeep },
};

// ── the button, one height and one padding per size ─────────────────────────
export const BUTTON = {
  xs: { h: '30px', minW: '30px', px: 3, fontSize: TYPE.small },
  sm: { h: FIELD_H_SM, minW: FIELD_H_SM, px: 3.5, fontSize: TYPE.small },
  md: { h: FIELD_H, minW: FIELD_H, px: 4.5, fontSize: TYPE.body },
  lg: { h: '52px', minW: '52px', px: 6, fontSize: TYPE.body },
};

export default {
  RAIL, RAIL_PX, SHEET, CONTENT, CONTENT_PX, SIDEBAR_W, SIDEBAR_W_COLLAPSED,
  TABBAR_H, TABBAR_PAD, MEASURE, BAND_Y, STACK, PAGE_Y, HEAD_GAP, SECTION_GAP,
  INSET, INSET_PX, FIELD_H, FIELD_H_SM, FIELD_RADIUS, PLACEHOLDER,
  PLATE_RADIUS, PLATE_PAD, EASE, FAST, SLOW, fluid, TYPE, KICKER, FIELD_LABEL,
  INPUT, TEXTAREA, SEARCH, BUTTON,
};
