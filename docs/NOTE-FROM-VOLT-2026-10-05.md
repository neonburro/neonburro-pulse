# Note from Volt, 5 October 2026

To every hand in this repo. This is Volt, and this is what I am working on so
nobody walks into the same files.

## Where

Branch `volt/clients-and-sites`, cut from `origin/main` at `f5d2485`.
Worktree `/private/tmp/neonburro-pulse-volt`. Nothing is pushed and nothing
is deployed. Tyler asked for it to stay local and for the deploy to go
through Warbleur when he says so out loud.

## What, in Tyler's words

"When I click on a client or invoicing, I don't want to have to tap on
details. I want things to be easily read, already opened, and in really
nice, formatted forms."

## Files I am in, please leave these to me until this note is gone

- `src/pages/Clients/ClientDetail.jsx`, the seven tabs become one open page
- `src/pages/Clients/components/ClientModal.jsx`, the four tabs become one
  sectioned form
- `src/pages/Invoicing/components/InvoiceEditor.jsx`, the preview sits beside
  the compose column instead of behind a tab
- `src/pages/Invoicing/components/SprintEditRow.jsx`, the description is
  always open, no Details toggle
- `src/pages/Invoicing/components/InvoiceList.jsx`, rows carry the due date
  and what the invoice is for
- `src/pages/Clients/components/SitesTab.jsx`, the deploy feed shows the latest
  eight, the heading reads Websites
- `src/components/common/PortalAccessCard.jsx`, the PIN row wraps, it was 56px
  wider than a phone
- `src/theme/colors.js`, the paper is lighter and the two faint inks darker,
  Tyler asked for more contrast. This touches every Paper page in Pulse
- `src/theme/layout.js`, kicker, label and micro each one pixel larger
- `src/theme/typography.js` and `src/main.jsx`, a new font once Tyler picks one
  from the specimen, Rubik is what renders today and Tyler wants a change
- `src/lib/invoiceEmailTemplate.js`, one comment line only, the sync note that
  points at the Bill to card. Nothing a client receives changes

## What I am deliberately not touching

- Anything under `src/pages/Mail/`, `src/lib/mail*` or `netlify/functions/mail-send.js`.
  That is the letter and email composer, another agent's work in
  `/private/tmp/neonburro-pulse-letters`.
- What a client receives. `src/lib/emailTokens.js` and every email function
  keep their colours, the lighter paper is the tool only.
- The database. One client holding several companies and several websites is
  being designed on paper first. `client_sites` already holds many sites per
  client. Any migration will be additive, written here, and applied only on
  Tyler's go with RLS read before and after.

## The composer, agreed with Aster the same day

The composer adds EmailsSection, OpenItemsSection and ProposedUpdatesSection
to the client page as standalone components, each one import and one line
right after InvoicesSection in ClientDetail.jsx. Whichever branch merges
second adds those lines. Cadence and any updates panel belong to the
composer, not to this branch.

## Still open from the same ask

- Wording for the MWGridSolutions hosting invoice, drafted in chat for Tyler.
  Volt does not send invoices.
- The several companies per client schema proposal.
