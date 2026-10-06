// src/pages/Settings/index.jsx
// SENTINEL: NB_PULSE_SETTINGS_V2
//
// Settings, rebuilt 2026-10-05 in the shape of the Claude desktop settings
// Tyler pointed at: a grouped list on the left and one pane beside it, a
// plain title and one muted line, then rows of a label and a line with the
// control on the right. "Pulse needs to subtly start getting better and
// better and looking like that." It was one long column on MEASURE before,
// avatar, profile, password, team, account facts and sign out in a stack.
//
// Every setting that column had still works, it moved:
//   avatar, display name, username, phone, email      Profile
//   password, role, member since, last login, id      Account
//   sign out                                           Account
//   team list, role changes, invite                    Team, studio only
// Added: sign out everywhere on Account, the sidebar width on Appearance
// (profiles.sidebar_collapsed, which only the chevron on the rail could
// reach), the map of what Pulse sends on Notifications and the services the
// studio runs on, with real status, on Tools.
//
// This file loads the profile and reads the pane from the URL. It draws
// nothing itself, components/SettingsFrame.jsx does, so the dev review route
// can draw the same frame from sample data. The pane list and who sees what
// are in panes.js.
//
// No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Page, Loading } from '../../components/common/Page';
import SettingsFrame from './components/SettingsFrame';
import { paneFor } from './panes';

const Settings = () => {
  const { user } = useAuth();
  const { pane } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!cancelled) {
        if (!error && data) setProfile(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return <Page><Loading label="loading your settings" /></Page>;
  }

  // An unknown pane, or a studio pane opened without the role, goes back to
  // the list. Nothing studio leaks by typing a URL.
  if (pane && !paneFor(pane, profile?.role)) {
    return <Navigate to="/settings/" replace />;
  }

  return <SettingsFrame user={user} profile={profile} setProfile={setProfile} pane={pane} />;
};

export default Settings;
