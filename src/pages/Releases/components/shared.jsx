// src/pages/Releases/components/shared.jsx
// SENTINEL: NB_PULSE_RELEASES_SHARED_V1
//
// The lists and the small parts every piece of the Releases page reads. One
// file so the timeline, the drawer, the shelves and the accounts panel agree
// on what a channel is, who the voices are and what colour a burro wears.
//
// ── THE LISTS ───────────────────────────────────────────────────────────────
// CHANNELS is a suggestion list, the column is free text on purpose (see
// supabase/migrations/2026082901_releases.sql). POSTING is the subset the
// release-social function carries. A row on one of those channels stops at
// staged under the pip and the function moves it to released or failed, so
// the page and netlify/functions/release-social.js must agree on this list.
// VOICES is the fixed thirteen. Seed rows carry gauge and latch, the picker
// keeps an unknown voice as an extra option rather than wiping it.
//
// ── THE WORD RAIL ───────────────────────────────────────────────────────────
// The studio does not talk about the coin's price, anywhere, ever. wordRail
// reads a body and returns the word that breaks the rule or null. The dollar
// test is the same regex the function uses as its last rail, forty
// characters either side of NEONBURRO. The banned list applies only when
// the body mentions the coin, that is the page's contract. The function's
// regex is wider, it refuses the banned words without a mention, so a body
// that says moon over the reservoir passes here and fails there. Flagged in
// the hand off, not silently widened here.
//
// ── COLOUR BY VOICE ─────────────────────────────────────────────────────────
// Thirteen tints, each dark enough to hold a cream letter and to read as a
// rule on the cream mat. None of them is the lime, the lime is spent on the
// add button. warbleur wears limeDeep because he is the origin.
//
// No oxford commas, no em dashes.

import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';

export const P = colors.paper;

export const STATUSES = ['idea', 'drafted', 'staged', 'released'];
export const CHANNELS = ['site', 'x', 'instagram', 'reddit', 'telegram', 'blog', 'newsletter', 'phosphor', 'shop', 'pulse'];
export const POSTING = ['telegram', 'x', 'instagram', 'reddit'];
export const VOICES = ['warbleur', 'cypher', 'lyra', 'volt', 'ion', 'aster', 'skye', 'pixel', 'echo', 'epoch', 'tender', 'kolache', 'phosphor'];

// characters per channel. reddit carries the title only, so no body limit.
export const LIMITS = { x: 280, telegram: 4096, instagram: 2200 };

export const STATUS_TINT = {
  idea: P.inkFaint,
  drafted: P.gold,
  staged: P.limeDeep,
  released: P.green,
  failed: P.coral,
};

export const VOICE_TINT = {
  warbleur: '#6E7A30',
  cypher: '#2F6B5E',
  lyra: '#8A4A7A',
  volt: '#B0731E',
  ion: '#3E5C9A',
  aster: '#C2402F',
  skye: '#4F7FA3',
  pixel: '#7A5CC2',
  echo: '#5E6B29',
  epoch: '#8F6A17',
  tender: '#A0524A',
  kolache: '#9A7B00',
  phosphor: '#3C8A6B',
};

export const voiceTint = (voice) => VOICE_TINT[voice] || P.inkMuted;

export const isPosting = (channel) => POSTING.includes(channel);

// the bucket a channel keeps its pictures in. matches the five buckets in
// supabase/migrations/2026091202_social_timeline.sql.
export const bucketFor = (channel) => (isPosting(channel) ? `social-${channel}` : 'social-site');

const BANNED = ['pump', 'moon', '100x', '10x', 'gains', 'price target', 'buy now', 'last chance', 'undervalued', 'early'];
const MENTION = /neonburro/i;
const DOLLAR_NEAR = /NEONBURRO[^.\n]{0,40}\$|\$[^.\n]{0,40}NEONBURRO/i;

export const wordRail = (body) => {
  const text = String(body || '');
  if (!MENTION.test(text)) return null;
  if (DOLLAR_NEAR.test(text)) return 'a dollar sign next to NEONBURRO';
  for (const word of BANNED) {
    const re = new RegExp(`(^|[^a-z0-9])${word.replace(/\s+/g, '\\s+')}(?![a-z0-9])`, 'i');
    if (re.test(text)) return word;
  }
  return null;
};

// ── dates. the column is timestamptz, the inputs are local ──────────────────
const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toLocalDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dayKey(d);
};

export const toLocalTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocal = (date, time) => {
  if (!date) return null;
  const d = new Date(`${date}T${time || '12:00'}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const when = (iso) => {
  if (!iso) return 'undated';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── the small parts ─────────────────────────────────────────────────────────
export const inputProps = {
  bg: P.sheet,
  border: '1px solid',
  borderColor: P.hair,
  borderRadius: '12px',
  color: P.ink,
  fontSize: TYPE.body,
  h: '42px',
  px: 3.5,
  _placeholder: { color: P.inkFaint },
  _hover: { borderColor: P.inkFaint },
  _focus: { borderColor: P.limeDeep, boxShadow: 'none', outline: 'none' },
};

export const Kicker = ({ children, ...rest }) => (
  <Text fontFamily="mono" fontSize={TYPE.label} letterSpacing="0.14em" textTransform="uppercase" color={P.inkMuted} {...rest}>
    {children}
  </Text>
);

export const Field = ({ label, hint, hintColor, children }) => (
  <VStack align="stretch" spacing={1.5}>
    <HStack justify="space-between" align="baseline">
      <Text fontFamily="mono" fontSize={TYPE.micro} fontWeight="600" letterSpacing="0.18em" textTransform="uppercase" color={P.inkMuted}>
        {label}
      </Text>
      {hint && <Text fontFamily="mono" fontSize={TYPE.micro} color={hintColor || P.inkFaint}>{hint}</Text>}
    </HStack>
    {children}
  </VStack>
);

// one letter of the burro on a disc of their tint. the timeline card, the
// row and the accounts panel all wear it.
export const VoiceDisc = ({ voice, size = '18px' }) => (
  <Box boxSize={size} borderRadius="full" bg={voiceTint(voice)} color={P.sheet}
    display="flex" alignItems="center" justifyContent="center" flexShrink={0}
    fontFamily="mono" fontSize={TYPE.micro} fontWeight="600" textTransform="uppercase" lineHeight="1">
    {(voice || '?').slice(0, 1)}
  </Box>
);
