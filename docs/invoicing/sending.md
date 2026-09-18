<!-- docs/invoicing/sending.md -->

# sending, resending, receipts and reminders

Every way an invoice leaves Pulse, what the client gets, what the studio
gets and what the history row says. Tyler's rule of 2026-09-17, everything
has a client side notice and an admin side notice, no exceptions.

| action | who presses it | the client gets | the studio gets | history send_type |
|---|---|---|---|---|
| send | the Send button on a draft | the invoice, billing contacts and cc list copied, attachments as real files | Invoice Sent, the lines, the client, the due now | `initial` |
| resend | Send the receipt on an unpaid invoice, the client on the list | the same stored document again, or drawn again from the live rows if the stored one is gone | Invoice Resent, who and how many cc | `resend` |
| forward | Send the receipt on an unpaid invoice, the client not on the list | the same document to the addresses listed | Invoice Forwarded, to whom | `forward` |
| receipt | Send the receipt on a paid invoice, or the automatic send when an invoice settles | the paid document with the stamp, drawn from the live rows so settled lines read paid | Receipt Sent, to whom | `receipt` |
| reminder | the reminder composer | the note in Tyler's words with the amount due and the pay link | Reminder Sent, the note | `reminder` |
| payment | Stripe, through the studio site's webhook | Thank you, the amount, the method, what is left | Payment Received, the same plus the invoice | recorded in payments, not here |

The studio side goes to hello@neonburro.com from notifications@neonburro.com
with the client as reply-to. The client side goes from invoices@ on a send
and from hello@ on everything else.

## where the document comes from

Three sources, tried in this order.

1. The stored html on the last history row that carried a document, the
   initial send, a resend, a forward or a receipt. A reminder row never
   counts, it stores its own note and no document.
2. The live rows. `invoices`, `invoice_items` where billable, `clients`,
   `projects`, `invoice_attachments`. This is the source for every receipt
   because only the live items know which lines are settled.
3. The snapshot on that same history row, the record of what the first send
   said, for the case where the rows are gone.

The history row written by the send says which source it used in its notes.

## the failure on 2026-09-17, and why it cannot come back

Tyler pressed Send the receipt on NB260801 and got "the original snapshot is
missing". The code took the latest history row of any kind and the latest
row was a reminder, which has no snapshot. Any invoice whose last touch was
a reminder, and any invoice first sent before snapshots existed, failed the
same way. The fix reads the history twice, the latest row for who last had
it and the latest document row for what to send, and draws the document
from the live rows before it ever looks at a snapshot.

## the recipients list

The modal opens with everyone who had it, the client and the invoice's cc
list. Remove the client and it is a forward. Add anyone. The server checks
every address again, a browser regex is not the gate on where an invoice
goes. A reminder to a list goes to that list and nobody else.

No Oxford commas, no em dashes.
