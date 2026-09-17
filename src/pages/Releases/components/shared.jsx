// src/pages/Releases/components/shared.jsx
// SENTINEL: NB_PULSE_SOCIALS_SHARED_V2
//
// One registry for the Socials desk. A voice is the council member speaking.
// An account owner is the identity that publishes. Those ideas used to be one
// field which made it impossible for Lyra to speak through the studio account.
// Keep SOCIAL_CHANNELS aligned with the account panel. Keep AUTOMATIC_CHANNELS
// aligned with netlify/functions/release-social.js in the neonburro repo.
//
// Telegram is the only automatic channel today. X, Instagram and Reddit stay
// on the same calendar but release by hand until their own adapters are real.
// The creative queue belongs to the release so Lyra and the writer see one
// brief, one asset state and one approval record.
//
// No oxford commas, no em dashes.

import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';

export const P = colors.paper;

export const STATUSES = ['idea', 'drafted', 'staged', 'released'];
export const SOCIAL_CHANNELS = ['telegram', 'instagram', 'x', 'reddit'];
export const AUTOMATIC_CHANNELS = ['telegram'];
export const CHANNELS = [
  ...SOCIAL_CHANNELS,
  'site',
  'blog',
  'newsletter',
  'phosphor',
  'shop',
  'pulse',
];
export const VOICES = [
  'warbleur',
  'cypher',
  'lyra',
  'volt',
  'ion',
  'aster',
  'skye',
  'pixel',
  'echo',
  'epoch',
  'tender',
  'kolache',
  'phosphor',
];
export const ACCOUNT_OWNERS = ['neonburro', ...VOICES];

export const ASSET_STATUSES = [
  { value: 'not_needed', label: 'no asset needed' },
  { value: 'needs_lyra', label: 'needs Lyra' },
  { value: 'generating', label: 'in generation' },
  { value: 'ready', label: 'asset ready' },
];

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
export const isSocial = (channel) => SOCIAL_CHANNELS.includes(channel);
export const isAutomatic = (channel) => AUTOMATIC_CHANNELS.includes(channel);
export const assetStatusLabel = (value) => (
  ASSET_STATUSES.find((item) => item.value === value)?.label || 'no asset needed'
);

export const bucketFor = (channel) => (isSocial(channel) ? `social-${channel}` : 'social-site');

const BANNED = [
  'pump',
  'moon',
  '100x',
  '10x',
  'gains',
  'price target',
  'buy now',
  'last chance',
  'undervalued',
  'early',
];
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

const pad = (number) => String(number).padStart(2, '0');

export const dayKey = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const toLocalDate = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dayKey(date);
};

export const toLocalTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const fromLocal = (date, time) => {
  if (!date) return null;
  const value = new Date(`${date}T${time || '12:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
};

export const when = (iso) => {
  if (!iso) return 'undated';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
  <Text
    fontFamily="mono"
    fontSize={TYPE.label}
    letterSpacing="0.14em"
    textTransform="uppercase"
    color={P.inkMuted}
    {...rest}
  >
    {children}
  </Text>
);

export const Field = ({ label, hint, hintColor, children }) => (
  <VStack align="stretch" spacing={1.5}>
    <HStack justify="space-between" align="baseline">
      <Text
        fontFamily="mono"
        fontSize={TYPE.micro}
        fontWeight="600"
        letterSpacing="0.18em"
        textTransform="uppercase"
        color={P.inkMuted}
      >
        {label}
      </Text>
      {hint && (
        <Text fontFamily="mono" fontSize={TYPE.micro} color={hintColor || P.inkFaint}>
          {hint}
        </Text>
      )}
    </HStack>
    {children}
  </VStack>
);

export const VoiceDisc = ({ voice, size = '18px' }) => (
  <Box
    boxSize={size}
    borderRadius="full"
    bg={voiceTint(voice)}
    color={P.sheet}
    display="flex"
    alignItems="center"
    justifyContent="center"
    flexShrink={0}
    fontFamily="mono"
    fontSize={TYPE.micro}
    fontWeight="600"
    textTransform="uppercase"
    lineHeight="1"
  >
    {(voice || '?').slice(0, 1)}
  </Box>
);
