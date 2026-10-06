// src/pages/Settings/panes/Notifications.jsx
// SENTINEL: NB_PULSE_SETTINGS_NOTIFICATIONS_V1
//
// What Pulse sends and where it lands, read off the functions on
// 2026-10-05. A map and not a set of switches, on purpose.
//
// ── WHY THERE ARE NO TOGGLES ────────────────────────────────────────────────
// Nothing in Pulse keeps a notification preference. There is no column, no
// table and no function that would read one, and the old Settings dropped
// its notification section in Phase 1G for the same reason. A toggle here
// would save nothing and the mail would keep coming, which is the exact
// kind of promise this house does not make. So the pane says what is true,
// row by row, and the lede says nothing here switches off yet. When a
// preference is kept somewhere, the Toggle in src/components/common/
// Controls.jsx is waiting for it.
//
// ── WHERE EACH LINE COMES FROM ──────────────────────────────────────────────
//   a payment lands         stripe-payment-webhook.js, ADMIN_TO hello@
//   an invoice goes out     send-invoice.js, ADMIN_TO, reply to the client
//   a resend or reminder    resend-invoice.js, ADMIN_TO, both actions
//   an appointment is set   send-appointment.js, notifyTeam, TEAM_EMAIL
//   Volt writes an ask      _desk.js, TEAM_EMAIL
//   a report goes out       _client-report.js, STUDIO_EMAIL
//   to clients              the same files, the client's own address, the
//                           invoice recipients, sendClient and postPortal on
//                           an appointment, report_approved on a report,
//                           send-client-invite.js and approve-pin-request.js
// TEAM_EMAIL and STUDIO_EMAIL are NOTIFICATION_EMAIL or hello@neonburro.com.
// ADMIN_TO is hello@neonburro.com written into the file. If any of those
// change, change the line here in the same commit.
//
// A client signed in sees only what reaches them.
//
// No oxford commas, no em dashes.

import { VStack, Text } from '@chakra-ui/react';
import colors from '../../../theme/colors';
import { TYPE, HEAD_GAP } from '../../../theme/layout';
import { PageHead, Section, Rows, Row } from '../../../components/common/Page';
import { isStudio } from '../panes';

const P = colors.paper;

const TO_STUDIO = [
  { label: 'A payment lands', desc: 'Stripe marks an invoice paid and the inbox hears straight away.', when: 'every time' },
  { label: 'An invoice goes out', desc: 'A copy of the send, with the client as the reply to address.', when: 'every time' },
  { label: 'A resend or a reminder', desc: 'The same copy for an invoice sent again and for each reminder.', when: 'every time' },
  { label: 'An appointment is set', desc: 'A short heads up, when the team switch is on for that appointment.', when: 'when on' },
  { label: 'Volt writes an ask', desc: 'One mail for each thing Volt hands to a person.', when: 'every time' },
  { label: 'A monthly report goes out', desc: 'A notice for each client report sent on the 1st.', when: 'every send' },
];

const TO_CLIENTS = [
  { label: 'Invoices, receipts and reminders', desc: 'To the address on the account and anyone added to the invoice.', when: 'per invoice' },
  { label: 'Appointment invites', desc: 'With a calendar file, and a note left in the portal messages.', when: 'per booking' },
  { label: 'The monthly report', desc: 'On the 1st, once the studio approves the account on Reports.', when: 'monthly' },
  { label: 'Portal sign in', desc: 'A username and PIN when the portal opens, and a new PIN when a request is approved.', when: 'on request' },
];

const When = ({ children }) => (
  <Text fontFamily="mono" fontSize={TYPE.label} color={P.inkFaint} textAlign="right" whiteSpace="nowrap">{children}</Text>
);

const List = ({ rows }) => (
  <Rows flush>
    {rows.map((row) => <Row key={row.label} label={row.label} desc={row.desc} control={<When>{row.when}</When>} />)}
  </Rows>
);

const Notifications = ({ profile }) => {
  const studio = isStudio(profile?.role);
  return (
    <VStack align="stretch" spacing={HEAD_GAP}>
      <PageHead
        kicker="Settings"
        title="Notifications"
        lede={studio
          ? 'Every notice Pulse sends and where it lands. They follow the work and none of them switch off from here yet.'
          : 'What reaches you from the studio, and when. None of it switches off from here yet.'}
      />

      {studio && (
        <Section kicker="To the studio inbox">
          <List rows={TO_STUDIO} />
        </Section>
      )}

      <Section kicker={studio ? 'To clients' : 'To you'}>
        <List rows={TO_CLIENTS} />
      </Section>

      {studio && (
        <Text fontSize={TYPE.small} color={P.inkFaint} lineHeight="1.6" maxW="62ch">
          The studio inbox is hello@neonburro.com. Asks, appointments and reports go to NOTIFICATION_EMAIL instead when the Pulse site sets it, the Tools pane shows whether it does.
        </Text>
      )}
    </VStack>
  );
};

export default Notifications;
