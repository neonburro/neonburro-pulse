// src/lib/nav.js
// SENTINEL: NB_PULSE_NAV_V1
//
// ONE nav model. The sidebar and the bottom bar both read this file, and that
// is the entire reason it exists.
//
// THE TWO BUGS THIS FIXES, BOTH REAL, BOTH SHIPPED
//
// 1. MESSAGES WAS UNREACHABLE ON A PHONE. The sidebar listed it. The bottom
//    bar's four primary tabs did not, and neither did the More sheet. A whole
//    feature existed on desktop and did not exist on mobile, because the two
//    lists were typed out separately and drifted.
//
// 2. THE PROJECTS TAB WENT NOWHERE. /projects/ redirects to /clients/ in
//    App.jsx, so the fourth tab on every phone navigated somewhere with a
//    different name and then failed to highlight, because isActive checked a
//    path the router had already thrown away.
//
// ORDERS SITS ABOVE FORMS ON PURPOSE. Forms is interest and can wait until
// Thursday. Orders is money already taken and a confirmation email that told
// somebody a person is on it, so it reads first. It is also inside the four
// primary tabs on a phone, which is the whole point of putting it there.
//
// HOW TO ADD A PAGE
// Add it to NAV once. It appears in the sidebar automatically. If it belongs on
// a phone's primary bar, move it above the MOBILE_PRIMARY_COUNT line. Everything
// below that line lands in the More sheet. There is nowhere else to edit.
//
// No oxford commas, no em dashes.

import {
  TbSunrise, TbUsers, TbFileInvoice, TbInbox,
  TbPencil, TbHorse, TbCoins, TbWallet, TbMessageCircle, TbCalendar, TbChartBar, TbSettings,
  TbBroadcast, TbCoin, TbMap2,
} from 'react-icons/tb';

export const NAV = [
  { path: '/today/',     label: 'Today',      icon: TbSunrise,       desc: 'What moved, and what needs you' },
  { path: '/clients/',   label: 'Clients',    icon: TbUsers,         desc: 'Everybody we build for' },
  { path: '/invoicing/', label: 'Invoicing',  icon: TbFileInvoice,   desc: 'Sprints, invoices and what is owed' },
  { path: '/orders/',    label: 'Orders',     icon: TbCoin,          desc: 'Paid and waiting on somebody here' },
  { path: '/forms/',     label: 'Forms',      icon: TbInbox,         desc: 'Inbound submissions' },
  { path: '/blog/',      label: 'Blog',       icon: TbPencil,        desc: 'Posts and the social run' },
  { path: '/socials/',   label: 'Socials',    icon: TbBroadcast,     desc: 'Every voice, account and release' },
  { path: '/yard/',      label: 'Yard',       icon: TbHorse,         desc: 'The send a burro call' },
  { path: '/neonburro/', label: 'NEONBURRO',  icon: TbCoins,         desc: 'Services, reserves and receipts' },
  { path: '/registry/',  label: 'Registry',   icon: TbWallet,        desc: 'The book of our own wallets' },
  { path: '/wallets/',   label: 'Wallets',    icon: TbMap2,          desc: 'The public map, before it is published' },
  { path: '/messages/',  label: 'Messages',   icon: TbMessageCircle, desc: 'Threads with clients' },
  { path: '/calendar/',  label: 'Calendar',   icon: TbCalendar,      desc: 'Scheduling and sprints' },
  { path: '/analytics/', label: 'Analytics',  icon: TbChartBar,      desc: 'Traffic and trends' },
];

export const SETTINGS_ITEM = {
  path: '/settings/', label: 'Settings', icon: TbSettings, desc: 'Profile and preferences',
};

// Four plus a More button is the ceiling for a thumb. Five icons on a small
// phone puts every target under 44px and people start missing.
export const MOBILE_PRIMARY_COUNT = 4;

export const MOBILE_PRIMARY = NAV.slice(0, MOBILE_PRIMARY_COUNT);
export const MOBILE_MORE = [...NAV.slice(MOBILE_PRIMARY_COUNT), SETTINGS_ITEM];

// /dashboard/ is the old path and still redirects, so a bookmark or an old
// email link keeps working. Both count as home.
export const HOME_PATHS = ['/', '/today/', '/dashboard/'];

export const isActivePath = (pathname, path) => {
  if (path === '/today/') return HOME_PATHS.includes(pathname);
  return pathname.startsWith(path);
};

export default NAV;
