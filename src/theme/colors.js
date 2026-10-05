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
  // LIGHTER, 2026-10-05. Tyler: "make the cream color just a lot lighter, so
  // there's better contrast", then "even lighter ... or something else that you
  // recommend for contrast". Two moves, measured, not guessed:
  //   the paper rose two steps. ground #E7DFD1 to #F7F5F0, cards #F4EEE2 to
  //   #FDFCF9, wells #EDE6D7 to #F2EEE7, still warm, still never #FFFFFF
  //   the quiet text went darker, because on any cream the weak spot was never
  //   the ink (15.6 to 1 now) but the labels. Against the new ground inkMuted
  //   #6B5245 to #5C4A3F (7.7), inkFaint #9A8574 to #7A695D (4.8, was 3.2),
  //   limeDeep to #5E6928, gold to #7E6400, green to #566F1B, coral to #B83B2B.
  //   Every text color now clears 4.5 to 1 on mat, sheet and sunken alike.
  // The invoice paper in src/lib/emailTokens.js did NOT move with it, emails
  // still render on their own sheet #FBF9F4. The two papers were one material
  // until this day and are deliberately apart now, the room lighter than the
  // letter. Bring the letter up in its own sitting if Tyler asks, with the
  // auth templates in scripts/auth-email-templates.mjs, which read it.
  //
  // Pages convert to this one at a time. The login page is the first. Until a
  // given authed page is converted it still reads the dark surface/text tokens
  // above, both are valid while the migration is underway.
  paper: {
    mat:      '#F7F5F0',  // page ground, a light warm paper (was #E7DFD1)
    sheet:    '#FDFCF9',  // cards and surfaces, the warm near white, NEVER #FFFFFF
    sunken:   '#F2EEE7',  // inset panels and wells, a step below the ground
    hair:     '#E5DFD4',  // borders and real rules
    hairSoft: '#EEEAE2',  // faintest inner rules

    ink:      '#241A16',  // Night Tack, primary text
    inkSec:   '#4A382F',  // Canyon Stitch, supporting text
    inkMuted: '#5C4A3F',  // Burro Hide, labels, darkened 2026-10-05 for contrast
    inkFaint: '#7A695D',  // faintest meta, still 4.5 to 1 on every ground

    lime:     '#C5D957',  // the one accent, Topo Lime
    limeDeep: '#5E6928',  // lime dark enough to read as small text on paper
    limeInk:  '#3A4319',  // ink that sits on a lime fill

    gold:     '#7E6400',  // pending, waiting
    coral:    '#B83B2B',  // overdue, destructive
    green:    '#566F1B',  // paid, positive
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
