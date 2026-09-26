// src/pages/Dashboard/components/TeamOnlineStrip.jsx
// Avatars of online team members, click goes to /clients/. Paper tooltip.
// Renders nothing when nobody else is here. No oxford commas, no dashes.

import { useState, useEffect } from 'react';
import { HStack, Tooltip, Box } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { usePresence } from '../../../hooks/usePresence';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import Avatar from '../../../components/common/Avatar';

const P = colors.paper;
const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'team'];

const TeamOnlineStrip = () => {
  const navigate = useNavigate();
  const { presenceMap } = usePresence();
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, username, avatar_url, role').in('role', STAFF_ROLES).order('display_name');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  const onlineMembers = profiles.filter((p) => presenceMap[p.id]?.status === 'online');
  if (onlineMembers.length === 0) return null;

  return (
    <HStack spacing={2}>
      {onlineMembers.map((member) => (
        <Tooltip key={member.id} label={member.display_name || member.username || 'Team member'} placement="bottom" hasArrow bg={P.ink} color={P.sheet} fontSize={TYPE.small} openDelay={300}>
          <Box cursor="pointer" onClick={() => navigate('/clients/')} transition="all 0.15s" _hover={{ transform: 'translateY(-1px)' }}>
            <Avatar name={member.display_name || member.username || 'Team'} url={member.avatar_url} size="xs" presence="online" />
          </Box>
        </Tooltip>
      ))}
    </HStack>
  );
};

export default TeamOnlineStrip;
