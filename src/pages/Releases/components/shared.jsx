// src/pages/Releases/components/shared.jsx
// SENTINEL: NB_PULSE_SOCIALS_SHARED_V3
//
// One registry for the Socials desk. A voice is the council member speaking.
// An account owner is the identity that publishes. Those ideas used to be one
// field which made it impossible for Lyra to speak through the studio account.
// Keep SOCIAL_CHANNELS aligned with the account panel. Keep AUTOMATIC_CHANNELS
// aligned with the two posting hands, netlify/functions/release-social.js in
// the neonburro repo for telegram and netlify/functions/release-meta.js in
// this repo for facebook and instagram.
//
// Telegram, facebook and instagram are the automatic channels. Facebook and
// instagram are dark until META_PAGE_ACCESS_TOKEN, META_PAGE_ID and
// META_IG_USER_ID exist on the Pulse site, the account rows stay off until
// then and the drawer refuses approval on an account that is off. X and
// reddit stay on the same calendar and release by hand.
//
// The channel tints are for the month calendar pips and nothing else. They
// are quiet on cream, distinct from each other, from the voice tints and from
// lime, which the page spends on the today disc and the add button. The
// shapes and formats are what Meta actually renders and accepts, feed 1.91 to
// 1 or square for a Page and square or four by five for Instagram. Instagram
// takes jpeg only. The picker reads the real pixels of the picked plate and
// says so, this file only holds the rules.
//
// No oxford commas, no em dashes.

import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';

export const P = colors.paper;

export const STATUSES = ['idea', 'drafted', 'staged', 'released'];
export const SOCIAL_CHANNELS = ['telegram', 'facebook', 'instagram', 'x', 'reddit'];
export const AUTOMATIC_CHANNELS = ['telegram', 'facebook', 'instagram'];
export const META_CHANNELS = ['facebook', 'instagram'];
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

// Character rails are the hard limits the channels enforce. The house rails
// for facebook and instagram are words and hashtags, see below. The drawer
// shows both. draft-release.js enforces the same numbers on its own
// output, change them in both places.
export const LIMITS = { x: 280, telegram: 4096, instagram: 2200, facebook: 63206 };
export const WORD_LIMITS = { facebook: 120 };
export const HASHTAG_LIMITS = { facebook: 0, instagram: 3 };

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

export const CHANNEL_TINT = {
  telegram: { accent: '#2E6E6E', tint: 'rgba(46,110,110,0.11)' },
  facebook: { accent: '#3A5A9A', tint: 'rgba(58,90,154,0.11)' },
  instagram: { accent: '#9A4A7A', tint: 'rgba(154,74,122,0.11)' },
  x: { accent: '#241A16', tint: 'rgba(36,26,22,0.09)' },
  reddit: { accent: '#C2562F', tint: 'rgba(194,86,47,0.11)' },
  site: { accent: '#6B5245', tint: 'rgba(107,82,69,0.10)' },
  blog: { accent: '#6B5245', tint: 'rgba(107,82,69,0.10)' },
  newsletter: { accent: '#9A7B00', tint: 'rgba(154,123,0,0.11)' },
  phosphor: { accent: '#3C8A6B', tint: 'rgba(60,138,107,0.11)' },
  shop: { accent: '#8F6A17', tint: 'rgba(143,106,23,0.11)' },
  pulse: { accent: '#4A382F', tint: 'rgba(74,56,47,0.10)' },
};

// What Meta renders. w and h are the pixels the channel shows, the picker
// draws a frame at that ratio and lays the real plate inside it with cover.
export const SHAPES = {
  facebook: [
    { id: 'feed', label: 'feed 1200 by 630', w: 1200, h: 630 },
    { id: 'square', label: 'square 1080', w: 1080, h: 1080 },
  ],
  instagram: [
    { id: 'square', label: 'square 1080', w: 1080, h: 1080 },
    { id: 'portrait', label: 'portrait 1080 by 1350', w: 1080, h: 1350 },
    { id: 'landscape', label: 'landscape 1080 by 566', w: 1080, h: 566 },
  ],
};

// What Meta accepts by url. Facebook lists jpg png gif bmp and tiff, webp is
// not on the list. Instagram takes jpeg and nothing else.
export const FORMATS = {
  facebook: ['jpg', 'png', 'gif'],
  instagram: ['jpg'],
};

export const voiceTint = (voice) => VOICE_TINT[voice] || P.inkMuted;
export const channelTint = (channel) => CHANNEL_TINT[channel] || CHANNEL_TINT.site;
export const isSocial = (channel) => SOCIAL_CHANNELS.includes(channel);
export const isAutomatic = (channel) => AUTOMATIC_CHANNELS.includes(channel);
export const isMeta = (channel) => META_CHANNELS.includes(channel);
export const assetStatusLabel = (value) => (
  ASSET_STATUSES.find((item) => item.value === value)?.label || 'no asset needed'
);

export const bucketFor = (channel) => (isSocial(channel) ? `social-${channel}` : 'social-site');

// A picked plate is either a public url on neonburro.com, stored whole in
// asset_path with no bucket, or an object in a Pulse bucket. This tells the
// two apart, the posting hands do the same in netlify/functions/_social.js.
export const isPublicUrl = (path) => /^https?:\/\//i.test(String(path || ''));

export const formatOf = (path) => {
  const clean = String(path || '').split('?')[0].split('#')[0];
  const ext = (clean.split('.').pop() || '').toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
};

export const hashtags = (body) => (
  String(body || '').match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []
).map((tag) => tag.trim());

export const countWords = (body) => {
  const text = String(body || '').trim();
  return text ? text.split(/\s+/).length : 0;
};

// The picker's verdict on a plate for a channel, from the real pixels.
// fit is exact, crop or wrong. Instagram accepts ratios from four by five up
// to 1.91 to 1 and refuses wider. Facebook shows a feed photo at its own
// ratio but a plate wider than 1.91 loses its sides in the feed crop.
export const shapeVerdict = (channel, width, height) => {
  if (!width || !height) return { fit: 'unknown', text: 'size not read yet' };
  const ratio = width / height;
  const near = (target) => Math.abs(ratio - target) < 0.025;
  const size = `${width} by ${height}`;

  if (channel === 'instagram') {
    if (near(1)) return { fit: 'exact', text: `${size}, square, posts as is` };
    if (near(0.8)) return { fit: 'exact', text: `${size}, four by five, posts as is` };
    if (near(1.91)) return { fit: 'exact', text: `${size}, landscape 1.91 to 1, posts as is` };
    if (ratio > 1.91) return { fit: 'wrong', text: `${size} is wider than 1.91 to 1, instagram refuses it. ask for a square or a 1200 by 630 cut` };
    if (ratio < 0.8) return { fit: 'wrong', text: `${size} is taller than four by five, instagram refuses it` };
    return { fit: 'crop', text: `${size} sits between the frames, instagram posts it at this ratio` };
  }

  if (channel === 'facebook') {
    if (near(1.905)) return { fit: 'exact', text: `${size}, the feed frame, posts as is` };
    if (near(1)) return { fit: 'exact', text: `${size}, square, posts as is` };
    if (ratio > 1.95) return { fit: 'crop', text: `${size} is wider than the feed frame, the sides fall away in the feed` };
    if (ratio < 0.8) return { fit: 'crop', text: `${size} is tall, the feed shows the middle` };
    return { fit: 'crop', text: `${size}, facebook shows it at this ratio with a little crop in the feed` };
  }

  return { fit: 'exact', text: size };
};

export const formatVerdict = (channel, path) => {
  const format = formatOf(path);
  const allowed = FORMATS[channel];
  if (!allowed || !format) return null;
  if (allowed.includes(format)) return null;
  if (channel === 'instagram') return `instagram takes jpeg only and this is ${format}. the share cards are jpg, or ask skye for a jpg cut`;
  return `facebook lists jpg png and gif, this is ${format}. the first post will tell`;
};

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
