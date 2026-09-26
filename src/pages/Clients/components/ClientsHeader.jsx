// src/pages/Clients/components/ClientsHeader.jsx
// SENTINEL: NB_PULSE_CLIENTS_HEADER_V4
//
// The house page head. Kicker, title, the lime new client button on the
// right, and the stat strip under, how many active, how many leads waiting,
// how many on a subscription. Leads is a door because a lead sitting for a
// fortnight is the most expensive row in the table. No oxford commas, no
// dashes.

import { Button, Icon } from '@chakra-ui/react';
import { TbPlus } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { PageHead, Stats } from '../../../components/common/Page';

const P = colors.paper;

const ClientsHeader = ({ counts, subscribed = 0, onAdd, onShowLeads }) => (
  <PageHead
    kicker="Clients"
    title="Everybody we build for."
    actions={(
      <Button size="sm" leftIcon={<Icon as={TbPlus} boxSize={4} />} onClick={onAdd}>
        Client
      </Button>
    )}
  >
    <Stats items={[
      { key: 'active', n: counts.active || 0, label: 'active' },
      { key: 'lead', n: counts.lead || 0, label: counts.lead === 1 ? 'lead' : 'leads', tone: counts.lead > 0 ? P.gold : P.ink, onClick: counts.lead > 0 ? onShowLeads : undefined },
      { key: 'subscribed', n: subscribed, label: 'on subscription' },
      { key: 'all', n: counts.all || 0, label: 'on the books', tone: P.inkMuted },
    ]} />
  </PageHead>
);

export default ClientsHeader;
