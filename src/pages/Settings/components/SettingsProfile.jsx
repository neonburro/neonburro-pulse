// src/pages/Settings/components/SettingsProfile.jsx
// Display name, username (used to log in, live availability check), phone, and
// the read only email. House fields and labels. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import { VStack, HStack, Text, Input, Button, Icon, useToast, Box, InputGroup, InputRightElement, InputLeftElement } from '@chakra-ui/react';
import { TbMail, TbCheck, TbAlertTriangle, TbAt, TbPhone } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { formatPhoneDisplay, formatPhoneStorage, isValidPhone } from '../../../utils/phone';
import colors from '../../../theme/colors';
import { TYPE, INSET, FIELD_H, FIELD_RADIUS } from '../../../theme/layout';
import { Section, Field } from '../../../components/common/Page';

const P = colors.paper;

const SettingsProfile = ({ user, profile, setProfile }) => {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [phone, setPhone] = useState(formatPhoneDisplay(profile?.phone || ''));
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const phoneValid = phone ? isValidPhone(phone) : null;
  const usernameClean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const usernameValid = usernameClean.length >= 3 && usernameClean === username.toLowerCase();

  useEffect(() => {
    if (!username || username === profile?.username) { setUsernameAvailable(null); return; }
    if (!usernameValid) { setUsernameAvailable(false); return; }
    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', usernameClean).neq('id', user.id).maybeSingle();
      setUsernameAvailable(!data);
      setCheckingUsername(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [username, profile?.username, user.id, usernameValid, usernameClean]);

  const handleSave = async () => {
    if (!displayName.trim()) { toast({ title: 'Display name required', status: 'warning', duration: 2000 }); return; }
    if (username && !usernameValid) { toast({ title: 'Invalid username', description: 'Use lowercase letters, numbers and underscores (min 3 chars)', status: 'warning', duration: 3000 }); return; }
    if (username && username !== profile?.username && usernameAvailable === false) { toast({ title: 'Username taken', status: 'warning', duration: 2000 }); return; }

    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(), username: usernameClean || null, phone: formatPhoneStorage(phone) || null, updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) { toast({ title: 'Save failed', description: error.message, status: 'error', duration: 3000 }); setSaving(false); return; }
    setProfile((prev) => ({ ...prev, display_name: displayName.trim(), username: usernameClean || null, phone: formatPhoneStorage(phone) || null }));
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: 'Profile saved', status: 'success', duration: 2000 });
  };

  return (
    <Section kicker="Profile">
      <VStack spacing={5} align="stretch">
        <Field label="Display name">
          <Input placeholder="Tyler Reagan" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>

        <Field label="Username" hint="used to log in. lowercase letters, numbers and underscores">
          <InputGroup>
            <InputLeftElement pointerEvents="none" pl={INSET} w="auto">
              <Icon as={TbAt} boxSize={4} color={P.inkFaint} />
            </InputLeftElement>
            <Input placeholder="treagan" value={username} onChange={(e) => setUsername(e.target.value)} pl={10} />
            {username && username !== profile?.username && (
              <InputRightElement pr={INSET} w="auto">
                {checkingUsername ? <Text fontSize={TYPE.label} color={P.inkMuted}>checking</Text> : <Icon as={usernameAvailable ? TbCheck : TbAlertTriangle} color={usernameAvailable ? P.green : P.gold} boxSize={4} />}
              </InputRightElement>
            )}
          </InputGroup>
        </Field>

        <Field label="Phone">
          <InputGroup>
            <InputLeftElement pointerEvents="none" pl={INSET} w="auto">
              <Icon as={TbPhone} boxSize={4} color={P.inkFaint} />
            </InputLeftElement>
            <Input type="tel" placeholder="(970) 555-1234" value={phone} onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))} pl={10} />
            {phoneValid !== null && (
              <InputRightElement pr={INSET} w="auto"><Icon as={phoneValid ? TbCheck : TbAlertTriangle} color={phoneValid ? P.green : P.gold} boxSize={4} /></InputRightElement>
            )}
          </InputGroup>
        </Field>

        <Field label="Email" hint="read only">
          <HStack h={FIELD_H} px={INSET} borderRadius={FIELD_RADIUS} border="1px solid" borderColor={P.hair} bg={P.sheet}>
            <Icon as={TbMail} boxSize={4} color={P.inkFaint} />
            <Text fontSize={TYPE.body} color={P.inkSec} flex={1}>{user?.email}</Text>
          </HStack>
        </Field>

        <Box>
          <Button size="md" isLoading={saving} loadingText="Saving" onClick={handleSave} leftIcon={saved ? <TbCheck /> : undefined}>
            {saved ? 'Saved' : 'Save profile'}
          </Button>
        </Box>
      </VStack>
    </Section>
  );
};

export default SettingsProfile;
