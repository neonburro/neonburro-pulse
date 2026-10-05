// scripts/mail-render.mjs
// Render one Mail document to an html file and a text file, by hand, through
// the same renderMail the editor and the door call. It exists so the artifact
// can be opened and looked at in a browser at 600 and 375 wide without
// signing in to Pulse and without sending anything.
//
//   node scripts/mail-render.mjs                     the sample, house colours
//   node scripts/mail-render.mjs doc.json out.html   any document you hold
//
// The json file holds either the document itself, the value of the doc
// column on a mail_documents row, or { doc, items } where items are the
// client's open items the way the editor reads them. Keep that file outside
// this repository. The repository is public and a real letter carries
// client addresses, report codes and answer tokens. The text version lands
// beside the html as .txt and the sha256 the door compares is printed, so a
// hand render can be checked against a test send byte for byte.
//
// No oxford commas, no em dashes.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderMail } from '../src/lib/mailRender.js';
import { sampleMail, sampleItems, checkMail } from '../src/lib/mailDocument.js';

const [input, output = 'mail-render.html'] = process.argv.slice(2);
const raw = input ? JSON.parse(readFileSync(input, 'utf8')) : { doc: sampleMail(), items: sampleItems() };
const doc = raw.doc || raw;
const items = raw.items || [];
const rendered = renderMail(doc, { items });

writeFileSync(output, rendered.html);
writeFileSync(`${output.replace(/\.html?$/i, '')}.txt`, rendered.text);

const hash = createHash('sha256').update(rendered.hashInput, 'utf8').digest('hex');
const problems = checkMail(doc);

console.log(`subject  ${rendered.subject}`);
console.log(`html     ${output}  ${Buffer.byteLength(rendered.html, 'utf8')} bytes`);
console.log(`items    ${items.length}`);
console.log(`sha256   ${hash}`);
problems.forEach((p) => console.log(`${p.block ? 'blocks ' : 'advice '}  ${p.text}`));
if (!problems.length) console.log('nothing to fix');
