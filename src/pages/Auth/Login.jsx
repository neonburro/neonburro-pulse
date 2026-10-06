// src/pages/Auth/Login.jsx
// Pulse sign-in, the first page in the warm Paper system (src/theme/colors.js).
//
// ── WHY THIS PAGE IS LIGHT WHILE THE APP IS STILL DARK ───────────────────────
// Pulse is migrating to the Paper light look one page at a time. Login is first
// because it is public and it paints its OWN full-screen world (position fixed,
// its own cream ground), so it owes nothing to the global dark theme and cannot
// break an authed screen. It reads colors.paper.* directly, the documented light
// environment. When the rest of the app converts, this page already fits.
//
// ── WHAT IS PRESERVED ────────────────────────────────────────────────────────
// Every bit of auth behavior is unchanged: username or email in, resolveEmail
// turns a username into an email through the lookup_email_by_username RPC (the
// anon role never reads profiles), signIn, redirect to `from`. The reset flow
// and the burro easter egg stay, recolored for cream.
//
// ── THE GRAPHIC ──────────────────────────────────────────────────────────────
// One little heartbeat line sweeps across, the Pulse motif, drawn in lime. It is
// the only motion and the only lime spent up top so the accent stays singular.
//
// ── THE OTHER DOORS ──────────────────────────────────────────────────────────
// The reset and invite pages wear the same look through
// components/AuthPaper.jsx, which copies the pieces of this page value for
// value. If a value moves here, move it there. "No seat yet? Ask for one" is
// the request access path Tyler asked for on 2026-10-05, a mail to the studio
// and nothing more, because a seat in Pulse is handed out by a person.
//
// No containers wrap the content, on a phone the cream is the frame. No cold
// white, the brightest surface is the input fill. No oxford commas, no dashes.

import { useState, useRef, useEffect } from 'react';
import {
  Box, VStack, Text, Input, Button, FormControl,
  Icon, HStack, Collapse, InputGroup, InputRightElement,
} from '@chakra-ui/react';
import { GiBananaPeeled } from 'react-icons/gi';
import { TbLock, TbAlertTriangle, TbEye, TbEyeOff, TbArrowRight } from 'react-icons/tb';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';

const P = colors.paper;

const inputStyle = {
  bg: P.sheet,
  border: '1px solid',
  borderColor: P.hair,
  color: P.ink,
  fontSize: 'md',
  h: '54px',
  borderRadius: 'xl',
  px: 4,
  transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
  _hover: { borderColor: P.inkFaint },
  _focus: { borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}44`, outline: 'none' },
  _focusVisible: { borderColor: P.lime, boxShadow: `0 0 0 3px ${P.lime}44`, outline: 'none' },
  _placeholder: { color: P.inkFaint, fontSize: 'md', fontWeight: '400' },
};

const isEmail = (value) => value.includes('@');

const resolveEmail = async (input) => {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) throw new Error('Username not recognized');
  if (isEmail(trimmed)) return trimmed;
  const { data, error } = await supabase.rpc('lookup_email_by_username', { p_username: trimmed });
  if (error) {
    console.error('lookup_email_by_username failed', error);
    throw new Error('Could not check username, try again');
  }
  if (!data) throw new Error('Username not recognized');
  return data;
};

// The heartbeat line, the Pulse motif. Draws in then sweeps off, on a loop.
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
        animation: 'sweep 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
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

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorShake, setErrorShake] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const identifierRef = useRef(null);
  const passwordRef = useRef(null);

  const from = location.state?.from?.pathname || '/today/';

  useEffect(() => {
    const id = setTimeout(() => identifierRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, []);

  const triggerShake = () => {
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const email = await resolveEmail(identifier);
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      triggerShake();
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      triggerShake();
      setError('Please enter a valid email');
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password/` }
      );
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      triggerShake();
      setError(err.message || 'Could not send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Box
      position="fixed"
      inset={0}
      bg={P.mat}
      overflow="hidden"
      sx={{
        '@keyframes shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
        '@keyframes fadeUp': {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Warm lime wash from the top, the only glow, very soft */}
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
        h="100%"
        w="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={5}
        pt="env(safe-area-inset-top)"
        pb="env(safe-area-inset-bottom)"
      >
        <Box w="100%" maxW="372px" animation="fadeUp 420ms cubic-bezier(0.4, 0, 0.2, 1)">
          <VStack spacing={{ base: 9, md: 11 }} align="stretch">

            {/* Brand: heartbeat, wordmark, kicker */}
            <VStack spacing={3} align="center">
              <PulseLine />
              <Box
                as="a"
                href="https://neonburro.com/"
                target="_blank"
                rel="noopener noreferrer"
                cursor="pointer"
                transition="opacity 200ms"
                _hover={{ opacity: 0.75 }}
              >
                <Text
                  as="span"
                  fontSize="26px"
                  fontWeight="600"
                  letterSpacing="-0.035em"
                  color={P.ink}
                >
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

            {/* Error banner */}
            <Collapse in={!!error} animateOpacity unmountOnExit>
              <HStack
                spacing={2.5}
                bg={`${P.coral}14`}
                border="1px solid"
                borderColor={`${P.coral}40`}
                borderRadius="xl"
                px={4}
                py={3}
                animation={errorShake ? 'shake 500ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none'}
              >
                <Icon as={TbAlertTriangle} boxSize={4} color={P.coral} flexShrink={0} />
                <Text fontSize="xs" color={P.coral} lineHeight="1.4">{error}</Text>
              </HStack>
            </Collapse>

            {/* Sign-in form */}
            <VStack as="form" onSubmit={handleSubmit} spacing={4}>
              <FormControl>
                <Input
                  ref={identifierRef}
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or email"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  enterKeyHint="next"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                  {...inputStyle}
                />
              </FormControl>

              <FormControl>
                <InputGroup>
                  <Input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    required
                    autoComplete="current-password"
                    enterKeyHint="go"
                    {...inputStyle}
                    pr="52px"
                  />
                  <InputRightElement h="54px" w="52px">
                    <Box
                      as="button"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon as={showPassword ? TbEyeOff : TbEye} boxSize={4} />
                    </Box>
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <Button
                type="submit"
                w="100%"
                h="56px"
                mt={2}
                bg={P.lime}
                color={P.limeInk}
                fontSize="md"
                fontWeight="700"
                borderRadius="full"
                rightIcon={!loading && <Icon as={TbArrowRight} boxSize={4} />}
                isLoading={loading}
                loadingText="Signing in"
                transition="all 200ms cubic-bezier(0.4, 0, 0.2, 1)"
                _hover={{ bg: '#D2E26B', transform: 'translateY(-2px)' }}
                _active={{ transform: 'scale(0.98)' }}
                _focus={{ boxShadow: `0 0 0 3px ${P.lime}55` }}
              >
                Sign in
              </Button>

              {/* Forgot-password trigger */}
              <HStack
                spacing={1.5}
                justify="center"
                cursor="pointer"
                onClick={() => {
                  setShowForgot(!showForgot);
                  setResetSent(false);
                  setError('');
                }}
                color={P.inkMuted}
                transition="color 200ms"
                _hover={{ color: P.limeDeep }}
                userSelect="none"
                pt={3}
                pb={1}
              >
                <Icon as={TbLock} boxSize={3} />
                <Text fontSize="sm" color="inherit">Forgot your password?</Text>
              </HStack>
            </VStack>

            {/* Forgot-password inline, Pulse is smart, burro easter egg kept */}
            <Collapse in={showForgot} animateOpacity unmountOnExit>
              {resetSent ? (
                <VStack spacing={3} py={2} animation="fadeUp 400ms cubic-bezier(0.4, 0, 0.2, 1)">
                  <Icon as={GiBananaPeeled} boxSize={8} color={P.gold} />
                  <VStack spacing={1}>
                    <Text fontSize="sm" color={P.ink} fontWeight="600" textAlign="center">
                      Check your inbox.
                    </Text>
                    <Text fontSize="xs" color={P.inkMuted} textAlign="center">
                      The reset link is on its way. Feed the burro.
                    </Text>
                  </VStack>
                </VStack>
              ) : (
                <VStack spacing={3}>
                  <Text fontSize="xs" color={P.inkMuted} textAlign="center" lineHeight="1.6" px={2}>
                    Pulse remembers everything. You do not have to.
                    <br />Drop your email and a reset link follows.
                  </Text>
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your email"
                    autoComplete="email"
                    enterKeyHint="send"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleResetPassword();
                      }
                    }}
                    {...inputStyle}
                  />
                  <Button
                    w="100%"
                    h="50px"
                    bg="transparent"
                    color={P.ink}
                    border="1px solid"
                    borderColor={P.hair}
                    fontSize="sm"
                    fontWeight="600"
                    borderRadius="full"
                    isLoading={resetLoading}
                    loadingText="Sending"
                    onClick={handleResetPassword}
                    transition="all 200ms cubic-bezier(0.4, 0, 0.2, 1)"
                    _hover={{ bg: P.sheet, borderColor: P.inkFaint, transform: 'translateY(-1px)' }}
                    _active={{ transform: 'scale(0.98)' }}
                  >
                    Send reset link
                  </Button>
                </VStack>
              )}
            </Collapse>

            {/* The way in for somebody without a seat, a note to the studio */}
            <Text fontSize="sm" color={P.inkMuted} textAlign="center">
              No seat yet?{' '}
              <Box
                as="a"
                href="mailto:hello@neonburro.com?subject=A%20seat%20in%20Pulse"
                color={P.ink}
                fontWeight="600"
                transition="color 200ms"
                _hover={{ color: P.limeDeep }}
              >
                Ask for one &rarr;
              </Box>
            </Text>

          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
