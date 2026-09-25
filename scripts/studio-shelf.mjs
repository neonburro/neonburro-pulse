// scripts/studio-shelf.mjs
// SENTINEL: NB_PULSE_STUDIO_SHELF_V1
//
// The studio's public plates, listed for the Socials picture picker. The
// library at https://neonburro.com/library/index.json lists itself and the
// picker reads that live. The scenes and the share cards have no index on
// the site, so this script walks the studio checkout beside this one and
// writes src/pages/Releases/studioShelf.json, one row per plate with the
// public url, an alt line built from the file name, the folder as subject
// and the pixel size read from the file header.
//
// Run it by hand from the pulse repo when the studio adds plates,
//   node scripts/studio-shelf.mjs
// then commit the json. It reads the neonburro checkout, it never writes
// there. Dimensions come from the bytes, not from a guess, jpg by the SOF
// marker, png by IHDR, webp by VP8, VP8L or VP8X. A file it cannot read is
// listed with no size and the picker says so.
//
// Share cards are jpg on purpose, the studio makes them that way for link
// scrapers, and jpg is also the only format Instagram accepts. Scenes are
// webp, fine for the site, wrong for Instagram. The picker carries that
// verdict, this script only records the facts.
//
// No oxford commas, no em dashes.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const studio = resolve(here, '..', '..', 'neonburro', 'public');
const out = resolve(here, '..', 'src', 'pages', 'Releases', 'studioShelf.json');
const SITE = 'https://neonburro.com';

const SHELVES = [
  { dir: 'scenes', subject: 'scenes', deep: false },
  { dir: 'scenes/communication', subject: 'scenes, the council in touch', deep: false },
  { dir: 'og', subject: 'share cards, hand made', deep: false },
  { dir: 'og/clients', subject: 'share cards, clients', deep: false },
  { dir: 'og/cards', subject: 'share cards, generated', deep: false },
  { dir: 'library/brand', subject: 'brand', deep: false },
];

const IMAGE = /\.(jpe?g|png|webp)$/i;

const jpegSize = (b) => {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
};

const pngSize = (b) => (
  b.length > 24 ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : null
);

const webpSize = (b) => {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  return null;
};

const sizeOf = (path) => {
  const b = readFileSync(path);
  const ext = extname(path).toLowerCase();
  try {
    if (ext === '.jpg' || ext === '.jpeg') return jpegSize(b);
    if (ext === '.png') return pngSize(b);
    if (ext === '.webp') return webpSize(b);
  } catch {
    return null;
  }
  return null;
};

const altFrom = (name) => basename(name, extname(name))
  .replace(/-\d+x\d+$/, '')
  .replace(/-(wide|og)$/, '')
  .replace(/-/g, ' ');

const rows = [];
for (const shelf of SHELVES) {
  const dir = join(studio, shelf.dir);
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    console.error(`missing ${dir}`);
    continue;
  }
  for (const name of names.sort()) {
    const path = join(dir, name);
    if (!statSync(path).isFile() || !IMAGE.test(name)) continue;
    const size = sizeOf(path);
    rows.push({
      file: `/${shelf.dir}/${name}`,
      url: `${SITE}/${shelf.dir}/${name}`,
      alt: altFrom(name),
      subject: shelf.subject,
      dimensions: size ? `${size.width}x${size.height}` : null,
      format: extname(name).slice(1).toLowerCase().replace('jpeg', 'jpg'),
    });
  }
}

writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
console.log(`${rows.length} plates written to ${out}`);
