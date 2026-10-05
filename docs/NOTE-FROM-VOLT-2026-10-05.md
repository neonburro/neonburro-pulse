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

## What I am deliberately not touching

- Anything under `src/pages/Mail/`, `src/lib/mail*` or `netlify/functions/mail-send.js`.
  That is the letter and email composer, another agent's work in
  `/private/tmp/neonburro-pulse-letters`.
- The invoice email template `src/lib/invoiceEmailTemplate.js`. What a client
  receives does not change in this pass.
- The database. One client holding several companies and several websites is
  being designed on paper first. `client_sites` already holds many sites per
  client. Any migration will be additive, written here, and applied only on
  Tyler's go with RLS read before and after.

## Still open from the same ask

- Wording for the MWGridSolutions hosting invoice, drafted in chat for Tyler.
  Volt does not send invoices.
- The several companies per client schema proposal.
