// src/hooks/useAuth.jsx
// Auth for Pulse. Holds the signed in user and one more fact, whether this
// session came from a password reset link and has not set a new password yet.
//
// ── WHY RECOVERING EXISTS ───────────────────────────────────────────────────
// A Supabase reset link is a sign in. Clicking it lands on the page with
// tokens in the hash marked type=recovery, supabase-js turns them into a full
// session and fires PASSWORD_RECOVERY. Pulse ignored that event, so a reset
// link that landed anywhere but /reset-password/ simply let the person in
// and never asked for a new password. Tyler, 2026-10-05, clicked the reset
// button in his own mail and was dropped straight into Pulse. That happens
// whenever Supabase falls back to the Site URL instead of the redirect the
// page asked for, a localhost dev server, a send from the dashboard, a
// redirect missing from the allow list.
//
// So a recovery session is held. ProtectedRoute sends it to /reset-password/
// until the password changes, and nothing else in Pulse opens for it.
//
// ── THE TRAPS ───────────────────────────────────────────────────────────────
// The hash is read once at module load, before supabase-js clears it. The
// client clears it only after a network round trip for the user, so this read
// always wins, and it does not depend on our listener being subscribed before
// the PASSWORD_RECOVERY event fires. The listener is the second net.
// The flag lives in localStorage because the recovery session does. A flag in
// sessionStorage would let a second tab in.
// It clears on USER_UPDATED, which updateUser fires once the new password is
// saved, on SIGNED_OUT, and when signIn succeeds with a password, because a
// person who just typed the right password has nothing to reset.
// Do not clear it on SIGNED_IN. ResetPassword.jsx calls setSession with the
// hash tokens when it still sees them and that fires SIGNED_IN for the very
// recovery session this flag is holding.
//
// No oxford commas, no em dashes.

import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

const RECOVERY_KEY = 'nb_pulse_recovery';

const readFlag = () => {
  try { return window.localStorage.getItem(RECOVERY_KEY) === '1'; } catch { return false; }
};

const writeFlag = (on) => {
  try {
    if (on) window.localStorage.setItem(RECOVERY_KEY, '1');
    else window.localStorage.removeItem(RECOVERY_KEY);
  } catch { /* storage blocked, the in memory state still holds this tab */ }
};

// Read before supabase-js clears the hash. See the note above.
const ARRIVED_BY_RECOVERY = typeof window !== 'undefined'
  && /(?:^|[#?&])type=recovery(?:&|$)/.test(`${window.location.hash}&${window.location.search}`);
if (ARRIVED_BY_RECOVERY) writeFlag(true);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(() => ARRIVED_BY_RECOVERY || readFlag());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        writeFlag(true);
        setRecovering(true);
      } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        writeFlag(false);
        setRecovering(false);
      }
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    writeFlag(false);
    setRecovering(false);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    writeFlag(false);
    setRecovering(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, recovering, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
