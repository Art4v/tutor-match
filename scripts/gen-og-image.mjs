// One-off generator for app/opengraph-image.png (the link-preview card).
// Run with sharp installed (`npm i sharp --no-save`). Produces a static PNG so
// the build never depends on @vercel/og (which breaks on Windows). Re-run only
// if the brand mark/wordmark changes.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const W = 1200;
const H = 630;
const cwd = process.cwd();

// Palette — mirrors app/globals.css.
const ACCENT = "#016764";
const SAGE = "#6FA8A5";
const HEADING = "#014848";
const PAPER = "#FFFFFF";
const LINE = "#CCE2E0";

// Lockup geometry — book+sprout mark + wordmark, vertically centred as a row.
const MARK_H = 156;
const MARK_W = Math.round((130 / 120) * MARK_H); // mark viewBox is 130 x 120
const GAP = 30;
const WM_SIZE = 92; // wordmark cap size
const WM_W = Math.round(WM_SIZE * 5.6); // ~"MatchTutor" at this size
const rowW = MARK_W + GAP + WM_W;
const rowX = Math.round((W - rowW) / 2);
const rowCenterY = Math.round(H * 0.46);
const markY = Math.round(rowCenterY - MARK_H / 2);
const wmX = rowX + MARK_W + GAP;

// NOTE: the wordmark is live SVG text, and this renders through librosvg/sharp,
// which can only use fonts installed on the machine. General Sans is loaded from
// the Fontshare CDN at runtime in the browser and is NOT installed here, so the
// stack below falls back to the system grotesque. That is a deliberate trade:
// the lockup's colour and geometry stay on-brand, the face is approximate. If an
// exact General Sans wordmark is ever needed, install the font locally first.
const WM_FONT = "'General Sans','Helvetica Neue',Helvetica,Arial,sans-serif";

// "Book + sprout" mark (Concept C) — same geometry as components/Logo.jsx +
// app/icon.svg. The gutter seam is the page colour so it reads as a subtle gap.
// Background, frame and mark are pure vector.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="30" fill="none" stroke="${LINE}" stroke-width="2"/>
  <svg x="${rowX}" y="${markY}" width="${MARK_W}" height="${MARK_H}" viewBox="0 0 130 120" fill="none">
    <g transform="translate(5 -6)">
      <path d="M60 84 C 60 70 59 58 60 46" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round"/>
      <g transform="translate(60 56) rotate(36) scale(0.7)"><path d="M0 0 C -15 -8 -16.5 -29 0 -46 C 16.5 -29 15 -8 0 0 Z" fill="${SAGE}"/></g>
      <g transform="translate(60 50) rotate(-36) scale(0.7)"><path d="M0 0 C -15 -8 -16.5 -29 0 -46 C 16.5 -29 15 -8 0 0 Z" fill="${ACCENT}"/></g>
    </g>
    <path d="M65 92 C 50 82 34 80 18 83 L18 104 C 34 101 50 103 65 112 Z" fill="${ACCENT}"/>
    <path d="M65 92 C 80 82 96 80 112 83 L112 104 C 96 101 80 103 65 112 Z" fill="${SAGE}"/>
    <path d="M65 92 L65 112" stroke="${PAPER}" stroke-width="2.4"/>
  </svg>
  <text x="${wmX}" y="${rowCenterY}" dominant-baseline="central"
        font-family="${WM_FONT}" font-size="${WM_SIZE}" font-weight="500" letter-spacing="-1">
    <tspan fill="${HEADING}">Match</tspan><tspan fill="${ACCENT}">Tutor</tspan>
  </text>
</svg>`;

const out = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile(join(cwd, "app/opengraph-image.png"), out);
console.log(`wrote app/opengraph-image.png (${W}x${H})`);
