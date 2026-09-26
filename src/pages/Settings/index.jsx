// src/pages/Settings/index.jsx
// Settings, on Paper. A form, so it sits on MEASURE, kicker, title and lede
// up top like every page, then the sections, each a kicker and its fields.
// Team management is visible to super_admin and admin. No oxford commas, no
// dashes.

import { useState, useEffect } from 'react';
import { Divider } from '@chakra-ui/react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { Page, Loading } from '../../components/common/Page';
import SettingsHeader from './components/SettingsHeader';
import SettingsAvatar from './components/SettingsAvatar';
import SettingsProfile from './components/SettingsProfile';
import SettingsPassword from './components/SettingsPassword';
import SettingsTeam from './components/SettingsTeam';
import SettingsAccountInfo from './components/SettingsAccountInfo';
import SettingsFooter from './components/SettingsFooter';

const P = colors.paper;
const SectionDivider = () => <Divider borderColor={P.hair} />;

const Settings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!error && data) setProfile(data);
    setLoading(false);
  };

  const canManageTeam = ['super_admin', 'admin'].includes(profile?.role);

  if (loading) {
    return <Page measure><Loading label="loading your profile" /></Page>;
  }

  return (
    <Page measure>
      <SettingsHeader />
      <SettingsAvatar user={user} profile={profile} setProfile={setProfile} />
      <SectionDivider />
      <SettingsProfile user={user} profile={profile} setProfile={setProfile} />
      <SectionDivider />
      <SettingsPassword user={user} />
      {canManageTeam && (
        <>
          <SectionDivider />
          <SettingsTeam currentUserId={user.id} currentUserRole={profile?.role} />
        </>
      )}
      <SectionDivider />
      <SettingsAccountInfo user={user} profile={profile} />
      <SettingsFooter user={user} />
    </Page>
  );
};

export default Settings;
