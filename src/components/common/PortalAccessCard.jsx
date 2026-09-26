// src/components/common/PortalAccessCard.jsx
// Owner only portal access for a client, on Paper.
// - Reveal PIN (logged to activity_log via RPC)
// - Regenerate PIN (updates clients.portal_pin + the auth password)
// - Copy PIN when revealed, shows last login
// A house section with a kicker. No oxford commas, no dashes.

import { useState } from 'react';
import { Box, VStack, HStack, Text, Icon, Button, useToast, Spinner } from '@chakra-ui/react';
import { TbEye, TbEyeOff, TbCopy, TbCheck, TbRefresh, TbAlertTriangle } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import colors from '../../theme/colors';
import { TYPE } from '../../theme/layout';
import { Section, Kicker } from './Page';

const P = colors.paper;

const Row = ({ label, children }) => (
  <HStack py={3} spacing={4} borderBottom="1px solid" borderColor={P.hairSoft} align="center" _last={{ borderBottom: 'none' }}>
    <Kicker minW="90px">{label}</Kicker>
    <Box flex={1}>{children}</Box>
  </HStack>
);

const GhostBtn = ({ children, hoverColor = P.limeDeep, ...props }) => (
  <Button size="xs" variant="ghost" _hover={{ color: hoverColor, bg: P.sunken }} {...props}>
    {children}
  </Button>
);

const PortalAccessCard = ({ client, onUpdate }) => {
  const toast = useToast();
  const [showPin, setShowPin] = useState(false);
  const [revealedPin, setRevealedPin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [regenResult, setRegenResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!client) return null;

  const username = client.username || client.email?.split('@')[0] || 'none';
  const hasPortalAccount = !!client.portal_account_created_at;

  const handleShow = async () => {
    if (showPin) { setShowPin(false); setRevealedPin(null); return; }
    setLoading(true);
    try {
      const { error: logError } = await supabase.rpc('log_client_pin_viewed', { client_uuid: client.id });
      if (logError) throw logError;
      setRevealedPin(client.portal_pin || 'none');
      setShowPin(true);
    } catch (err) {
      toast({ title: 'Could not reveal PIN', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (pin) => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: 'Select and copy manually', status: 'warning', duration: 2000 });
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('regenerate_client_pin', { client_uuid: client.id });
      if (error) throw error;
      setRegenResult(data);
      setConfirmingRegen(false);
      toast({ title: 'PIN regenerated', description: data?.auth_updated ? 'Client portal password updated' : 'PIN updated (no portal account linked)', status: 'success', duration: 3000 });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast({ title: 'Regeneration failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  const lastLoginText = client.last_login_at
    ? `Last login ${formatDistanceToNow(new Date(client.last_login_at), { addSuffix: true })}`
    : 'Never logged in';

  return (
    <Section kicker="Portal access">
      {regenResult && (
        <Box p={4} bg={`${P.lime}18`} border="1px solid" borderColor={`${P.lime}55`} borderRadius="12px">
          <HStack spacing={2} mb={2}>
            <Icon as={TbCheck} boxSize={3.5} color={P.limeDeep} />
          <Kicker color={P.limeDeep}>New PIN</Kicker>
          </HStack>
          <Text color={P.inkSec} fontSize={TYPE.small} mb={3} lineHeight="1.5">Copy this now. It will not be shown again.</Text>
          <HStack spacing={2}>
            <Text color={P.ink} fontSize={TYPE.section} fontWeight="800" fontFamily="mono" letterSpacing="0.15em" flex={1}>{regenResult.pin}</Text>
            <Button size="xs" variant="outline" color={P.limeDeep} leftIcon={copied ? <TbCheck size={12} /> : <TbCopy size={12} />} onClick={() => handleCopy(regenResult.pin)}>{copied ? 'Copied' : 'Copy'}</Button>
            <GhostBtn onClick={() => setRegenResult(null)} hoverColor={P.ink}>Done</GhostBtn>
          </HStack>
        </Box>
      )}

      {confirmingRegen && (
        <Box p={4} bg={`${P.coral}12`} border="1px solid" borderColor={`${P.coral}40`} borderRadius="12px">
          <HStack spacing={2} mb={2}>
            <Icon as={TbAlertTriangle} boxSize={3.5} color={P.coral} />
            <Kicker color={P.coral}>Regenerate PIN</Kicker>
          </HStack>
          <Text color={P.inkSec} fontSize={TYPE.small} mb={3} lineHeight="1.5">Old PIN stops working immediately. The client needs the new PIN to log in.</Text>
          <HStack spacing={2}>
            <Button size="xs" variant="destructive" onClick={handleRegenerate} isLoading={loading} loadingText="Generating">Yes, regenerate</Button>
            <GhostBtn onClick={() => setConfirmingRegen(false)} hoverColor={P.ink}>Cancel</GhostBtn>
          </HStack>
        </Box>
      )}

      <Box borderTop="1px solid" borderColor={P.hairSoft}>
        <Row label="Username">
          <Text color={P.ink} fontSize={TYPE.body} fontFamily="mono" fontWeight="600">{username}</Text>
        </Row>

        <Row label="PIN">
          <HStack spacing={2} align="center">
            <Text color={showPin ? P.ink : P.inkFaint} fontSize={TYPE.body} fontFamily="mono" fontWeight="700" letterSpacing="0.15em" minW="100px">
              {showPin ? (revealedPin || 'none') : '••••••••'}
            </Text>
            <GhostBtn leftIcon={loading && !showPin ? <Spinner size="xs" /> : (showPin ? <TbEyeOff size={12} /> : <TbEye size={12} />)} onClick={handleShow} isDisabled={loading}>{showPin ? 'Hide' : 'Show'}</GhostBtn>
            {showPin && revealedPin && revealedPin !== 'none' && (
              <GhostBtn leftIcon={copied ? <TbCheck size={12} /> : <TbCopy size={12} />} onClick={() => handleCopy(revealedPin)}>{copied ? 'Copied' : 'Copy'}</GhostBtn>
            )}
            <Box flex={1} />
            <GhostBtn leftIcon={<TbRefresh size={12} />} onClick={() => setConfirmingRegen(true)} isDisabled={loading || confirmingRegen} hoverColor={P.gold}>Regenerate</GhostBtn>
          </HStack>
        </Row>

        <Row label="Status">
          <HStack spacing={2} flexWrap="wrap" rowGap={1}>
            <Box w="6px" h="6px" borderRadius="full" bg={hasPortalAccount ? P.green : P.inkFaint} />
            <Text color={P.ink} fontSize={TYPE.body} fontWeight="600">{hasPortalAccount ? 'Active' : 'Not activated'}</Text>
            <Text color={P.inkMuted} fontSize={TYPE.small} fontFamily="mono">· {lastLoginText}</Text>
          </HStack>
        </Row>
      </Box>
    </Section>
  );
};

export default PortalAccessCard;
