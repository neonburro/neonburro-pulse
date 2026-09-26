// src/pages/Settings/components/SettingsAvatar.jsx
// Avatar upload on Paper. Click to change, camera badge in lime. Uploads to the
// avatars bucket and writes the public url onto the profile. Left aligned, the
// avatar then the name beside it, no centring. No dashes, no oxford.

import { useRef, useState } from 'react';
import { Box, Center, Icon, useToast, Text, VStack, HStack, Spinner } from '@chakra-ui/react';
import { TbCamera, TbUpload } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import Avatar from '../../../components/common/Avatar';

const P = colors.paper;

const SettingsAvatar = ({ user, profile, setProfile }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [hovering, setHovering] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Avatar must be under 5MB', status: 'warning', duration: 3000 });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please use JPG, PNG, WebP or GIF', status: 'warning', duration: 3000 });
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
      toast({ title: 'Avatar updated', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setUploading(false);
    }
  };

  return (
    <HStack spacing={5} align="center">
      <Box position="relative" cursor="pointer" onClick={() => !uploading && fileInputRef.current?.click()} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} transition="all 0.2s" _hover={{ transform: 'scale(1.02)' }} flexShrink={0}>
        <Box position="absolute" inset="-4px" borderRadius="full" bg={`radial-gradient(circle, ${P.lime}44, transparent 70%)`} opacity={hovering ? 1 : 0} transition="opacity 0.3s" pointerEvents="none" />
        <Avatar name={profile?.display_name || profile?.username || 'NB'} url={profile?.avatar_url} size="xl" border={true} glow={hovering} />
        {hovering && !uploading && (
          <Center position="absolute" inset={0} borderRadius="full" bg="rgba(23,17,12,0.62)" transition="opacity 0.2s">
            <VStack spacing={1}>
              <Icon as={TbUpload} boxSize={5} color={P.sheet} />
              <Text fontSize={TYPE.micro} color={P.sheet} fontWeight="700" letterSpacing="0.1em">CHANGE</Text>
            </VStack>
          </Center>
        )}
        {uploading && (
          <Center position="absolute" inset={0} borderRadius="full" bg="rgba(23,17,12,0.62)">
            <Spinner size="md" color={P.lime} thickness="2px" />
          </Center>
        )}
        <Center position="absolute" bottom="2px" right="2px" w="28px" h="28px" borderRadius="full" bg={P.lime} border="3px solid" borderColor={P.mat} transition="all 0.2s" _hover={{ bg: '#D2E26B', transform: 'scale(1.1)' }}>
          <Icon as={TbCamera} boxSize={3.5} color={P.limeInk} />
        </Center>
      </Box>

      <VStack spacing={0.5} align="start" minW={0}>
        <Text fontSize={TYPE.section} fontWeight="700" color={P.ink} noOfLines={1}>{profile?.display_name || profile?.username || 'No name set'}</Text>
        {profile?.username && <Text fontSize={TYPE.small} color={P.inkMuted} fontFamily="mono">@{profile.username}</Text>}
        <Text fontSize={TYPE.small} color={P.inkFaint}>Click the picture to change it.</Text>
      </VStack>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleUpload} />
    </HStack>
  );
};

export default SettingsAvatar;
