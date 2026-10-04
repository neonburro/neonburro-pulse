// netlify/functions/deliver-service-order.js
// SENTINEL: NB_PULSE_SERVICE_DELIVERY_HELD_V1
//
// THE NAMED DOOR EXISTS, DELIVERY DOES NOT
//
// This function proves the staff gate and request contract without creating a
// second path around the disabled Pulse button. Every valid request still ends
// held. There is no database write, artifact fetch or mail call in this slice.
//
// Delivery can replace the final held response only after the shared Neon Burro
// migration links a reads order to one service run, the studio webhook appends
// its signed customer payment event and the immutable delivery receipt path is
// reviewed and applied. A paid label in reads is not payment proof.

import { createDb, gate, json } from './_social.js';
import { validateDeliveryReview } from '../../src/lib/serviceDeliveryContract.js';

export const DELIVERY_HOLD = Object.freeze({
  ok: false,
  state: 'held',
  code: 'delivery_contract_not_ready',
  reasons: Object.freeze([
    'schema_not_applied',
    'verified_payment_receipt_missing',
    'immutable_artifact_not_verified',
  ]),
});

const noStore = (response) => ({
  ...response,
  headers: {
    ...response.headers,
    'cache-control': 'no-store',
  },
});

const reply = (statusCode, body) => noStore(json(statusCode, body));

export const createDeliveryHandler = ({
  createDbImpl = createDb,
  gateImpl = gate,
} = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const db = createDbImpl();
  const gated = await gateImpl(db, event);
  if (gated.error) return reply(gated.status, { error: gated.error });

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Send json.' });
  }

  const review = validateDeliveryReview(input);
  if (!review.ok) return reply(400, { error: review.errors[0], errors: review.errors });

  return reply(409, DELIVERY_HOLD);
};

export const handler = createDeliveryHandler();
