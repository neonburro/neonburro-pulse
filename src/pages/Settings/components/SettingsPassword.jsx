// src/pages/Settings/components/SettingsPassword.jsx
// Change password on Paper. Verifies the current password by re signing in,
// then updates. House fields and labels. No dashes, no oxford commas.

import { useState } from 'react';
import { VStack, Input, Button, Icon, useToast, Box, InputGroup, InputRightElement } from '@chakra-ui/react';
import { TbCheck, TbEye, TbEyeOff } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { INSET } from '../../../theme/layout';
import { Section, Field } from '../../../components/common/Page';

const P = colors.paper;

const PasswordField = ({ label, value, onChange, autoComplete, show, onToggle }) => (
  <Field label={label}>
    <InputGroup>
      <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={show ? '' : '••••••••'} pr={12} />
      <InputRightElement pr={INSET} w="auto">
        <Box as="button" type="button" onClick={onToggle} p={1} borderRadius="md" color={P.inkFaint} _hover={{ color: P.ink }} transition="all 0.15s" aria-label={show ? 'Hide password' : 'Show password'}>
          <Icon as={show ? TbEyeOff : TbEye} boxSize={4} />
        </Box>
      </InputRightElement>
    </InputGroup>
  </Field>
);

const SettingsPassword = ({ user }) => {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);

  const handleChange = async () => {
    setChanged(false);
    if (newPassword.length < 6) { toast({ title: 'Password too short', description: 'Must be at least 6 characters', status: 'warning', duration: 3000 }); return; }
    if (newPassword !== confirmPassword) { toast({ title: 'Passwords do not match', status: 'warning', duration: 3000 }); return; }
    setChanging(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (signInError) throw new Error('Current password is incorrect');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setChanged(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast({ title: 'Password updated', status: 'success', duration: 2000 });
      setTimeout(() => setChanged(false), 3000);
    } catch (err) {
      toast({ title: 'Password change failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setChanging(false);
    }
  };

  return (
    <Section kicker="Password">
      <VStack spacing={5} align="stretch">
        <PasswordField label="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" show={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
        <PasswordField label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" show={showNew} onToggle={() => setShowNew(!showNew)} />
        <PasswordField label="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />

        <Box>
          <Button size="md" variant="outline" isLoading={changing} loadingText="Updating" onClick={handleChange} isDisabled={!currentPassword || !newPassword || !confirmPassword} leftIcon={changed ? <TbCheck /> : undefined}>
            {changed ? 'Password updated' : 'Change password'}
          </Button>
        </Box>
      </VStack>
    </Section>
  );
};

export default SettingsPassword;
