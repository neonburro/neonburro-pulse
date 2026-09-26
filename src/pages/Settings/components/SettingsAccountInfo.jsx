// src/pages/Settings/components/SettingsAccountInfo.jsx
// Read only account facts on Paper: role, member since, last login, user id.
// A section like the others. No oxford commas, no dashes.

import { VStack, HStack, Text, Icon, Divider } from '@chakra-ui/react';
import { TbCalendar, TbClock, TbShield, TbId } from 'react-icons/tb';
import { format } from 'date-fns';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Section } from '../../../components/common/Page';

const P = colors.paper;

const InfoRow = ({ icon, label, value, mono = false }) => (
  <HStack justify="space-between" py={3}>
    <HStack spacing={2.5}>
      <Icon as={icon} boxSize={3.5} color={P.inkFaint} />
      <Text color={P.inkMuted} fontSize={TYPE.small} fontWeight="600">{label}</Text>
    </HStack>
    <Text color={P.ink} fontSize={TYPE.small} fontWeight="700" fontFamily={mono ? 'mono' : undefined}>{value}</Text>
  </HStack>
);

const SettingsAccountInfo = ({ user, profile }) => {
  const memberSince = profile?.created_at ? format(new Date(profile.created_at), 'MMM d, yyyy') : 'unknown';
  const lastLogin = user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d · h:mm a') : 'first session';
  const userId = user?.id ? `${user.id.slice(0, 8)}...` : 'unknown';

  return (
    <Section kicker="Account">
      <VStack spacing={0} align="stretch" divider={<Divider borderColor={P.hairSoft} />}>
        <InfoRow icon={TbShield} label="Role" value={profile?.role?.toUpperCase() || 'STAFF'} mono />
        <InfoRow icon={TbCalendar} label="Member since" value={memberSince} />
        <InfoRow icon={TbClock} label="Last login" value={lastLogin} />
        <InfoRow icon={TbId} label="User ID" value={userId} mono />
      </VStack>
    </Section>
  );
};

export default SettingsAccountInfo;
