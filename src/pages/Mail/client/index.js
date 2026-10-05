// src/pages/Mail/client/index.js
// The Mail parts that sit on a client's page, in one import, for Volt's one
// page src/pages/Clients/ClientDetail.jsx on volt/clients-and-sites. The
// merge is this one import and one line each, right after InvoicesSection.
//
//   import { EmailsSection, OpenItemsSection, ProposedUpdatesSection } from '../Mail/client';
//
//   <ProposedUpdatesSection clientId={clientId} />
//   <OpenItemsSection clientId={clientId} />
//   <EmailsSection clientId={clientId} />
//
// Each loads its own rows from clientId and needs nothing else from the
// page. ProposedUpdatesSection renders nothing when nothing is proposed.
// Until the merge they are mounted on /mail/clients/:clientId/,
// src/pages/Mail/MailClient.jsx, which is also the link from the Mail room.
//
// No oxford commas, no em dashes.

export { default as EmailsSection } from './EmailsSection';
export { default as OpenItemsSection } from './OpenItemsSection';
export { default as ProposedUpdatesSection } from './ProposedUpdatesSection';
