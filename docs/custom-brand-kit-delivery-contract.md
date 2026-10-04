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

## the named endpoint is held too

`netlify/functions/deliver-service-order.js` now owns the staff gate and the
pure request validation for the future delivery call. It accepts only an order
id, a candidate Neon Burro artifact URL, a claimed revision, a lowercase
SHA-256 and the exact six true checks. This syntax check is not artifact proof.

It still returns `409 delivery_contract_not_ready` for every valid request,
with `schema_not_applied`, `verified_payment_receipt_missing` and
`immutable_artifact_not_verified` as the exact hold reasons. Every response is
`no-store`. It contains no database write, artifact fetch or mail call. The
browser cannot send a reviewer id or recipient. This keeps the named server
door as honest as the disabled button while the shared schema and signed
payment bridge remain under review.

The shared migration belongs in the main Neon Burro repository beside
`service_runs` and `service_events`. Pulse must not create a second copy of
those tables. That migration must be prepared and reviewed separately. It is
not part of this release.

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
`service_events`. It should not add more meanings to `reads.status`.

`service_runs` receives one unique `read_id` foreign key to `reads`, the four
state projections above and a unique `(id, read_id)` pair for receipt foreign
keys. Its existing operating `status` remains separate. The migration seeds
`custom-brand-kit` as `testing` with `holder_ready = false`.

Before delivery can leave held, the signed studio Stripe webhook must create or
link the run and append one confirmed `customer_payment` event with the provider
event id, provider payment id, amount, currency and live mode. A paid label in
`reads` is not that receipt.

### `service_delivery_requests`

One immutable preparation and outbox row per logical send.

| field | rule |
|---|---|
| `id` | UUID primary key |
| `run_id`, `order_id` | required composite reference to one linked run and order |
| `idempotency_key` | required and unique per logical send |
| `artifact_url` | mutable canonical Neon Burro URL copied from the reviewed request |
| `artifact_snapshot_url` | required immutable deploy or signed manifest URL verified by the server |
| `artifact_revision` | required reviewed revision label |
| `artifact_sha256` | required lowercase SHA-256 of the verified snapshot bytes |
| `reviewer_id` | verified staff user id, never accepted from the browser |
| `checklist_version`, `checklist` | `brand-kit-v1` and exactly the six named booleans, all true |
| `recipient_email` | copied from the order by the server |
| `provider`, `created_at` | server-owned provider and immutable server time |

The prepared request survives a provider timeout. An unresolved send stops for
manual reconciliation rather than making a second send after provider
idempotency expires.

### `service_delivery_receipts`

One immutable provider acceptance per prepared request.

| field | rule |
|---|---|
| `id` | UUID primary key |
| `request_id` | required and unique reference to the prepared request |
| `run_id`, `order_id` | required and must match the request pair |
| `provider` | required value, first value `resend` |
| `provider_message_id` | required and unique with provider |
| `delivered_at` | provider-accepted delivery time |
| `guarantee_policy_version`, `guarantee_ends_at` | both null until approved, then both required and the end is exactly 30 days after delivery |
| `created_at` | immutable server time |

Rows are insert-only. A correction creates a new revision and receipt. It does
not overwrite the artifact that was already delivered.

### `service_refund_requests`

One immutable row per logical refund request. It carries the matching run,
order and delivery receipt, a unique idempotency key, positive amount, verified
currency, bounded reason, verified requester and server time. A trusted
transaction must lock the payment projection and refuse more than the verified
paid or remaining refundable amount.

### `service_refund_receipts`

One immutable row for every signed provider result.

| field | rule |
|---|---|
| `id` | UUID primary key |
| `request_id` | required reference to the logical refund request |
| `provider`, `provider_refund_id` | required provider identity |
| `provider_event_id` | required and unique signed webhook event id |
| `provider_status` | required raw provider status |
| `state` | `submitted`, `succeeded`, `failed` or `cancelled` |
| `created_at` | immutable server time |

The payment receipt remains in history. A refund receipt reverses or adjusts
the current projection. Partial and full refunds never share one label.

All four tables have RLS enabled, no `public`, `anon` or `authenticated`
privileges and only the narrow `service_role` grants they need. Update and
delete guards keep every row immutable. The delivery finalizer is one trusted
transaction that adds the receipt, appends the delivered service event and
updates the fulfillment projection together. Any finalizer revokes execution
from `PUBLIC` and grants it only to `service_role`.

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
6. Resolve an immutable deploy or signed manifest, fetch it from the approved
   host and compute the reviewed bytes hash on the server.
7. Require all six booleans and ignore any reviewer id sent by the browser.
8. Read the recipient from the order.
9. Insert or read back the prepared delivery request with one idempotency key.
10. Send the delivery email and capture the provider message id.
11. Insert the immutable delivery receipt and append the delivered event.
12. Return only the receipt id, state and accepted time.

If mail fails, no delivered receipt is written. The prepared request remains
for retry or manual reconciliation. If the same idempotency key returns during
the supported provider window, the function reads back the original result.
An uncertain request outside that window stops for manual review.

## refund endpoint and test boundary

The future staff function `netlify/functions/refund-service-order.js` creates a
refund request, validates the refundable amount and submits to Stripe with an
idempotency key. Only the signed Neon Burro Stripe webhook may append refund
receipts and change the payment projection.

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
