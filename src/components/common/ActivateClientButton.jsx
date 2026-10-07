// src/components/common/ActivateClientButton.jsx
// Fires send-client-invite: ensures a PIN, creates the auth user, upserts a
// client-role profile, sends the branded welcome email, marks the client
// activated. Shown only when portal_account_created_at is null. Paper styled,
// confirm dialog before firing. The door answers staff only since 2026-10-05,
// so the call carries the session token as Authorization: Bearer. No oxford
// commas, no dashes.

import { useState, useRef } from 'react';
import {
  Button, Icon, useToast, AlertDialog, AlertDialogBody, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, VStack, Text, HStack, Box,
} from '@chakra-ui/react';
import { TbMailForward, TbSparkles } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';

const P = colors.paper;

const ActivateClientButton = ({ client, onActivated }) => {
  const toast = useToast();
  const cancelRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!client) return null;

  const handleActivate = async () => {
    if (!client.email) {
      toast({ title: 'Client has no email on file', description: 'Add an email to the client before activating.', status: 'warning', duration: 4000 });
      setIsOpen(false);
      return;
    }
    if (!client.username) {
      toast({ title: 'Client has no username', description: 'Set a username on the client before activating.', status: 'warning', duration: 4000 });
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/send-client-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ clientId: client.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activation failed');
      toast({ title: 'Portal activated', description: `Welcome email sent to ${client.email}`, status: 'success', duration: 5000 });
      setIsOpen(false);
      if (onActivated) onActivated();
    } catch (err) {
      console.error('[ActivateClientButton] failed', err);
      toast({ title: 'Could not activate', description: err.message, status: 'error', duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" borderColor={`${P.green}66`} color={P.green} fontWeight="700" borderRadius="full" leftIcon={<Icon as={TbSparkles} boxSize={3.5} />} onClick={() => setIsOpen(true)} _hover={{ bg: `${P.green}14`, transform: 'translateY(-1px)' }} transition="all 0.15s">
        Activate portal
      </Button>

      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={() => !loading && setIsOpen(false)} isCentered motionPreset="slideInBottom">
        <AlertDialogOverlay bg="rgba(23,17,12,0.6)" backdropFilter="blur(4px)">
          <AlertDialogContent bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="16px" maxW="440px" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="700" color={P.ink} pb={2}>Activate portal for {client.name}?</AlertDialogHeader>
            <AlertDialogBody>
              <VStack align="stretch" spacing={4}>
                <Text color={P.inkSec} fontSize="sm" lineHeight="1.6">This creates their sign-in account and sends a welcome email with their username and PIN.</Text>
                <Box bg={P.sunken} borderRadius="12px" p={3} border="1px solid" borderColor={P.hair}>
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Text fontSize="2xs" fontFamily="mono" fontWeight="700" color={P.inkMuted} textTransform="uppercase" letterSpacing="0.1em">Email</Text>
                      <Text fontSize="xs" color={P.limeDeep} fontWeight="600" fontFamily="mono">{client.email}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="2xs" fontFamily="mono" fontWeight="700" color={P.inkMuted} textTransform="uppercase" letterSpacing="0.1em">Username</Text>
                      <Text fontSize="xs" color={P.ink} fontWeight="600" fontFamily="mono">{client.username || '—'}</Text>
                    </HStack>
                  </VStack>
                </Box>
                <Text color={P.inkMuted} fontSize="xs">Safe to run again. If they already have a portal account the email is just resent with their current PIN.</Text>
              </VStack>
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelRef} onClick={() => setIsOpen(false)} variant="ghost" color={P.inkMuted} size="sm" isDisabled={loading} _hover={{ color: P.ink, bg: P.sunken }}>Cancel</Button>
              <Button onClick={handleActivate} bg={P.green} color={P.sheet} size="sm" borderRadius="full" fontWeight="700" leftIcon={<Icon as={TbMailForward} boxSize={3.5} />} isLoading={loading} loadingText="Activating" _hover={{ bg: '#4C6618' }}>Send welcome email</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default ActivateClientButton;
