<!-- docs/mail/README.md -->

# the mail room

Letters, system updates and open items, composed in Pulse and sent from the
studio. Built 2026-10-05 by Cypher from Tyler's ask the morning the
Greenville September letter went out of a Gmail draft, "send something just
like that. If we want to edit the text in it, we can." The same afternoon it
grew into branded system updates that Tyler approves and open items a client
answers with one tap.

## where things are

| piece | file | route |
|---|---|---|
| the room, drafts, proposed and sent, with the queue waiting on Tyler | `src/pages/Mail/index.jsx` | `/mail/` |
| one letter, fields beside the live preview | `src/pages/Mail/MailEditor.jsx` | `/mail/:mailId/` |
| one client's mail | `src/pages/Mail/MailClient.jsx` | `/mail/clients/:clientId/` |
| the three client parts for Volt's client page | `src/pages/Mail/client/index.js` | imported |
| the public answer page | `src/pages/Answer/index.jsx` | `/answer/:token/` |
| the shape and every shared rule | `src/lib/mailDocument.js` | |
| the one renderer | `src/lib/mailRender.js` | |
| the open items read, same for browser and door | `src/lib/mailItems.js` | |
| the insertion point for proposals | `src/lib/mailPropose.js` | |
| test and send | `netlify/functions/mail-send.js` | POST, staff |
| approve or deny an open item | `netlify/functions/item-answer.js` | public, token |
| the one digest a day | `netlify/functions/mail-digest.js` | 14:00 UTC |
| render a document to a file by hand | `scripts/mail-render.mjs` | |

## the one renderer

`renderMail(doc, { items })` is the only template. The preview, the test,
the send, the digest and the hand render all call it. A real send is refused
unless the last test of the same document carried the same sha256 of subject
and html, so the bytes Tyler tested are the bytes that go. Ages in open items
count to `doc.asOf` and never to the clock, which is what keeps the bytes the
same between a test today and a send tomorrow.

The column is width 100 percent with max-width 600px and a fixed 600 table
for Outlook in a conditional comment. The Gmail draft used width 600 with
max-width 100 percent, and rendered in Chrome at a 600 wide window that
column ran past the right edge by the 14px gutter. Seen in a screenshot of
the render, then fixed and shot again at 600 and 375.

## sending

- **Resend, by name.** `RESEND_API_KEY` on the Pulse site, the variable
  `send-invoice.js` and `resend-invoice.js` read. The invoice path has
  delivered from `invoices@neonburro.com` since June, Resend ids are on the
  `invoice_history` rows, the last on 2026-08-31, so neonburro.com is a
  verified sending domain. Letters go from `Tyler Reagan <tyler@neonburro.com>`
  or `neonburro <hello@neonburro.com>`, picked from `SENDERS`, never typed.
- **Test first.** A test goes to `TEST_TO`, `tyler@neonburro.com`, and
  nowhere else, no cc, subject prefixed `Test •`.
- **Who can send.** The `gate` in `_social.js`, super_admin, admin and
  manager. Team can edit drafts and cannot send.
- **What a send refuses.** No client, a dismissed row, a system drafted row
  that was not approved, any blocking problem from `checkMail`, a changed
  letter since the test and a second send without `again`.
- **Links go out as written.** No tracking, no rewriting. If click tracking
  is ever switched on for neonburro.com in Resend it rewrites every href,
  invoices and answer links included. Leave it off.
- **No email per event.** Tyler, "just don't do a bunch of them, just add
  them to Pulse". Sends write a `mail_sends` row and an `activity_log` row.
  Answers write the item and an `activity_log` row. The queue on `/mail/`
  holds what waits on Tyler, and `mail-digest.js` sends one quiet email a day
  only when something new arrived.

## open items

A row in `client_items` per thing waiting on a client. It stays open until
answered and an `open_items` section prints every open one, oldest first,
with its age, in every letter that carries the block, so an unanswered list
stacks up week after week. Each has an approve and a deny link, or one link
per choice when it carries `choices`. The link opens a page and the page asks
for a press. **A GET never answers**, because mail scanners open every link in
a message and Outlook safe links does exactly that. First answer wins. The
door is rate limited through `door_hits`, which stores a hash and never an
address. Answering never mails the client.

## what is not built, on purpose

The generators. Nothing reads Netlify deploys or a client's own Supabase on
a schedule, that needs credentials and decisions from Tyler.
`proposeDeployDigest` in `src/lib/mailPropose.js` shows the whole shape with
the reader injected and refuses when none is handed in. `isReportDue` is the
cadence rule a scheduled function will use. Nothing sends on its own, and the
door refuses any system drafted row until a person approves it.

## the database

- `20261005113806_mail_composer.sql`, applied 2026-10-05 through the
  connector. `mail_documents`, `mail_sends`, RLS proved after it ran.
- `20261005130000_mail_updates_and_open_items.sql`, **not applied**. Kind,
  origin, approval, the status lifecycle, `clients.report_cadence`,
  `client_items` and `door_hits`. One statement in it is not additive, the
  status check is dropped and added wider, its header says why. Until it
  runs the editor, the room and the client parts say so in words, plain
  letters work, and open items print as nothing waiting.

## the repository is public

`neonburro/neonburro-pulse` is public on GitHub. No real letter, client
address, report code or answer token is committed. The fixtures and the
sample letter carry only the studio's own address and visibly fake codes.
Seeds for a real client go in through the SQL editor.

No oxford commas, no em dashes.
