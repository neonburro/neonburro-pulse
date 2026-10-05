// src/pages/Mail/MailClient.jsx
// One client's mail, the demo mount for the three client parts until Volt's
// one page ClientDetail.jsx imports them. Route /mail/clients/:clientId/.
// The coordinator, 2026-10-05, "if you need a demo mount point, use your own
// page". When the merge lands this page can stay as the Mail room's view of
// a client or go, nothing else depends on it.
//
// Order is the order of urgency. What the system drafted and waits on Tyler,
// then what waits on the client, then everything that already went.
//
// No oxford commas, no em dashes.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HStack, Icon } from '@chakra-ui/react';
import { TbArrowLeft } from 'react-icons/tb';
import colors from '../../theme/colors';
import { EASE, FAST } from '../../theme/layout';
import { Page, PageHead, Kicker } from '../../components/common/Page';
import { loadClient } from './client/mailData';
import { EmailsSection, OpenItemsSection, ProposedUpdatesSection } from './client';

const P = colors.paper;

const MailClient = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);

  useEffect(() => {
    loadClient(clientId).then((res) => setClient(res.client));
  }, [clientId]);

  return (
    <Page>
      <HStack
        as="button"
        type="button"
        spacing={2}
        color={P.inkMuted}
        _hover={{ color: P.ink }}
        transition={`color ${FAST} ${EASE}`}
        onClick={() => navigate('/mail/')}
        alignSelf="flex-start"
      >
        <Icon as={TbArrowLeft} boxSize={3.5} />
        <Kicker color="inherit">All mail</Kicker>
      </HStack>
      <PageHead
        kicker="mail for one client"
        title={client ? (client.company || client.name) : 'A client'}
        lede="What the system drafted for them and waits on you, what waits on them with how long and every letter that already went."
      />
      <ProposedUpdatesSection clientId={clientId} alwaysShow />
      <OpenItemsSection clientId={clientId} />
      <EmailsSection clientId={clientId} />
    </Page>
  );
};

export default MailClient;
