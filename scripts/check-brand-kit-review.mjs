// scripts/check-brand-kit-review.mjs
//
// Pure checks for the Brand Kit review rehearsal. This script never loads an
// order, calls Supabase or sends a delivery. It keeps the six checks, escaped
// fixture and signature-order write fence from drifting independently.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  BRAND_KIT_REVIEW_ITEMS,
  buildBrandKitReviewFixture,
  isBrandKitOrder,
  reviewCount,
  reviewIsComplete,
} from '../src/lib/brandKitReview.js';

const ordersPath = fileURLToPath(new URL('../src/pages/Orders/index.jsx', import.meta.url));
const ordersSource = await readFile(ordersPath, 'utf8');

assert.equal(BRAND_KIT_REVIEW_ITEMS.length, 6);
assert.equal(new Set(BRAND_KIT_REVIEW_ITEMS.map((item) => item.id)).size, 6);
assert.equal(isBrandKitOrder({ kind: 'signatures' }), true);
assert.equal(isBrandKitOrder({ kind: 'sounding', inputs: { service: 'signatures' } }), true);
assert.equal(isBrandKitOrder({ kind: 'sounding' }), false);

const allChecked = Object.fromEntries(BRAND_KIT_REVIEW_ITEMS.map((item) => [item.id, true]));
assert.equal(reviewCount(allChecked), 6);
assert.equal(reviewIsComplete(allChecked), true);
assert.equal(reviewIsComplete({ mobile: true }), false);

const fixture = buildBrandKitReviewFixture({
  id: 'fixture-1',
  first_name: '<script>bad()</script>',
  business: 'A & B',
  town: 'Owner',
  url: 'example.com',
});
assert.equal(fixture.includes('<script>bad()</script>'), false);
assert.equal(fixture.includes('&lt;script&gt;bad()&lt;/script&gt;'), true);
assert.equal(fixture.includes('A &amp; B'), true);
assert.match(fixture, /NO ARTIFACT HASH · NO REVIEW RECEIPT · DELIVERY HELD/);

const emptyFixture = buildBrandKitReviewFixture();
assert.equal((emptyFixture.match(/not supplied/g) || []).length >= 4, true);
assert.equal(emptyFixture.includes('Dana Whitlock'), false);
assert.equal(emptyFixture.includes('Whitlock Roofing'), false);

assert.match(ordersSource, /row\.status === 'paid' && !isBrandKit/);
assert.match(ordersSource, /if \(isBrandKitOrder\(row\)\)/);
assert.match(ordersSource, /No order was changed/);

console.log('[brand kit review] six checks, escaped fixture and write fence pass');
