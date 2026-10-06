// src/pages/Settings/panes/Profile.jsx
// SENTINEL: NB_PULSE_SETTINGS_PROFILE_V1
//
// Profile, for everybody who signs in. Two things that used to be two
// components, SettingsAvatar and SettingsProfile, in one pane, logic
// unchanged:
//   the picture   uploads to the avatars bucket at users/<id>/avatar.<ext>,
//                 writes the public url with a cache buster onto profiles
//   the details   display name, username with the live availability check,
//                 phone, and the email read only
//
// ── WHAT MOVED IN THE LOOK ──────────────────────────────────────────────────
// The picture is a settings row now, label and line on the left, the face
// and a Change button on the right. The old lime camera badge is gone, it
// spent the screen's one lime on a corner and Save profile is the button
// that should carry it. The fields stay a stack on MEASURE, a row with an
// input on the right is too narrow for a name on a phone.
//
// The username is what a person types to sign in, so the hint says so.
// Lowercase letters, digits and underscores, three at least, the same rule
// as before.
//
// No oxford commas, no em dashes.

import { useRef, useState, useEffect } from 'react';
import {
  Box, Center, VStack, HStack, Text, Input, Button, Icon, Spinner, useToast,
  InputGroup, InputLeftElement, InputRightElement,
} from '@chakra-ui/react';
import { TbMail, TbCheck, TbAlertTriangle, TbAt, TbPhone } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { formatPhoneDisplay, formatPhoneStorage, isValidPhone } from '../../../utils/phone';
import colors from '../../../theme/colors';
import { TYPE, INSET, FIELD_H, FIELD_RADIUS, MEASURE, HEAD_GAP, EASE, FAST } from '../../../theme/layout';
import { PageHead, Section, Field, Rows, Row } from '../../../components/common/Page';
import Avatar from '../../../components/common/Avatar';

const P = colors.paper;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const Picture = ({ user, profile, setProfile }) => {
  const toast = useToast();
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'A picture has to be under 5MB', status: 'warning', duration: 3000 });
      return;
    }
    if (!TYPES.includes(file.type)) {
      toast({ title: 'Not a picture Pulse takes', description: 'Use JPG, PNG, WebP or GIF', status: 'warning', duration: 3000 });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const filePath = `users/${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (updateError) throw updateError;
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
      toast({ title: 'Picture updated', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setUploading(false);
    }
  };

  const open = () => !uploading && input.current?.click();

  return (
    <HStack spacing={3}>
      <Box
        as="button"
        type="button"
        onClick={open}
        aria-label="Change your picture"
        position="relative"
        borderRadius="full"
        transition={`transform ${FAST} ${EASE}`}
        _hover={{ transform: 'scale(1.03)' }}
        _focusVisible={{ outline: `2px solid ${P.limeDeep}`, outlineOffset: '2px' }}
      >
        <Avatar name={profile?.display_name || profile?.username || 'NB'} url={profile?.avatar_url} size="lg" border />
        {uploading && (
          <Center position="absolute" inset={0} borderRadius="full" bg="rgba(36,26,22,0.55)">
            <Spinner size="sm" color={P.sheet} thickness="2px" />
          </Center>
        )}
      </Box>
      <Button size="sm" variant="outline" onClick={open} isDisabled={uploading}>
        {uploading ? 'Uploading' : 'Change'}
      </Button>
      <input ref={input} type="file" accept={TYPES.join(',')} style={{ display: 'none' }} onChange={upload} />
    </HStack>
  );
};

const Details = ({ user, profile, setProfile }) => {
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
    if (!username || username === profile?.username) { setUsernameAvailable(null); return undefined; }
    if (!usernameValid) { setUsernameAvailable(false); return undefined; }
    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', usernameClean).neq('id', user.id).maybeSingle();
      setUsernameAvailable(!data);
      setCheckingUsername(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [username, profile?.username, user?.id, usernameValid, usernameClean]);

  const save = async () => {
    if (!displayName.trim()) { toast({ title: 'A display name is needed', status: 'warning', duration: 2000 }); return; }
    if (username && !usernameValid) { toast({ title: 'That username will not work', description: 'Lowercase letters, numbers and underscores, three at least', status: 'warning', duration: 3000 }); return; }
    if (username && username !== profile?.username && usernameAvailable === false) { toast({ title: 'That username is taken', status: 'warning', duration: 2000 }); return; }

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
    <VStack spacing={5} align="stretch" maxW={MEASURE}>
      <Field label="Display name">
        <Input placeholder="Tyler Reagan" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>

      <Field label="Username" hint="what you type to sign in">
        <InputGroup>
          <InputLeftElement pointerEvents="none" pl={INSET} w="auto" h={FIELD_H}>
            <Icon as={TbAt} boxSize={4} color={P.inkFaint} />
          </InputLeftElement>
          <Input placeholder="treagan" value={username} onChange={(e) => setUsername(e.target.value)} pl={10} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          {username && username !== profile?.username && (
            <InputRightElement pr={INSET} w="auto" h={FIELD_H}>
              {checkingUsername
                ? <Text fontSize={TYPE.label} color={P.inkMuted}>checking</Text>
                : <Icon as={usernameAvailable ? TbCheck : TbAlertTriangle} color={usernameAvailable ? P.green : P.gold} boxSize={4} aria-label={usernameAvailable ? 'available' : 'not available'} />}
            </InputRightElement>
          )}
        </InputGroup>
        <Text fontSize={TYPE.label} color={P.inkFaint}>Lowercase letters, numbers and underscores, three at least.</Text>
      </Field>

      <Field label="Phone">
        <InputGroup>
          <InputLeftElement pointerEvents="none" pl={INSET} w="auto" h={FIELD_H}>
            <Icon as={TbPhone} boxSize={4} color={P.inkFaint} />
          </InputLeftElement>
          <Input type="tel" placeholder="(970) 555-1234" value={phone} onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))} pl={10} />
          {phoneValid !== null && (
            <InputRightElement pr={INSET} w="auto" h={FIELD_H}>
              <Icon as={phoneValid ? TbCheck : TbAlertTriangle} color={phoneValid ? P.green : P.gold} boxSize={4} />
            </InputRightElement>
          )}
        </InputGroup>
      </Field>

      <Field label="Email" hint="read only">
        <HStack h={FIELD_H} px={INSET} borderRadius={FIELD_RADIUS} border="1px solid" borderColor={P.hair} bg={P.sunken} spacing={2.5}>
          <Icon as={TbMail} boxSize={4} color={P.inkFaint} flexShrink={0} />
          <Text fontSize={TYPE.body} color={P.inkSec} flex={1} noOfLines={1}>{user?.email}</Text>
        </HStack>
      </Field>

      <Box pt={1}>
        <Button size="md" isLoading={saving} loadingText="Saving" onClick={save} leftIcon={saved ? <TbCheck /> : undefined}>
          {saved ? 'Saved' : 'Save profile'}
        </Button>
      </Box>
    </VStack>
  );
};

const Profile = ({ user, profile, setProfile }) => (
  <VStack align="stretch" spacing={HEAD_GAP}>
    <PageHead kicker="Settings" title="Profile" lede="How you appear to the studio, and the name you sign in with." />
    <Rows borderTop="1px solid" borderBottom="1px solid" borderColor={P.hair}>
      <Row
        label="Picture"
        desc="Beside your name everywhere in Pulse. JPG, PNG, WebP or GIF, under 5MB."
        control={<Picture user={user} profile={profile} setProfile={setProfile} />}
      />
    </Rows>
    <Section kicker="Details">
      <Details user={user} profile={profile} setProfile={setProfile} />
    </Section>
  </VStack>
);

export default Profile;
