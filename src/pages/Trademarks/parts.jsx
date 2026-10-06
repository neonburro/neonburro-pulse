// src/pages/Trademarks/parts.jsx
// SENTINEL: NB_PULSE_TRADEMARKS_PARTS_V2
//
// The small pieces the list, the word and the mark views share. Built to the
// Claude settings pattern Tyler pointed at on 2026-10-05: quiet rows on
// hairlines, a label on the left and its control or value on the right, small
// muted heads, status in words. No cards inside cards.
//
// ── THE ELECTRICITY ─────────────────────────────────────────────────────────
// Tyler asked for "a little bit of electricity, pulse feel". It is spent in
// two places and nowhere else. PulseLine is a hairline that carries a short
// lime spark across while the register or TSDR is being read, so the wait
// looks like a current and not a spinner. LiveDot is the small dot on a word
// the night reads, breathing slowly in the deep lime that is allowed as small
// marks on paper. Lime proper stays the page's one primary button, and the
// spark only runs while that button is already busy.
//
// ── THE TONES ───────────────────────────────────────────────────────────────
// A date that could set a mark free is GREEN, because for somebody who wants
// the word it is good news. A running clock is gold, the paper's pending
// colour. Coral is kept for taken and for errors. Kept and gone are faint,
// they are the record and not the news.
//
// No oxford commas, no em dashes.

import { Box, HStack, VStack, Text, Icon, Link, keyframes } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { TbChevronRight, TbExternalLink } from 'react-icons/tb';
import colors from '../../theme/colors';
import { TYPE, KICKER, EASE, FAST } from '../../theme/layout';
import { day, shortDay, TONE_WORD } from '../../lib/trademarkWatch';

const P = colors.paper;

export const TONE = {
  free: P.green, look: P.ink, watch: P.gold, soon: P.inkMuted, kept: P.inkFaint, gone: P.inkFaint,
};
export const VERDICT_TONE = { clear: P.green, dead: P.gold, taken: P.coral };

export const Head = ({ children, ...rest }) => (
  <Text {...KICKER} color={P.inkMuted} {...rest}>{children}</Text>
);

const spark = keyframes`
  0% { transform: translateX(-30%); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateX(330%); opacity: 0; }
`;

export const PulseLine = ({ on, ...rest }) => (
  <Box position="relative" h="1px" bg={P.hair} overflow="hidden" {...rest}>
    {on && (
      <Box
        position="absolute"
        top="-1px"
        left={0}
        h="3px"
        w="30%"
        borderRadius="full"
        bg={`linear-gradient(90deg, transparent, ${P.lime}, transparent)`}
        boxShadow={`0 0 8px ${P.lime}`}
        animation={`${spark} 1.4s ${EASE} infinite`}
      />
    )}
  </Box>
);

const breathe = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
`;

export const LiveDot = ({ title = 'the night reads this word', ...rest }) => (
  <Box
    as="span"
    title={title}
    display="inline-block"
    w="6px"
    h="6px"
    borderRadius="full"
    bg={P.limeDeep}
    animation={`${breathe} 3.2s ease-in-out infinite`}
    flexShrink={0}
    {...rest}
  />
);

export const Crumbs = ({ items }) => (
  <HStack spacing={1.5} flexWrap="wrap" rowGap={1} fontSize={TYPE.small}>
    {items.map((item, i) => (
      <HStack key={`${item.label}-${i}`} spacing={1.5}>
        {i > 0 && <Text color={P.inkFaint} aria-hidden="true">/</Text>}
        {item.to ? (
          <Link
            as={RouterLink}
            to={item.to}
            color={P.inkMuted}
            fontFamily={item.mono ? 'mono' : undefined}
            _hover={{ color: P.ink, textDecoration: 'none' }}
          >
            {item.label}
          </Link>
        ) : (
          <Text color={P.ink} fontWeight="600" fontFamily={item.mono ? 'mono' : undefined} noOfLines={1}>{item.label}</Text>
        )}
      </HStack>
    ))}
  </HStack>
);

// A row that goes somewhere. The whole row is the link, a chevron says so.
export const RowLink = ({ to, state, onClick, children, ...rest }) => (
  <Box
    as={RouterLink}
    to={to}
    state={state}
    onClick={onClick}
    display="flex"
    alignItems="center"
    gap={3}
    py={3}
    px={1}
    mx={-1}
    borderRadius="10px"
    borderTop="1px solid"
    borderColor={P.hairSoft}
    transition={`background ${FAST} ${EASE}`}
    _hover={{ bg: P.sunken, '& .nb-chev': { color: P.ink, transform: 'translateX(2px)' } }}
    {...rest}
  >
    <Box flex={1} minW={0}>{children}</Box>
    <Icon className="nb-chev" as={TbChevronRight} boxSize={4} color={P.inkFaint} flexShrink={0} transition={`all ${FAST} ${EASE}`} />
  </Box>
);

export const MarkRow = ({ m, to, state }) => (
  <RowLink to={to} state={state}>
    <HStack align="start" spacing={3}>
      <Box w="8px" h="8px" mt="7px" borderRadius="full" flexShrink={0} bg={m.alive ? P.coral : P.hair} />
      <VStack align="start" spacing={0.5} minW={0} flex={1}>
        <HStack spacing={2} flexWrap="wrap" rowGap={0}>
          <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{m.mark || 'no words in this mark'}</Text>
          <Text fontSize={TYPE.small} color={m.alive ? P.coral : P.inkMuted}>{m.status}</Text>
          {m.classes?.length > 0 && (
            <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint}>class {m.classes.join(', ')}</Text>
          )}
        </HStack>
        <Text fontSize={TYPE.small} color={P.inkSec} noOfLines={1}>{m.owner || 'owner not listed'}</Text>
        <Text fontSize={TYPE.label} color={P.inkFaint}>
          serial {m.serial}{m.filed ? ` · filed ${shortDay(m.filed)} ${m.filed.slice(0, 4)}` : ''}{m.registered ? ` · registered ${m.registered.slice(0, 4)}` : ''}
        </Text>
      </VStack>
    </HStack>
  </RowLink>
);

export const MomentLine = ({ x, to, state, showMark = true }) => {
  const body = (
    <HStack align="start" spacing={3}>
      <Box w="8px" h="8px" mt="6px" borderRadius="full" flexShrink={0} bg={TONE[x.tone]} />
      <VStack align="start" spacing={0.5} minW={0} flex={1}>
        <HStack spacing={2} flexWrap="wrap" rowGap={0}>
          <Text fontFamily="mono" fontSize={TYPE.label} fontWeight="600" color={TONE[x.tone]} textTransform="uppercase" letterSpacing="0.12em">
            {TONE_WORD[x.tone]}
          </Text>
          {x.date && <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}>{day(x.date)}</Text>}
          {showMark && x.mark && <Text fontSize={TYPE.small} color={P.inkSec} noOfLines={1}>{x.mark}{x.owner ? `, ${x.owner}` : ''}</Text>}
        </HStack>
        <Text fontSize={TYPE.small} color={P.ink} lineHeight="1.55">{x.say}</Text>
      </VStack>
    </HStack>
  );
  if (to) return <RowLink to={to} state={state}>{body}</RowLink>;
  return <Box py={3} borderTop="1px solid" borderColor={P.hairSoft}>{body}</Box>;
};

// A settings row. Label and a hint on the left, the control on the right,
// stacked on a phone.
export const SettingRow = ({ label, hint, children, ...rest }) => (
  <Box
    display="grid"
    gridTemplateColumns={{ base: '1fr', md: 'minmax(0, 220px) minmax(0, 1fr)' }}
    gap={{ base: 2.5, md: 6 }}
    py={4}
    borderTop="1px solid"
    borderColor={P.hairSoft}
    {...rest}
  >
    <VStack align="start" spacing={0.5}>
      <Text fontSize={TYPE.body} fontWeight="600" color={P.ink}>{label}</Text>
      {hint && <Text fontSize={TYPE.small} color={P.inkMuted} lineHeight="1.5">{hint}</Text>}
    </VStack>
    <Box minW={0}>{children}</Box>
  </Box>
);

// A key and its value, for the facts of one mark.
export const Fact = ({ k, children }) => (
  <HStack align="baseline" spacing={4} py={2.5} borderTop="1px solid" borderColor={P.hairSoft}>
    <Text fontSize={TYPE.small} color={P.inkMuted} w={{ base: '112px', md: '180px' }} flexShrink={0}>{k}</Text>
    <Box fontSize={TYPE.small} color={P.ink} minW={0} flex={1}>{children}</Box>
  </HStack>
);

export const Out = ({ href, children }) => (
  <Link href={href} isExternal color={P.inkMuted} fontSize={TYPE.small} _hover={{ color: P.ink }}>
    {children} <Icon as={TbExternalLink} boxSize={3} verticalAlign="-1px" />
  </Link>
);

// A segmented choice, the cadence. One row of quiet buttons, the chosen one
// in ink. Wraps on a phone rather than scrolling sideways.
export const Segments = ({ items, value, onChange, disabled }) => (
  <HStack spacing={0} flexWrap="wrap" gap={1.5}>
    {items.map((item) => {
      const on = item.key === value;
      return (
        <Box
          key={item.key}
          as="button"
          type="button"
          disabled={disabled}
          onClick={() => !on && onChange(item.key)}
          px={3.5}
          h="34px"
          borderRadius="full"
          fontSize={TYPE.small}
          fontWeight={on ? '700' : '500'}
          bg={on ? P.ink : P.sheet}
          color={on ? P.mat : P.inkSec}
          border="1px solid"
          borderColor={on ? P.ink : P.hair}
          transition={`all ${FAST} ${EASE}`}
          _hover={on ? undefined : { borderColor: P.inkFaint, color: P.ink }}
          _disabled={{ opacity: 0.55, cursor: 'default' }}
        >
          {item.label}
        </Box>
      );
    })}
  </HStack>
);

// ── filing it directly ──────────────────────────────────────────────────────
// Tyler, 2026-10-05: "explain the pricing and the process, and provide links
// ... The best, most manual way. No services. We do it directly." So this is
// the USPTO's own door with nobody in between.
//
// THE FEES were reread on the USPTO fee schedule on 2026-10-05, the page
// last updated 2026-08-14, electronic filing: 7017 base application $350 a
// class, 7018 insufficient information $100 a class, 7019 free-form text $200
// a class, 7020 each extra 1,000 characters $200 a class, 7003 statement of
// use $150 a class, 7004 extension to file it $125 a class. If the office
// moves a fee, move it here, in FEES_READ below and in the line at the foot
// of ListView.jsx and in neonburro/src/pages/Account/trademarks.js.
//
// WHO FILES. The studio files its own words as The Burroship LLC. For a
// client the owner is the client, and the studio can show the way but cannot
// file for them, because only a US attorney may represent somebody else
// before the office in a trademark matter. The guide says so on a client's
// list rather than leaving it to be found out.
export const FEES_READ = 'the USPTO fee schedule, updated Aug 14, 2026';

const steps = (forStudio) => [
  {
    title: 'Pick the classes',
    say: 'Every class is its own fee. Take the wording straight from the ID Manual, which is what keeps the $200 free-form charge off.',
    link: { href: 'https://idm-tmng.uspto.gov/id-master-list-public.html', label: 'ID Manual' },
  },
  {
    title: 'File in Trademark Center',
    say: forStudio
      ? 'Signed in to a USPTO.gov account with its identity check done once. Owner The Burroship LLC, the mark in standard characters, which covers the word in lowercase and every other case.'
      : 'Signed in to your own USPTO.gov account with its identity check done once. The owner is your business, the one that will use the mark, in standard characters. The studio can walk it through with you, it cannot file for you, only a US attorney may represent somebody else before the office.',
    link: { href: 'https://www.uspto.gov/trademarks/apply/trademark-center', label: 'Trademark Center' },
  },
  {
    title: 'Choose the basis',
    say: 'In use now, with a specimen showing it on the real thing, or intent to use. Intent to use asks for a statement of use later, $150 a class, with six month extensions at $125 a class.',
    link: { href: 'https://www.uspto.gov/trademarks/basics', label: 'Trademark basics' },
  },
  {
    title: 'Pay',
    say: '$350 a class. $100 more a class if information is missing, $200 more a class for free-form wording, $200 a class for each extra 1,000 characters. Two classes with ID Manual wording and nothing missing is $700.',
    link: { href: 'https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule', label: 'Fee schedule' },
  },
  {
    title: 'Then keep it on a weekly read',
    say: 'An examining attorney reads it, it publishes for opposition, then it registers, or an intent to use filing gets a notice of allowance first. Each step lands in what changed on this word.',
  },
];

export const FilingGuide = ({ forStudio }) => (
  <VStack align="stretch" spacing={0} borderLeft="2px solid" borderColor={P.limeDeep} pl={4}>
    <Head mb={2}>{forStudio ? 'Filing it directly, as The Burroship LLC' : 'Filing it directly, as your business'}</Head>
    {steps(forStudio).map((step, i) => (
      <HStack key={step.title} align="start" spacing={3} py={2}>
        <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} w="14px" pt="2px" flexShrink={0}>{i + 1}</Text>
        <VStack align="start" spacing={0.5} minW={0}>
          <Text fontSize={TYPE.small} fontWeight="600" color={P.ink}>{step.title}</Text>
          <Text fontSize={TYPE.small} color={P.inkSec} lineHeight="1.55">{step.say}</Text>
          {step.link && <Out href={step.link.href}>{step.link.label}</Out>}
        </VStack>
      </HStack>
    ))}
    <Text fontSize={TYPE.label} color={P.inkFaint} pt={2}>Fees from {FEES_READ}. A lawyer reads before anything is filed.</Text>
  </VStack>
);
