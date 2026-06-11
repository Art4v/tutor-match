// One-off generator for app/opengraph-image.png (the link-preview card).
// Run with sharp installed (`npm i sharp --no-save`). Produces a static PNG so
// the build never depends on @vercel/og (which breaks on Windows). Re-run only
// if the brand mark/wordmark changes.
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const W = 1200;
const H = 630;
const cwd = process.cwd();

// matchtutor wordmark (Caveat handwriting, match=graphite / tutor=sage) on transparency.
const wordmark = await readFile(join(cwd, "public/images/email/wordmark.png"));
const wm = await sharp(wordmark).metadata();

// Lockup geometry — tile + wordmark, vertically centred as a row.
const TILE = 150;
const GAP = 34;
const WM_H = 138;
const WM_W = Math.round((wm.width / wm.height) * WM_H);
const rowW = TILE + GAP + WM_W;
const rowX = Math.round((W - rowW) / 2);
const rowCenterY = Math.round(H * 0.46);
const tileY = rowCenterY - TILE / 2;
const wmX = rowX + TILE + GAP;
const wmY = Math.round(rowCenterY - WM_H / 2);

// Tree glyph (same path as components/Icon.js "tree" + app/icon.svg), white stroke,
// centred in the sage tile. Path is authored in a 0..24 box; scale to ~64% of tile.
const treeSize = Math.round(TILE * 0.62);
const treeOff = Math.round((TILE - treeSize) / 2);

// Background, frame, tile and tree are pure vector — no fonts involved.
const baseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F5F0E4"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="30" fill="none" stroke="#C7D2BA" stroke-width="2"/>
  <rect x="${rowX}" y="${tileY}" width="${TILE}" height="${TILE}" rx="34" fill="#5E7A55"/>
  <svg x="${rowX + treeOff}" y="${tileY + treeOff}" width="${treeSize}" height="${treeSize}" viewBox="0 0 24 24"
       fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3.2C13.6 3.2 14.8 4.3 14.9 5.7 16.7 5.4 18.3 6.7 18 8.5 19.4 9.3 19.5 11.3 18.1 12.3 18.4 13.9 16.9 15.1 15.3 14.6 14.6 15.6 13 15.8 12 15.1 11 15.8 9.4 15.6 8.7 14.6 7.1 15.1 5.6 13.9 5.9 12.3 4.5 11.3 4.6 9.3 6 8.5 5.7 6.7 7.3 5.4 9.1 5.7 9.2 4.3 10.4 3.2 12 3.2Z"/>
    <path d="M12 21V8"/>
    <path d="M12 12 9.2 9.8"/>
    <path d="m12 10.8 2.6-2"/>
  </svg>
</svg>`;

const scaledWordmark = await sharp(wordmark)
  .resize({ width: WM_W, height: WM_H })
  .png()
  .toBuffer();

const out = await sharp(Buffer.from(baseSvg))
  .composite([{ input: scaledWordmark, left: wmX, top: wmY }])
  .png()
  .toBuffer();

await writeFile(join(cwd, "app/opengraph-image.png"), out);
console.log(`wrote app/opengraph-image.png (${W}x${H}, wordmark ${WM_W}x${WM_H})`);
