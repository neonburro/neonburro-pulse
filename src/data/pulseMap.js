// src/data/pulseMap.js
// SENTINEL: NB_PULSE_MAP_V1
//
// The map of Pulse in words, one entry per route, written 2026-09-25 from
// src/App.jsx, src/lib/nav.js and the header block of every page. It exists
// so netlify/functions/volt-chat.js can hand Volt a true picture of the
// tool he sits inside, and it is data in src/ so the page that adds a route
// can add its line beside it. A route not in this list is a route Volt
// does not know exists, so when a page is added or a page changes what it
// holds, change the line here in the same commit.
//
// holds is what the page carries, in plain words. can is what a person can
// do there. Neither says what Volt can do, that is the tool list in
// volt-chat.js, and Volt is told to say so when a thing is outside it.
//
// No oxford commas, no em dashes.

export const PULSE_MAP = [
  {
    path: '/today/',
    name: 'Today',
    holds: 'what is waiting on you, the numbers, the forms inbox, the activity stream of the last seven days and the last five asks of volt with their status',
    can: 'read the state of the studio, mark an ask of volt done',
  },
  {
    path: '/clients/',
    name: 'Clients',
    holds: 'everybody the studio builds for, one row each with status, the newest subscription and a health pip',
    can: 'add a client, open a profile, filter and search',
  },
  {
    path: '/clients/:clientId/',
    name: 'Client profile',
    holds: 'one client, seven tabs, Overview, Sprints, Invoices, Recurring, Projects, Sites and Messages, with four stat cards up top',
    can: 'manage the avatar, the PIN, impersonation and activation, connect a Netlify site, read every invoice and thread for that client',
  },
  {
    path: '/invoicing/',
    name: 'Invoicing',
    holds: 'sprints, invoices and what is owed, drafts, sent and paid, plus the Draft with Volt door which is the same drafter as the draft_invoice tool',
    can: 'draft an invoice, preview it in the editor, send it, resend it, remind, mark paid, cancel. an invoice is line items each with a payment mode, pay_full, deposit_50 or approve_only',
  },
  {
    path: '/orders/',
    name: 'Orders',
    holds: 'the queue, what somebody paid for through the site and nobody has made yet, every service sold without a conversation',
    can: 'read the brief, see the payment, work the order and close it',
  },
  {
    path: '/forms/',
    name: 'Forms',
    holds: 'every inbound submission from the studio site in one inbox, realtime, with the replies beside them',
    can: 'read a submission, reply to it with a preview before it goes, archive it',
  },
  {
    path: '/blog/',
    name: 'Blog',
    holds: 'the writing desk, every post the studio has drafted or published, published rows link to the live page on neonburro.com',
    can: 'start a draft, open a post, publish which wakes the studio build and drafts socials, unpublish',
  },
  {
    path: '/socials/',
    name: 'Socials',
    holds: 'every public release on one row, the month calendar, the council voice, the publishing account, the picked plate, the human approval and the drawer where Draft with Volt is the same drafter as the draft_release tool',
    can: 'draft a post onto a release, stage it, approve it and a scheduled hand posts it. channels are facebook, instagram, x, telegram and reddit. a released row is the record and does not change',
  },
  {
    path: '/yard/',
    name: 'Yard',
    holds: 'the send a burro call, every entry across every status, the two live dials and the size of the private wallet book, wallets truncated',
    can: 'read an entry properly and decide it',
  },
  {
    path: '/neonburro/',
    name: 'NEONBURRO',
    holds: 'the private operating room for the coin, services, reserves and receipts, the studio\'s own wallets and what they hold, every figure carrying when it was true',
    can: 'observe. nothing here builds a transaction or holds a key',
  },
  {
    path: '/registry/',
    name: 'Registry',
    holds: 'the private book of the studio\'s own labeled wallets, addresses and labels only, never keys, with SOL and NEONBURRO balances read from the chain',
    can: 'add a labeled wallet, read balances',
  },
  {
    path: '/messages/',
    name: 'Messages',
    holds: 'every client thread in one inbox, newest unanswered first, realtime',
    can: 'reply to a client as yourself or as the client\'s burro persona, a person writes every word',
  },
  {
    path: '/calendar/',
    name: 'Calendar',
    holds: 'appointments on a month grid on desktop and an agenda on a phone, meeting types video, phone and in person',
    can: 'add an appointment, edit one, send the invite and the reminder by mail',
  },
  {
    path: '/analytics/',
    name: 'Analytics',
    holds: 'traffic on the studio site from the first party beacon, the last seven days, plus the honest map of what is wired next',
    can: 'read',
  },
  {
    path: '/settings/',
    name: 'Settings',
    holds: 'the profile, the avatar, the password and for admins the team',
    can: 'edit the profile, change the password, invite a teammate',
  },
];

// One line per page, the shape volt-chat.js puts in the system prompt.
export const pulseMapText = () => PULSE_MAP
  .map((page) => `- ${page.name} at ${page.path}. holds ${page.holds}. a person can ${page.can}.`)
  .join('\n');

export default PULSE_MAP;
