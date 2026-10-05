// src/theme/colors.js
// NeonBurro Pulse — unified palette, aligned to the marketing repo.
// SENTINEL: NB_PULSE_COLORS_V2
//
// Discipline mirrors the marketing colors.js: the existing surface/brand/accent
// /status/text/divider keys keep their SHAPE so no component breaks. Values are
// repainted (cyan -> Topo Lime, cool -> slightly warmed near-black). Marketing
// aliases (accent.signal, brown ramp, alpenglow) are ADDED on top, opt-in.

const colors = {
  // Brand — repainted from cyan #00E5E5 to Topo Lime. Every brand.500 read in
  // the app now resolves to lime: buttons, focus, active rails, online dots.
  brand: {
    50:  '#F7FAE8',
    100: '#EEF5CC',
    200: '#E2EDA6',
    300: '#D6E588',
    400: '#D2E26B',  // hover / lit  (was cyan 400)
    500: '#C5D957',  // PRIMARY Topo Lime (was #00E5E5)
    600: '#A6B84A',  // pressed / dim
    700: '#85953A',
    800: '#5E6B29',
    900: '#3A4319',
  },

  // Surface — kept near-black for a data tool, warmed a few degrees toward the
  // marketing browns so it reads as the same family, not a cold clone.
  surface: {
    50:  '#FAF9F7',
    100: '#F5F3F0',
    200: '#E6E3DE',
    300: '#D4D0C9',
    400: '#A3A09A',
    500: '#757370',   // muted label text
    600: '#525049',
    700: '#403E39',   // borders / dividers strong
    800: '#252420',   // hover / active
    850: '#1C1B18',   // elevated cards, modals
    900: '#141312',   // cards
    950: '#0B0B0A',   // canvas (matches marketing surface.base #0B0B0C)
  },

  // Accent — neon repainted to Topo Lime so "live/active/funded" reads green
  // like the marketing online signal. banana kept for pending/impersonation,
  // coral for destructive, purple for messages, etc.
  accent: {
    neon:   '#C5D957',  // success / active / live / funded  (was #39FF14)
    banana: '#FFE500',  // warnings / pending / impersonation
    coral:  '#FF3366',  // destructive / errors / overdue
    purple: '#8B5CF6',  // messages / communication
    cool:   '#6C6F97',  // info  (was #00B8E6, now marketing Horizon Relay)
    warm:   '#C8893B',  // reserved, warm  (marketing-aligned amber)

    // Marketing alias. Topo Lime as the explicit live signal. New work reads
    // accent.signal so the intent ("this is the online color") is legible.
    signal:       '#C5D957',
    signalBright: '#D2E26B',
    signalDim:    '#A6B84A',
  },

  // Status — green pair repainted to lime to match. Muted pairs warmed slightly.
  status: {
    green:      '#C5D957',
    greenMuted: '#2A3017',
    gold:       '#FFE500',
    goldMuted:  '#3D3520',
    red:        '#FF3366',
    redMuted:   '#4A1A2A',
    blue:       '#6C6F97',
    blueMuted:  '#22232F',
    purple:     '#8B5CF6',
    purpleMuted:'#2D2640',
    gray:       '#808080',
    grayMuted:  '#252420',
  },

  text: {
    primary:   '#F4F3F1',   // matches marketing text.primary
    secondary: 'rgba(244,243,241,0.65)',
    tertiary:  'rgba(244,243,241,0.45)',
    muted:     'rgba(244,243,241,0.30)',
    deepMuted: 'rgba(244,243,241,0.15)',
  },

  divider: {
    soft:   'rgba(244,243,241,0.06)',
    medium: 'rgba(244,243,241,0.10)',
    accent: 'rgba(197,217,87,0.15)',  // lime, was cyan
  },

  // ---- MARKETING-ALIGNED ADDITIONS (opt-in, additive) ----
  // Burro material ramp, identical to marketing. For warm accents, avatars,
  // editorial tile tints, hero moments. Not for the working canvas.
  brown: {
    900: '#241A16',
    800: '#4A382F',
    700: '#6B5245',
    600: '#8A6857',
    500: '#A8846E',
    400: '#C39D7F',
  },

  // Alpenglow warm-light surfaces, identical to marketing. The earlier draft of
  // a light system, kept for reference. The Paper system below supersedes it as
  // the go-forward look for Pulse, tuned to the invoice document.
  alpenglow: {
    base:   '#F3EDE3',
    raised: '#DDD2C2',
    sunken: '#E8E0D4',
    ink:    '#241A16',
    inkSecondary: '#4A382F',
    inkMuted: '#6B5245',
  },

  // ── THE PAPER SYSTEM, THE LIGHT ENVIRONMENT PULSE IS BECOMING ──────────────
  //
  // What this place looks like, in one paragraph: warm cream paper, dark warm
  // ink, one lime accent, no cold white anywhere. The darkest surface you ever
  // paint is `mat`, a cream, and light rises from there to `sheet`. Content is
  // dark ink on cream so contrast is always high and the room feels calm and lit
  // rather than glowing in the dark. This is the same paper the invoice document
  // uses (src/lib/emailTokens.js, the sheet and hair and lime keys), so the tool
  // and the thing it sends a client are one material.
  //
  // How to reach for it:
  //   grounds   mat is the page, sheet is a card, sunken is a well inside a card
  //   rules     hair for a real divider, hairSoft for a whisper
  //   ink       ink primary, inkSec supporting, inkMuted labels, inkFaint meta
  //   accent    lime once per view, limeDeep when lime has to be small text on
  //             cream, limeInk when text sits ON a lime fill
  //   status    gold pending, coral overdue and destructive, green paid
  //
  // Rules of the room, same spirit as the marketing site:
  //   never pure #FFFFFF, the brightest is sheet #FBF9F4, a warm near white
  //   lime is spent ONCE per screen, everything else is ink on paper
  //   on a phone there are no containers around content, the cream is the frame
  //
  // Pages convert to this one at a time. The login page is the first. Until a
  // given authed page is converted it still reads the dark surface/text tokens
  // above, both are valid while the migration is underway.
  //
  // ── V5, 2026-10-05, LIGHTER PAPER AND INK THAT POPS ───────────────────────
  // Tyler, that day: "make better contrast and easier to read things. Maybe
  // the cream becomes a little lighter, so the dark text pops more." V4 had
  // the ground at E7DFD1 and the faint meta at 9A8574, which measured 2.9 to 1
  // on that ground, under the 4.5 any reading text needs, and it was used for
  // dates, counts and hints all over the tool. V5 lifts every surface onto the
  // invoice document's own warm paper set (src/lib/emailTokens.js sheet,
  // sheet2, hair and hairSoft), so the tool and the thing it sends are one
  // material again, and darkens the two lighter inks until both pass.
  //
  //   token     V4        V5        on the new mat
  //   mat       E7DFD1    F0EBE1    the ground, still a cream and never white
  //   sheet     F4EEE2    FBF9F4    the document's sheet exactly
  //   sunken    EDE6D7    F5F0E6    the document's sheet2
  //   hair      E1D7C6    E4DBCB    the document's hair
  //   hairSoft  EBE3D4    EFE9DC    the document's hairSoft
  //   inkMuted  6B5245    5E473B    labels, about 7.5 to 1
  //   inkFaint  9A8574    7A6556    meta, about 4.6 to 1, was 2.9
  //
  // ink and inkSec did not move, they were never the problem. The email
  // tokens did not move either, a client's inbox is unchanged. If the mat is
  // ever taken back toward E7DFD1, re-measure inkFaint against it.
  paper: {
    mat:      '#F0EBE1',  // page ground, a light warm cream, never white
    sheet:    '#FBF9F4',  // cards and surfaces, the document's sheet, NEVER #FFF
    sunken:   '#F5F0E6',  // inset panels and wells, the document's sheet2
    hair:     '#E4DBCB',  // borders and real rules
    hairSoft: '#EFE9DC',  // faintest inner rules

    ink:      '#241A16',  // Night Tack, primary text
    inkSec:   '#4A382F',  // Canyon Stitch, supporting text
    inkMuted: '#5E473B',  // Burro Hide, a step darker, labels
    inkFaint: '#7A6556',  // faintest meta, still passes 4.5 to 1 on mat

    lime:     '#C5D957',  // the one accent, Topo Lime
    limeDeep: '#6E7A30',  // lime dark enough to read as small text on cream
    limeInk:  '#3A4319',  // ink that sits on a lime fill

    gold:     '#9A7B00',  // pending, waiting
    coral:    '#C2402F',  // overdue, destructive
    green:    '#5E7A1E',  // paid, positive
  },

  // ── CHROME, THE DARK ROUNDED RECTANGLES ────────────────────────────────────
  // The whole tool is two colors now: cream and ONE dark, the same near-black warm
  // ink that sets bold text (paper.ink #241A16). Everything is cream except the
  // sidebar on desktop and the bottom pill on a phone, and those two are dark
  // rounded rectangles floating on the cream. So chrome.ground IS the ink. Text on
  // it is a warm cream, never white. Lime stays the one accent, on the active nav
  // item only. Read by AppShell, Sidebar and MobileNav.
  chrome: {
    ground:    '#241A16',  // the ink, the floating dark rectangles (sidebar, pill)
    raised:    '#3A2C22',  // hover and active nav surface on the dark rectangle
    line:      '#3E2F25',  // hairline on the dark rectangle
    text:      '#EFE7DA',  // warm cream text on the dark rectangle, never white
    textMuted: '#A2937F',  // muted nav label
    textFaint: '#7A6B58',  // faint meta on the dark rectangle
  },
};

export default colors;
