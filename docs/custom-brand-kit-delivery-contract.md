<!-- docs/custom-brand-kit-delivery-contract.md -->

# Custom Brand Kit delivery contract

Warbleur, 2026-10-04. This is the reviewed boundary between a useful Pulse
preview and a delivery that can be called complete. The first UI slice is
read-only. It does not make this contract live.

## what the current slice proves

Pulse can identify a Custom Brand Kit order, show an escaped non-production
fixture in a sandboxed iframe and walk the six review checks. The Deliver
control stays disabled. The checks live only in the browser session and reset
when the order changes.

That is rehearsal, not a receipt. No migration, mail, payment or order status
change belongs to this slice.

## one order, four separate states

The existing `reads` row remains the order root and payment reference. It must
not carry the whole lifecycle in one `status` value.

| state | allowed values | source of truth |
|---|---|---|
| payment | `ordered`, `paid`, `failed`, `refunded_partial`, `refunded_full`, `disputed` | signed provider webhook |
| fulfillment | `not_started`, `making`, `review`, `ready`, `delivered`, `failed` | staff delivery endpoint and append-only service events |
| care | `not_due`, `scheduled`, `sent`, `working`, `change_requested`, `refund_requested`, `resolved`, `no_response` | the three-day care worker and reviewed replies |
| refund | `none`, `requested`, `submitted`, `succeeded`, `failed`, `cancelled` | staff refund endpoint plus signed provider webhook |

No state update erases the prior event. Current state is a projection of the
append-only record.

## the reviewed shared records

The reviewed migration should connect the existing order to `service_runs` and
`service_events`. It should add two append-only receipt tables rather than add
more meanings to `reads.status`.

### `service_delivery_receipts`

One successful receipt per service run and delivery revision.

| field | rule |
|---|---|
| `id` | UUID primary key |
| `run_id` | required foreign key to `service_runs` |
| `order_id` | required foreign key to `reads` |
| `artifact_url` | required HTTPS URL on an approved Neon Burro host |
| `artifact_revision` | required commit, deploy id or immutable build revision |
| `artifact_sha256` | required lowercase SHA-256 of the reviewed bytes |
| `reviewer_id` | required staff user id taken from the verified session |
| `checklist_version` | required value, first version `brand-kit-v1` |
| `checklist` | required JSON object containing exactly the six named boolean checks |
| `recipient_email` | copied from the order by the server, never accepted from the browser |
| `provider` | required value, first value `resend` |
| `provider_message_id` | required provider receipt returned after send |
| `delivered_at` | provider-accepted delivery time |
| `guarantee_ends_at` | exactly 30 days after `delivered_at` when the public policy is approved |
| `created_at` | immutable server time |

Rows are insert-only. A correction creates a new revision and receipt. It does
not overwrite the artifact that was already delivered.

### `service_refund_receipts`

One row for every refund attempt and one row for every signed provider result.

| field | rule |
|---|---|
| `id` | UUID primary key |
| `run_id` | required foreign key to `service_runs` |
| `order_id` | required foreign key to `reads` |
| `delivery_receipt_id` | the delivery covered by the request |
| `state` | `requested`, `submitted`, `succeeded`, `failed` or `cancelled` |
| `amount_cents` | positive and no greater than verified paid cents |
| `currency` | copied from the verified payment |
| `reason` | bounded staff note, never public by default |
| `requested_by` | verified staff user id or verified client reply identity |
| `provider_refund_id` | required after provider submission |
| `provider_event_id` | required on signed webhook result |
| `idempotency_key` | required and unique per logical request |
| `created_at` | immutable server time |

The payment receipt remains in history. A refund receipt reverses or adjusts
the current projection. Partial and full refunds never share one label.

## the staff-authenticated endpoint

The future function is `netlify/functions/deliver-service-order.js` in Pulse.
It accepts `POST` only and follows the staff gate used by the client report
functions.

Request from the browser:

```json
{
  "orderId": "uuid",
  "artifactUrl": "https://neonburro.com/signatures/client/",
  "artifactRevision": "deploy-or-commit",
  "artifactSha256": "64-lowercase-hex",
  "checklistVersion": "brand-kit-v1",
  "checklist": {
    "mobile": true,
    "dark": true,
    "links": true,
    "forward": true,
    "reply": true,
    "spelling": true
  }
}
```

The server does every consequential check again:

1. Verify the Supabase bearer token with `auth.getUser`.
2. Require `super_admin`, `admin` or `manager`.
3. Read the order with the service role and confirm effective kind
   `signatures`.
4. Require a verified positive external payment and no full refund or dispute.
5. Require the current fulfillment state `review` or `ready`.
6. Fetch the artifact from the approved host and confirm its revision and hash.
7. Require all six booleans and ignore any reviewer id sent by the browser.
8. Read the recipient from the order.
9. Insert a prepared delivery event with one idempotency key.
10. Send the delivery email and capture the provider message id.
11. Insert the immutable delivery receipt and append the delivered event.
12. Return only the receipt id, state and accepted time.

If mail fails, no delivered receipt is written and fulfillment remains
retryable. If the same idempotency key returns, the function reads back the
original result. It never sends twice.

## refund endpoint and test boundary

The future staff function `netlify/functions/refund-service-order.js` creates a
`requested` receipt, validates the refundable amount and submits to Stripe with
an idempotency key. It records `submitted`. Only the signed Neon Burro Stripe
webhook may append `succeeded` or `failed` and change the payment projection.

Test proof runs on an isolated preview with Stripe test credentials, a test
webhook endpoint and a seeded test order. It proves success, duplicate webhook,
mail failure, refund submitted, refund succeeded and refund failed. It does not
use the production `SERVICE_TEST` dollar path because that path makes a real
charge.

## release hold

Do not open the public paid door until the migration is reviewed and applied,
the staff delivery endpoint is deployed, the six failure cases pass and Tyler
approves the live checkout opening. The read-only desk may ship before any of
those actions because it cannot deliver, charge, refund or change an order.
