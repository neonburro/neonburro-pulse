// src/pages/Settings/panes.js
// SENTINEL: NB_PULSE_SETTINGS_PANES_V1
//
// The one list of Settings panes, the way src/lib/nav.js is the one list of
// pages. The left list, the phone list and the router guard all read this
// file, so a pane is added once and appears everywhere it should.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
// Tyler, 2026-10-05, after a dozen screenshots of the Claude desktop
// settings: "We need to build out Pulse kind of like Claude Code is built
// out." Their left list is grouped, Settings, This computer, Customize and
// Platform. Pulse has two groups because it has two kinds of thing:
//   You        yours, for everybody who signs in, client or studio
//   Studio     the studio's own, the team and the tools it runs on
// The first group is not called Settings because on a phone the list sits
// under a page title that already says Settings, and a kicker repeating the
// title reads as a stutter.
//
// ── WHO SEES THE STUDIO GROUP ───────────────────────────────────────────────
// STUDIO_ROLES is super_admin and admin. It is the same pair the old Team
// section was shown to, and the same pair netlify/functions/studio-tools.js
// and trademark-watch.js let through. Clients sign in to Pulse too, and
// ProtectedRoute checks a session and never a role, so this list is where
// the pane is hidden and the function is where it is refused. If a role is
// added here, add it in studio-tools.js in the same commit or the pane
// opens on a 403.
//
// ── URLS ────────────────────────────────────────────────────────────────────
// Each pane is /settings/<key>/ with the trailing slash. /settings/ alone
// is the Profile pane beside the list on a wide screen and the list by
// itself on a phone. A key that is unknown, or a studio pane opened by
// somebody without the role, goes back to /settings/.
//
// No oxford commas, no em dashes.

import { TbUser, TbShieldLock, TbBell, TbPalette, TbUsers, TbPlug } from 'react-icons/tb';

export const STUDIO_ROLES = ['super_admin', 'admin'];
export const DEFAULT_PANE = 'profile';

export const GROUPS = [
  {
    key: 'you',
    label: 'You',
    panes: [
      { key: 'profile', label: 'Profile', icon: TbUser, desc: 'Your name, your picture and how you sign in' },
      { key: 'account', label: 'Account', icon: TbShieldLock, desc: 'Password, role and where you are signed in' },
      { key: 'notifications', label: 'Notifications', icon: TbBell, desc: 'What Pulse sends and where it lands' },
      { key: 'appearance', label: 'Appearance', icon: TbPalette, desc: 'The paper and the sidebar' },
    ],
  },
  {
    key: 'studio',
    label: 'Studio',
    roles: STUDIO_ROLES,
    panes: [
      { key: 'team', label: 'Team', icon: TbUsers, desc: 'Everybody with a studio role' },
      { key: 'tools', label: 'Tools', icon: TbPlug, desc: 'The services the studio runs on' },
    ],
  },
];

export const isStudio = (role) => STUDIO_ROLES.includes(role);

export const groupsFor = (role) => GROUPS.filter((g) => !g.roles || g.roles.includes(role));

export const paneFor = (key, role) => groupsFor(role).flatMap((g) => g.panes).find((p) => p.key === key) || null;

export const panePath = (key) => `/settings/${key}/`;
