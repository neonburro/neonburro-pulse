// src/lib/serviceDeliveryContract.js
//
// THE BROWSER MAY DESCRIBE A REVIEW, NEVER AUTHORIZE DELIVERY
//
// This is the shared shape for the held Custom Brand Kit delivery request.
// It accepts only the reviewed artifact identity and the six true checks. The
// server still owns the reviewer, recipient, payment proof and delivery state.
// Keeping this pure lets the contract run without Supabase, Resend or a live
// order while the receipt migration remains unapplied.

export const DELIVERY_CHECKLIST_VERSION = 'brand-kit-v1';

export const DELIVERY_CHECK_IDS = Object.freeze([
  'mobile',
  'dark',
  'links',
  'forward',
  'reply',
  'spelling',
]);

const REQUEST_FIELDS = Object.freeze([
  'orderId',
  'artifactUrl',
  'artifactRevision',
  'artifactSha256',
  'checklistVersion',
  'checklist',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVISION = /^[A-Za-z0-9][A-Za-z0-9._:/-]{6,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;

const artifactUrlIsApproved = (value) => {
  try {
    const url = new URL(value);
    return url.origin === 'https://neonburro.com'
      && url.pathname.startsWith('/signatures/');
  } catch {
    return false;
  }
};

const checklistIsExact = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...DELIVERY_CHECK_IDS].sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index])
    && expected.every((key) => value[key] === true);
};

export const validateDeliveryReview = (input = {}) => {
  const errors = [];
  const candidate = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {};
  const keys = Object.keys(candidate).sort();
  const expectedFields = [...REQUEST_FIELDS].sort();

  if (keys.length !== expectedFields.length || !keys.every((key, index) => key === expectedFields[index])) {
    errors.push('Send only the reviewed delivery fields.');
  }
  if (!UUID.test(String(candidate.orderId || ''))) errors.push('Send a valid order id.');
  if (!artifactUrlIsApproved(String(candidate.artifactUrl || ''))) {
    errors.push('The artifact must be an HTTPS neonburro.com signature page.');
  }
  if (!REVISION.test(String(candidate.artifactRevision || ''))) errors.push('Send an artifact revision identifier.');
  if (!SHA256.test(String(candidate.artifactSha256 || ''))) errors.push('Send a lowercase SHA-256.');
  if (candidate.checklistVersion !== DELIVERY_CHECKLIST_VERSION) errors.push('The checklist version is not current.');
  if (!checklistIsExact(candidate.checklist)) errors.push('Every Brand Kit review check must be true.');

  return {
    ok: errors.length === 0,
    errors,
  };
};
