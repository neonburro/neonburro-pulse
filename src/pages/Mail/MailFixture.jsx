// src/pages/Mail/MailFixture.jsx
//
// A DEVELOPMENT ONLY DOOR FOR LOOKING AT THE MAIL ROOM
//
// App.jsx mounts this at /__review/mail/ (the editor),
// /__review/mail/room/ (the list) and /__review/answer/ (the public answer
// page, outside the shell) only while Vite runs in development, the
// same arrangement as BrandKitReviewFixture.jsx. It hands the real
// components the sample letter from src/lib/mailDocument.js, which carries
// no client, no address but the studio's own and no real code, because
// this repository is public. With a fixture the editor and the room read
// nothing, write nothing and send nothing, and every button says so.
//
// It sits inside the real AppShell so the pages are seen beside the real
// sidebar at 1440 and above the real bottom pill on a phone, which is the
// only way the three widths mean anything.
//
// No oxford commas, no em dashes.

import { Box } from '@chakra-ui/react';
import AppShell from '../../components/Layout/AppShell';
import { PresenceProvider } from '../../hooks/usePresence';
import { sampleMail, blankMail, PRESETS } from '../../lib/mailDocument';
import colors from '../../theme/colors';
import MailEditor from './MailEditor';
import MailRoom from './index';
import Answer from '../Answer';
import { Page, PageHead, Kicker } from '../../components/common/Page';
import { EmailsSection, OpenItemsSection, ProposedUpdatesSection } from './client';

const P = colors.paper;

// Three rows that show every state the list can draw, a sent letter in a
// client preset, a draft on the house colours and an empty new one.
const ROOM_ROWS = [
  {
    id: 'fixture-a',
    status: 'sent',
    sent_at: '2026-10-01T15:04:00Z',
    updated_at: '2026-10-01T15:04:00Z',
    clients: { name: 'A client', company: 'A client in navy and red' },
    doc: { ...sampleMail(), subject: 'September, in one place', cc: ['office@example.com', 'team@example.com'], theme: { preset: 'greenville', ...PRESETS.greenville.base } },
  },
  {
    id: 'fixture-b',
    status: 'draft',
    sent_at: null,
    updated_at: '2026-10-05T11:20:00Z',
    clients: null,
    doc: sampleMail(),
  },
  {
    id: 'fixture-c',
    status: 'draft',
    sent_at: null,
    updated_at: '2026-10-05T11:40:00Z',
    clients: null,
    doc: blankMail(),
  },
  {
    id: 'fixture-d',
    status: 'proposed',
    kind: 'system_update',
    origin: 'system:seed',
    sent_at: null,
    created_at: '2026-10-05T12:10:00Z',
    updated_at: '2026-10-05T12:10:00Z',
    clients: { name: 'A client', company: 'A client in navy and red' },
    doc: { ...sampleMail(), subject: 'A client, system update' },
  },
];

const ANSWER_ITEM = {
  title: 'Approve a support login for the studio',
  detail: 'One account so the studio can look at the desk without borrowing anybody\u2019s sign in.',
  kind: 'access',
  choices: [],
  status: 'open',
  opened_at: '2026-09-21',
  client: 'A client',
};

// Open items at every age the section draws, fresh, two weeks, five months,
// one answered through the link and not yet seen.
const CLIENT_ITEMS = [
  { id: 'c1', title: 'An invoice that was never opened', detail: 'Sent in April.', kind: 'payment', status: 'open', opened_at: '2026-04-14T12:00:00Z', token: 'fixture-a' },
  { id: 'c2', title: 'Keep the back office or switch it off', detail: 'From last month\u2019s report.', kind: 'decision', status: 'open', opened_at: '2026-09-21T12:00:00Z', token: 'fixture-b' },
  { id: 'c3', title: 'How often should the report arrive', detail: '', kind: 'decision', choices: ['Weekly', 'Every two weeks', 'Monthly'], status: 'open', opened_at: '2026-10-05T12:00:00Z', token: 'fixture-c' },
  { id: 'c4', title: 'Approve a support login for the studio', kind: 'access', status: 'approved', opened_at: '2026-10-01T12:00:00Z', answered_at: '2026-10-05T13:49:00Z', answered_by: 'A person', answered_via: 'link', answer_device: 'iPhone, Safari', answer_note: 'Fine by me.', seen_at: null, token: 'fixture-d' },
];

const SENT_AND_DRAFTS = ROOM_ROWS.filter((r) => r.status !== 'proposed');
const FIXTURE_CLIENT = { id: 'fixture', name: 'A client', company: 'A client in navy and red', report_cadence: 'off' };

const FixtureClient = () => (
  <Page>
    <PageHead kicker="mail for one client" title="A client in navy and red" lede="The three parts that drop into the client page, on fixture rows." />
    <ProposedUpdatesSection clientId="fixture" fixtureRows={ROOM_ROWS} alwaysShow />
    <OpenItemsSection clientId="fixture" fixtureItems={CLIENT_ITEMS} />
    <EmailsSection clientId="fixture" fixtureRows={SENT_AND_DRAFTS} fixtureClient={FIXTURE_CLIENT} />
  </Page>
);

const MailFixture = ({ view = 'editor' }) => (view === 'answer' ? <Answer fixtureItem={ANSWER_ITEM} /> : (
  <PresenceProvider>
    <AppShell>
      <Box px={{ base: 5, md: 7 }} pt={3}>
        <Kicker color={P.coral}>{'development fixture · nothing is saved or sent'}</Kicker>
      </Box>
      {view === 'room' && <MailRoom fixtureRows={ROOM_ROWS} />}
      {view === 'client' && <FixtureClient />}
      {view === 'editor' && <MailEditor fixture={sampleMail()} />}
    </AppShell>
  </PresenceProvider>
));

export default MailFixture;
