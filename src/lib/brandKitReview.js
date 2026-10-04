// src/lib/brandKitReview.js
//
// THE READ-ONLY BRAND KIT REVIEW CONTRACT
//
// Pulse can rehearse the review before it owns a delivery receipt. This file
// keeps that rehearsal deterministic and keeps client-supplied strings out of
// executable iframe markup. The fixture is deliberately not a finished kit.
// It proves the review surface and nothing about delivery.

export const BRAND_KIT_REVIEW_ITEMS = Object.freeze([
  {
    id: 'mobile',
    label: 'Opened at 390 pixels wide',
    proof: 'The page and every signature block stay inside the phone without sideways scroll.',
  },
  {
    id: 'dark',
    label: 'Pasted into a dark mail client',
    proof: 'The full and reply versions remain readable when the receiving app changes the surface.',
  },
  {
    id: 'links',
    label: 'Checked every live link',
    proof: 'Website, email and telephone targets resolve to the approved client details.',
  },
  {
    id: 'forward',
    label: 'Sent and forwarded one message',
    proof: 'The working block survives a real send and the receiving client\'s forward treatment.',
  },
  {
    id: 'reply',
    label: 'Compared the reply version',
    proof: 'The reply block is genuinely smaller than the full signature and still identifies the sender.',
  },
  {
    id: 'spelling',
    label: 'Read the names out loud',
    proof: 'The person, business, title and visible contact details match the approved brief.',
  },
]);

export const effectiveOrderKind = (row) => row?.inputs?.service || row?.kind || '';

export const isBrandKitOrder = (row) => effectiveOrderKind(row) === 'signatures';

export const reviewCount = (checked = {}) => BRAND_KIT_REVIEW_ITEMS
  .filter((item) => checked[item.id] === true)
  .length;

export const reviewIsComplete = (checked = {}) => reviewCount(checked) === BRAND_KIT_REVIEW_ITEMS.length;

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character]));

export const buildBrandKitReviewFixture = (row = {}) => {
  const person = escapeHtml(row.first_name || 'not supplied');
  const business = escapeHtml(row.business || 'not supplied');
  const title = escapeHtml(row.town || 'not supplied');
  const site = escapeHtml(row.url || 'not supplied');
  const reference = escapeHtml(row.id || 'fixture-only');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Non-production Custom Brand Kit review fixture</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f5f0e8;color:#241a16;font-family:Arial,sans-serif}main{max-width:940px;margin:0 auto;padding:42px 30px 64px}.flag{font:700 10px/1.4 monospace;letter-spacing:.16em;text-transform:uppercase;color:#64564e}.flag b{display:inline-block;margin-right:8px;padding:6px 9px;background:#c5d957;color:#344018;border-radius:8px 8px 8px 0}.rule{height:1px;background:#d9d0c2;margin:24px 0 30px}h1{max-width:700px;margin:0;font-size:clamp(34px,6vw,68px);line-height:.96;letter-spacing:-.055em}.lede{max-width:650px;margin:18px 0 0;color:#67574e;font-size:17px;line-height:1.65}.identity{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(220px,.75fr);gap:18px;margin-top:36px}.sheet{background:#fff;border:1px solid #ded5c8;border-radius:18px 18px 18px 0;padding:24px}.kicker{font:700 9px/1.4 monospace;letter-spacing:.15em;text-transform:uppercase;color:#7b6c63}.name{margin-top:12px;font-size:25px;font-weight:700;letter-spacing:-.035em}.muted{margin-top:6px;color:#75675e;font-size:14px;line-height:1.55}.swatches{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:17px}.swatch{height:50px;border:1px solid #ded5c8;border-radius:9px 9px 9px 0}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.sig{min-height:170px;background:#fff;border:1px solid #ded5c8;border-radius:14px 14px 14px 0;padding:20px}.accent{width:34px;height:4px;background:#c5d957;margin-bottom:24px}.sig strong{display:block;font-size:16px}.sig span{display:block;margin-top:5px;color:#74675f;font-size:12px;line-height:1.5}.receipt{margin-top:18px;padding:18px 0;border-top:1px solid #d9d0c2;font:600 10px/1.7 monospace;letter-spacing:.08em;color:#74675f}.held{margin-top:8px;color:#9a5d23}@media(max-width:680px){main{padding:28px 18px 46px}.identity,.signatures{grid-template-columns:1fr}.sheet{border-left:0;border-right:0;border-radius:0;padding:22px 0;background:transparent}.sig{min-height:0}.swatch{height:42px}}
  </style>
</head>
<body>
  <main>
    <div class="flag"><b>non-production fixture</b> review surface only</div>
    <div class="rule"></div>
    <h1>${business}</h1>
    <p class="lede">A rehearsal of the Pulse review desk using escaped order details. This is not the client artifact and cannot be delivered.</p>
    <section class="identity">
      <div class="sheet">
        <div class="kicker">identity direction</div>
        <div class="name">Clear work. Clear name.</div>
        <div class="muted">One restrained palette, one readable type system and contact details that survive the inbox.</div>
        <div class="swatches">
          <div class="swatch" style="background:#241a16"></div>
          <div class="swatch" style="background:#c5d957"></div>
          <div class="swatch" style="background:#f5f0e8"></div>
        </div>
      </div>
      <div class="sheet">
        <div class="kicker">approved brief fields</div>
        <div class="name">${person}</div>
        <div class="muted">${title}<br>${business}<br>${site}</div>
      </div>
    </section>
    <section class="signatures">
      <div class="sig"><div class="accent"></div><strong>${person}</strong><span>${title}<br>${business}<br>${site}</span></div>
      <div class="sig"><div class="kicker">quiet reply</div><strong style="margin-top:28px">${person}</strong><span>${business} · ${site}</span></div>
      <div class="sig"><div class="kicker">text first</div><strong style="margin-top:28px">${person}</strong><span>${title}<br>${business}</span></div>
    </section>
    <div class="receipt">ORDER ${reference}<div class="held">NO ARTIFACT HASH · NO REVIEW RECEIPT · DELIVERY HELD</div></div>
  </main>
</body>
</html>`;
};
