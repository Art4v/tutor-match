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

// Lockup geometry — book+sprout mark + wordmark, vertically centred as a row.
const MARK_H = 156;
const MARK_W = Math.round((130 / 120) * MARK_H); // mark viewBox is 130 x 120
const GAP = 30;
const WM_H = 138;
const WM_W = Math.round((wm.width / wm.height) * WM_H);
const rowW = MARK_W + GAP + WM_W;
const rowX = Math.round((W - rowW) / 2);
const rowCenterY = Math.round(H * 0.46);
const markY = Math.round(rowCenterY - MARK_H / 2);
const wmX = rowX + MARK_W + GAP;
const wmY = Math.round(rowCenterY - WM_H / 2);

// "Book + sprout" mark (Concept C), recolored to site tokens — same geometry as
// components/Logo.jsx + app/icon.svg. accent #5E7A5A, sage #8DA17E; the gutter
// seam is paper-cream so it reads as a subtle gap against the background.
// Background, frame and mark are pure vector — no fonts involved.
const baseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F5F0E4"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="30" fill="none" stroke="#C7D2BA" stroke-width="2"/>
  <svg x="${rowX}" y="${markY}" width="${MARK_W}" height="${MARK_H}" viewBox="0 0 130 120" fill="none">
    <g transform="translate(5 -6)">
      <path d="M60 84 C 60 70 59 58 60 46" fill="none" stroke="#5E7A5A" stroke-width="6" stroke-linecap="round"/>
      <g transform="translate(60 56) rotate(36) scale(0.7)"><path d="M0 0 C -15 -8 -16.5 -29 0 -46 C 16.5 -29 15 -8 0 0 Z" fill="#8DA17E"/></g>
      <g transform="translate(60 50) rotate(-36) scale(0.7)"><path d="M0 0 C -15 -8 -16.5 -29 0 -46 C 16.5 -29 15 -8 0 0 Z" fill="#5E7A5A"/></g>
    </g>
    <path d="M65 92 C 50 82 34 80 18 83 L18 104 C 34 101 50 103 65 112 Z" fill="#5E7A5A"/>
    <path d="M65 92 C 80 82 96 80 112 83 L112 104 C 96 101 80 103 65 112 Z" fill="#8DA17E"/>
    <path d="M65 92 L65 112" stroke="#F5F0E4" stroke-width="2.4"/>
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
