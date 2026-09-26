// src/pages/Settings/components/SettingsFooter.jsx
// Sign out, and the version line, on Paper. Left aligned. No oxford commas,
// no dashes.

import { HStack, Text, VStack, Button, useToast } from '@chakra-ui/react';
import { TbLogout } from 'react-icons/tb';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';

const P = colors.paper;

const SettingsFooter = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: 'Signed out', status: 'success', duration: 2000 });
      navigate('/login/');
    } catch {
      toast({ title: 'Sign out failed', status: 'error', duration: 2000 });
    }
  };

  return (
    <VStack spacing={5} align="stretch" pt={2}>
      <HStack>
        <Button size="md" variant="outline" leftIcon={<TbLogout size={16} />} onClick={handleSignOut} _hover={{ color: P.coral, borderColor: `${P.coral}66`, bg: `${P.coral}0F` }}>
          Sign out
        </Button>
      </HStack>
      <HStack justify="space-between" pt={4} borderTop="1px solid" borderColor={P.hairSoft}>
        <Text fontSize={TYPE.label} color={P.inkFaint} fontFamily="mono">neonburro pulse</Text>
        <Text fontSize={TYPE.label} color={P.inkFaint} fontFamily="mono">v1.1.0</Text>
      </HStack>
    </VStack>
  );
};

export default SettingsFooter;
