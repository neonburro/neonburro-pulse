// scripts/check-brand-kit-delivery-gate.mjs
//
// Pure checks for the held delivery endpoint. They prove the request shape,
// exact six-check requirement, artifact boundary and absence of a delivery
// write or mail hand. No database, provider or production order is touched.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  DELIVERY_CHECK_IDS,
  DELIVERY_CHECKLIST_VERSION,
  validateDeliveryReview,
} from '../src/lib/serviceDeliveryContract.js';
import {
  createDeliveryHandler,
  DELIVERY_HOLD,
} from '../netlify/functions/deliver-service-order.js';
import { STAFF } from '../netlify/functions/_social.js';

const functionPath = fileURLToPath(new URL('../netlify/functions/deliver-service-order.js', import.meta.url));
const functionSource = await readFile(functionPath, 'utf8');

const request = {
  orderId: 'f67a239a-3dd8-4ad2-bfb4-9e06f069c115',
  artifactUrl: 'https://neonburro.com/signatures/review-fixture/',
  artifactRevision: '41d63cb7a89',
  artifactSha256: 'a'.repeat(64),
  checklistVersion: DELIVERY_CHECKLIST_VERSION,
  checklist: Object.fromEntries(DELIVERY_CHECK_IDS.map((id) => [id, true])),
};

assert.equal(DELIVERY_CHECK_IDS.length, 6);
assert.deepEqual(STAFF, ['super_admin', 'admin', 'manager']);
assert.equal(validateDeliveryReview(request).ok, true);
assert.equal(validateDeliveryReview(null).ok, false);
assert.equal(validateDeliveryReview([]).ok, false);
assert.equal(validateDeliveryReview('request').ok, false);
assert.equal(validateDeliveryReview(42).ok, false);
assert.equal(validateDeliveryReview({ ...request, orderId: 'not-a-uuid' }).ok, false);
assert.equal(validateDeliveryReview({ ...request, reviewerId: 'browser-owned' }).ok, false);
assert.equal(validateDeliveryReview({ ...request, artifactUrl: 'https://example.com/signatures/a/' }).ok, false);
assert.equal(validateDeliveryReview({ ...request, artifactUrl: 'http://neonburro.com/signatures/a/' }).ok, false);
assert.equal(validateDeliveryReview({ ...request, artifactUrl: 'https://neonburro.com.evil.test/signatures/a/' }).ok, false);
assert.equal(validateDeliveryReview({ ...request, artifactSha256: 'A'.repeat(64) }).ok, false);
assert.equal(validateDeliveryReview({ ...request, checklist: { ...request.checklist, mobile: false } }).ok, false);

const mutationTrap = new Proxy({}, {
  get() {
    throw new Error('The held endpoint touched a database method.');
  },
});
const event = {
  httpMethod: 'POST',
  headers: { authorization: 'Bearer fixture' },
  body: JSON.stringify(request),
};
const answer = (response) => JSON.parse(response.body);

const staffHandler = createDeliveryHandler({
  createDbImpl: () => mutationTrap,
  gateImpl: async () => ({
    user: { id: 'staff-fixture' },
    profile: { role: 'manager' },
  }),
});
const held = await staffHandler(event);
assert.equal(held.statusCode, 409);
assert.deepEqual(answer(held), DELIVERY_HOLD);
assert.equal(held.headers['cache-control'], 'no-store');

const method = await staffHandler({ ...event, httpMethod: 'GET' });
assert.equal(method.statusCode, 405);
assert.equal(method.headers['cache-control'], 'no-store');

const invalidJson = await staffHandler({ ...event, body: '{' });
assert.equal(invalidJson.statusCode, 400);

for (const body of ['null', '[]', '"request"', '42']) {
  const invalidShape = await staffHandler({ ...event, body });
  assert.equal(invalidShape.statusCode, 400);
}

for (const [status, error] of [[401, 'Sign in first.'], [403, 'This door needs a staff role.']]) {
  const rejected = await createDeliveryHandler({
    createDbImpl: () => mutationTrap,
    gateImpl: async () => ({ status, error }),
  })(event);
  assert.equal(rejected.statusCode, status);
  assert.equal(answer(rejected).error, error);
}

assert.match(functionSource, /const gated = await gateImpl\(db, event\)/);
assert.match(functionSource, /code: 'delivery_contract_not_ready'/);
assert.doesNotMatch(functionSource, /\.insert\(/);
assert.doesNotMatch(functionSource, /\.update\(/);
assert.doesNotMatch(functionSource, /Resend/);
assert.doesNotMatch(functionSource, /fetch\(/);

console.log('[brand kit delivery] staff gate and held write fence pass');
