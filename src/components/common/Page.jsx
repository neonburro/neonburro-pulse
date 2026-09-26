// src/components/common/Page.jsx
// SENTINEL: NB_PULSE_PAGE_KIT_V1
//
// The layout kit. Every page under src/pages composes from these and types
// no width, no gutter, no inset and no font size of its own. The numbers live
// in src/theme/layout.js and the reasons live there too, this file only
// applies them. Read that header first.
//
//   Page        the column. Rail on the left, CONTENT wide, never centred.
//               measure puts a form or a reading page on MEASURE instead.
//               The children stack at HEAD_GAP, head then sections.
//   PageHead    kicker, title, lede, in that order, same gaps everywhere.
//               actions sit on the right of the title row and wrap under it
//               on a phone. children go under the lede, a stat strip usually.
//   Section     a kicker with a hairline, an optional count or action on the
//               right, then the plate or the table at SECTION_GAP.
//   Plate       the sheet surface. Fills its column, PLATE_RADIUS corners,
//               PLATE_PAD inside unless pad is false for a table.
//   Empty       the empty state. One line, left aligned, in the same place
//               on every page. A hint line and an action are optional. No
//               icon, no centring.
//   Loading     the loading row. A small spinner and a word, left aligned.
//   Tabs        the filter row. Underline tabs with a count, the active one
//               in ink. One way on every page, the pills are gone.
//   Stats       the figures under a title. n then label, dotted apart.
//   SearchBox   the round search field. Same inset and height as an input.
//   Kicker      the section kicker text, KICKER from the theme.
//   FieldLabel  the label above a field, FIELD_LABEL from the theme.
//   Field       label, optional hint on the right, then the control.
//
// Lime is spent by the page on its one primary button. The kit spends none,
// the active tab and the active count are ink.
//
// No oxford commas, no em dashes.

import { Box, VStack, HStack, Text, Icon, Input, Spinner } from '@chakra-ui/react';
import { TbSearch } from 'react-icons/tb';
import colors from '../../theme/colors';
import {
  RAIL, CONTENT, MEASURE, PAGE_Y, HEAD_GAP, SECTION_GAP, PLATE_RADIUS, PLATE_PAD,
  KICKER, FIELD_LABEL, TYPE, SEARCH, PLACEHOLDER, EASE, FAST,
} from '../../theme/layout';

const P = colors.paper;

export const Page = ({ measure = false, wash = true, spacing = HEAD_GAP, children, ...rest }) => (
  <Box position="relative" minH="100vh" bg={P.mat} w="100%">
    {wash && (
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h="320px"
        bg={`radial-gradient(ellipse at 12% 0%, ${P.lime}12, transparent 70%)`}
        pointerEvents="none"
      />
    )}
    <Box position="relative" px={RAIL} py={PAGE_Y} {...rest}>
      <VStack align="stretch" spacing={spacing} w="100%" maxW={measure ? MEASURE : CONTENT}>
        {children}
      </VStack>
    </Box>
  </Box>
);

export const Kicker = ({ children, ...rest }) => (
  <Text {...KICKER} {...rest}>{children}</Text>
);

export const FieldLabel = ({ children, ...rest }) => (
  <Text as="span" {...FIELD_LABEL} {...rest}>{children}</Text>
);

export const PageHead = ({ kicker, title, lede, actions, children }) => (
  <VStack align="stretch" spacing={3}>
    <HStack justify="space-between" align="flex-end" gap={3} flexWrap="wrap">
      <VStack align="start" spacing={1.5} minW={0} flex="1 1 280px">
        {kicker && <Kicker>{kicker}</Kicker>}
        {title && (
          <Text fontSize={TYPE.title} fontWeight="600" letterSpacing="-0.03em" lineHeight="1.1" color={P.ink}>
            {title}
          </Text>
        )}
        {lede && (
          <Text fontSize={TYPE.lede} color={P.inkMuted} lineHeight="1.6" maxW={MEASURE}>
            {lede}
          </Text>
        )}
      </VStack>
      {actions && (
        <HStack spacing={2} flexShrink={0} flexWrap="wrap" rowGap={2}>
          {actions}
        </HStack>
      )}
    </HStack>
    {children}
  </VStack>
);

export const Section = ({ kicker, count, action, rule = true, children, ...rest }) => (
  <VStack align="stretch" spacing={SECTION_GAP} {...rest}>
    {kicker && (
      <HStack spacing={3} align="center">
        {typeof kicker === 'string' ? <Kicker>{kicker}</Kicker> : kicker}
        {rule && <Box flex={1} h="1px" bg={P.hair} />}
        {count !== undefined && count !== null && (
          <Text fontFamily="mono" fontSize={TYPE.kicker} color={P.inkFaint}>{count}</Text>
        )}
        {action}
      </HStack>
    )}
    {children}
  </VStack>
);

export const Plate = ({ pad = true, sunken = false, children, ...rest }) => (
  <Box
    bg={sunken ? P.sunken : P.sheet}
    border="1px solid"
    borderColor={P.hair}
    borderRadius={PLATE_RADIUS}
    w="100%"
    p={pad ? PLATE_PAD : 0}
    overflow={pad ? undefined : 'hidden'}
    {...rest}
  >
    {children}
  </Box>
);

export const Empty = ({ children, hint, action, ...rest }) => (
  <VStack align="start" spacing={1.5} py={8} {...rest}>
    <Text fontSize={TYPE.body} color={P.inkMuted}>{children}</Text>
    {hint && <Text fontSize={TYPE.small} color={P.inkFaint}>{hint}</Text>}
    {action && <Box pt={2}>{action}</Box>}
  </VStack>
);

export const Loading = ({ label = 'loading', ...rest }) => (
  <HStack spacing={2.5} py={8} {...rest}>
    <Spinner size="sm" color={P.limeDeep} thickness="2px" />
    <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkMuted}>{label}</Text>
  </HStack>
);

export const Tabs = ({ items, value, onChange, ...rest }) => (
  <HStack
    spacing={6}
    flexWrap="wrap"
    rowGap={0}
    align="center"
    borderBottom="1px solid"
    borderColor={P.hair}
    overflowX="auto"
    sx={{ '&::-webkit-scrollbar': { display: 'none' } }}
    {...rest}
  >
    {items.map((item) => {
      const active = item.key === value;
      const tone = item.color || P.ink;
      return (
        <HStack
          key={item.key}
          as="button"
          type="button"
          onClick={() => onChange(item.key)}
          spacing={1.5}
          align="baseline"
          pb={2.5}
          mb="-1px"
          flexShrink={0}
          borderBottom="2px solid"
          borderColor={active ? tone : 'transparent'}
          transition={`all ${FAST} ${EASE}`}
          _hover={{ '& > *': { color: P.ink } }}
        >
          <Text fontSize={TYPE.small} fontWeight={active ? '700' : '500'} color={active ? P.ink : P.inkMuted} whiteSpace="nowrap">
            {item.label}
          </Text>
          {item.count !== undefined && item.count !== null && (
            <Text fontFamily="mono" fontSize={TYPE.label} color={active ? tone : P.inkFaint}>
              {item.count}
            </Text>
          )}
        </HStack>
      );
    })}
  </HStack>
);

const Dot = () => <Text color={P.inkFaint} fontSize={TYPE.small} mx={2}>·</Text>;

export const Stats = ({ items, ...rest }) => (
  <HStack spacing={0} flexWrap="wrap" rowGap={1} {...rest}>
    {items.filter(Boolean).map((item, index) => (
      <HStack key={item.key || item.label} spacing={0}>
        {index > 0 && <Dot />}
        <HStack
          spacing={1.5}
          align="baseline"
          as={item.onClick ? 'button' : 'div'}
          type={item.onClick ? 'button' : undefined}
          onClick={item.onClick}
          transition={`opacity ${FAST} ${EASE}`}
          _hover={item.onClick ? { opacity: 0.7 } : undefined}
        >
          <Text fontFamily="mono" fontSize={TYPE.small} fontWeight="700" color={item.tone || P.ink} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {item.n}
          </Text>
          <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>{item.label}</Text>
        </HStack>
      </HStack>
    ))}
  </HStack>
);

export const SearchBox = ({ value, onChange, placeholder = 'search', inputProps = {}, ...rest }) => (
  <HStack spacing={2.5} {...SEARCH} {...rest}>
    <Icon as={TbSearch} boxSize={4} color={P.inkMuted} flexShrink={0} />
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      variant="unstyled"
      h="100%"
      fontSize={TYPE.body}
      color={P.ink}
      _placeholder={{ color: PLACEHOLDER }}
      {...inputProps}
    />
  </HStack>
);

export const Field = ({ label, hint, hintColor, children, ...rest }) => (
  <VStack align="stretch" spacing={1.5} {...rest}>
    {(label || hint) && (
      <HStack justify="space-between" align="baseline">
        {label ? <FieldLabel mb={0}>{label}</FieldLabel> : <Box />}
        {hint && (
          <Text fontFamily="mono" fontSize={TYPE.micro} color={hintColor || P.inkFaint} textAlign="right">
            {hint}
          </Text>
        )}
      </HStack>
    )}
    {children}
  </VStack>
);

export default Page;
