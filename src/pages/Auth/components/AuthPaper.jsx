// src/pages/Auth/components/AuthPaper.jsx
// The paper shell for the Pulse doors a person reaches from an email, the
// reset page (from the recovery mail) and the invite page (from the invite
// mail). Both were the last dark screens with the old cyan glow until
// 2026-10-05, so a person tapped a light email and landed in the dark. Now
// the email, the door and the sign in page are one material.
//
// ── WHERE THE LOOK COMES FROM ────────────────────────────────────────────────
// Login.jsx was converted first and is the model. The ground, the lime wash,
// the heartbeat line, the wordmark link, the PULSE kicker, the 54 pixel
// inputs and the 56 pixel lime pill here are copies of the ones in Login.jsx,
// value for value. Login still carries its own copies because it is the live
// sign in and was not refactored the day this was written. If a value moves
// in one, move it in the other, or move Login onto this shell and delete its
// copies in the same commit.
//
// The emails these pages answer are written by scripts/auth-email-templates.mjs.
// The invite mail's title is "Pull up a chair." and so is the invite page's,
// on purpose, the same line on both sides of the tap.
//
// ── THE RULES OF THE ROOM ────────────────────────────────────────────────────
// colors.paper only. Lime is the heartbeat, the period and the action, the
// same three Login spends. On a phone there is no container, the cream is the
// frame. The screen scrolls, unlike Login, because the invite form is taller
// than a small phone. It scrolls down only. The lime wash is wider than the
// screen on purpose, and overflowY auto alone turns overflowX to auto as
// well, which put a sideways scrollbar under the reset page.
//
// No oxford commas, no em dashes.

import { useState } from 'react';
import {
  Box, VStack, Text, HStack, Icon, Collapse, Button, Input,
  InputGroup, InputRightElement,
} from '@chakra-ui/react';
import { TbAlertTriangle, TbEye, TbEyeOff, TbArrowRight, TbCheck } from 'react-icons/tb';
import { Link as RouterLink } from 'react-router-dom';
import colors from '../../../theme/colors';

export const P = colors.paper;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

// Same as Login.jsx inputStyle.
export const inputStyle = {
  bg: P.sheet,
  border: '1px solid',
  borderColor: P.hair,
  color: P.ink,
  fontSize: 'md',
  h: '54px',
  borderRadius: 'xl',
  px: 4,
  transition: `all 180ms ${EASE}`,
  _hover: { borderColor: P.inkFaint },
  _focus: { borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}44`, outline: 'none' },
  _focusVisible: { borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}44`, outline: 'none' },
  _placeholder: { color: P.inkFaint, fontSize: 'md', fontWeight: '400' },
};

// The heartbeat line, the Pulse motif, the same path and timing as Login.jsx.
const PulseLine = () => (
  <Box
    as="svg"
    viewBox="0 0 200 40"
    w="132px"
    h="26px"
    fill="none"
    aria-hidden="true"
    sx={{
      '& .beat': {
        strokeDasharray: 260,
        strokeDashoffset: 260,
        animation: `sweep 3.6s ${EASE} infinite`,
      },
      '@keyframes sweep': {
        '0%': { strokeDashoffset: 260 },
        '38%': { strokeDashoffset: 0 },
        '68%': { strokeDashoffset: 0 },
        '100%': { strokeDashoffset: -260 },
      },
    }}
  >
    <path
      className="beat"
      d="M2 20 H70 L82 20 L90 6 L100 34 L110 13 L118 20 H198"
      stroke={P.lime}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Box>
);

// The whole screen, its own cream world like Login.
export const AuthScreen = ({ children }) => (
  <Box
    position="fixed"
    inset={0}
    bg={P.mat}
    overflowX="hidden"
    overflowY="auto"
    sx={{
      '@keyframes fadeUp': {
        '0%': { opacity: 0, transform: 'translateY(12px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
    }}
  >
    <Box
      position="absolute"
      top="-30%"
      left="50%"
      transform="translateX(-50%)"
      w={{ base: '160%', md: '900px' }}
      h={{ base: '620px', md: '820px' }}
      bg={`radial-gradient(ellipse at center top, ${P.lime}22, transparent 62%)`}
      pointerEvents="none"
      zIndex={0}
    />
    <Box
      position="relative"
      zIndex={1}
      minH="100%"
      w="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={5}
      pt="max(40px, env(safe-area-inset-top))"
      pb="max(40px, env(safe-area-inset-bottom))"
    >
      <Box w="100%" maxW="372px" animation={`fadeUp 420ms ${EASE}`}>
        <VStack spacing={{ base: 8, md: 9 }} align="stretch">
          {children}
        </VStack>
      </Box>
    </Box>
  </Box>
);

// Heartbeat, wordmark (always a link home), kicker.
export const Brand = () => (
  <VStack spacing={3} align="center">
    <PulseLine />
    <Box
      as="a"
      href="https://neonburro.com/"
      target="_blank"
      rel="noopener noreferrer"
      transition="opacity 200ms"
      _hover={{ opacity: 0.75 }}
    >
      <Text as="span" fontSize="26px" fontWeight="600" letterSpacing="-0.035em" color={P.ink}>
        neonburro<Text as="span" color={P.lime}>.</Text>
      </Text>
    </Box>
    <Text
      fontFamily="mono"
      fontSize="10px"
      fontWeight="500"
      letterSpacing="0.28em"
      textTransform="uppercase"
      color={P.inkMuted}
    >
      Pulse
    </Text>
  </VStack>
);

// The dry line and the plain one under it.
export const Heading = ({ title, line }) => (
  <VStack spacing={2} textAlign="center">
    <Text fontSize="26px" fontWeight="700" letterSpacing="-0.03em" lineHeight="1.15" color={P.ink}>
      {title}
    </Text>
    {line && (
      <Text fontSize="sm" color={P.inkMuted} lineHeight="1.6" sx={{ textWrap: 'pretty' }}>
        {line}
      </Text>
    )}
  </VStack>
);

// Same banner as Login.jsx.
export const ErrorNote = ({ error }) => (
  <Collapse in={!!error} animateOpacity unmountOnExit>
    <HStack
      spacing={2.5}
      bg={`${P.coral}14`}
      border="1px solid"
      borderColor={`${P.coral}40`}
      borderRadius="xl"
      px={4}
      py={3}
    >
      <Icon as={TbAlertTriangle} boxSize={4} color={P.coral} flexShrink={0} />
      <Text fontSize="xs" color={P.coral} lineHeight="1.4">{error}</Text>
    </HStack>
  </Collapse>
);

// The house kicker as a field label.
export const Label = ({ children }) => (
  <Text
    fontFamily="mono"
    fontSize="10px"
    fontWeight="500"
    letterSpacing="0.2em"
    textTransform="uppercase"
    color={P.inkMuted}
    mb={2}
    pl={1}
  >
    {children}
  </Text>
);

export const Hint = ({ children }) => (
  <Text fontSize="xs" color={P.inkFaint} mt={2} pl={1}>{children}</Text>
);

export const TextInput = (props) => <Input type="text" {...inputStyle} {...props} />;

// A password field with its own eye. Each field keeps its own show state.
export const PasswordInput = ({ autoComplete = 'new-password', ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <InputGroup>
      <Input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        {...inputStyle}
        pr="52px"
        {...props}
      />
      <InputRightElement h="54px" w="52px">
        <Box
          as="button"
          type="button"
          onClick={() => setShow(!show)}
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="36px"
          h="36px"
          borderRadius="md"
          color={P.inkFaint}
          transition="color 200ms"
          _hover={{ color: P.limeDeep }}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <Icon as={show ? TbEyeOff : TbEye} boxSize={4} />
        </Box>
      </InputRightElement>
    </InputGroup>
  );
};

// The one action, the same pill as Login.jsx.
export const Pill = ({ children, isLoading, ...props }) => (
  <Button
    w="100%"
    h="56px"
    bg={P.lime}
    color={P.limeInk}
    fontSize="md"
    fontWeight="700"
    borderRadius="full"
    rightIcon={!isLoading && <Icon as={TbArrowRight} boxSize={4} />}
    isLoading={isLoading}
    transition={`all 200ms ${EASE}`}
    _hover={{ bg: colors.brand[400], transform: 'translateY(-2px)', _disabled: { bg: P.lime, transform: 'none' } }}
    _active={{ transform: 'scale(0.98)' }}
    _focus={{ boxShadow: `0 0 0 3px ${P.lime}55` }}
    _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
    {...props}
  >
    {children}
  </Button>
);

// The finished state, a check and two short lines.
export const Done = ({ title, line }) => (
  <VStack spacing={3} py={2} textAlign="center" animation={`fadeUp 400ms ${EASE}`}>
    <Box
      w="56px"
      h="56px"
      borderRadius="full"
      bg={P.sheet}
      border="1px solid"
      borderColor={P.hair}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Icon as={TbCheck} boxSize={6} color={P.green} />
    </Box>
    <Text fontSize="xl" fontWeight="700" letterSpacing="-0.02em" color={P.ink}>{title}</Text>
    <Text fontSize="sm" color={P.inkMuted}>{line}</Text>
  </VStack>
);

// A quiet way back, centered under everything.
export const QuietLink = ({ to, children }) => (
  <Box textAlign="center">
    <Box
      as={RouterLink}
      to={to}
      fontSize="sm"
      color={P.inkMuted}
      transition="color 200ms"
      _hover={{ color: P.limeDeep }}
    >
      {children}
    </Box>
  </Box>
);
