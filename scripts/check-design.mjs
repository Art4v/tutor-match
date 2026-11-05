#!/usr/bin/env node
// Design check (DESIGN.md §10). Scans app/ and components/ for values outside
// the approved design system and exits 1 if it finds any.
//
//   npm run check:design            report and fail on findings
//   npm run check:design -- --json  machine-readable output
//
// A line can opt out with a trailing or preceding comment containing
// `design-allow: <reason>` (for example Google's brand colours on the
// "Continue with Google" button). Keep the reason honest; reviewers read them.
//
// It is a line-based scanner, not a parser: it strips comments first, then
// matches. That is enough for this codebase's conventions (Tailwind classes and
// inline style objects) and keeps it dependency-free.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIRS = ["app", "components"];
const EXT = /\.(jsx?|mjs)$/;
// The token file is where raw colours are supposed to live.
const COLOUR_EXEMPT = new Set(["app/globals.css"]);

const SIZES = new Set([12, 14, 16, 20, 24, 32]);

const RULES = [
  {
    id: "font-size",
    test: (line) => {
      const out = [];
      for (const m of line.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) if (!SIZES.has(Number(m[1]))) out.push(m[0]);
      for (const m of line.matchAll(/fontSize:\s*["']?(\d+(?:\.\d+)?)(px)?["']?\s*[,}]/g))
        if (!SIZES.has(Number(m[1]))) out.push(m[0]);
      if (/fontSize:\s*["']clamp\(/.test(line)) out.push("clamp()");
      for (const m of line.matchAll(/\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/g)) out.push(m[0]);
      return out;
    },
    why: "font size outside 12/14/16/20/24/32",
  },
  {
    id: "font-weight",
    test: (line) => {
      const out = [];
      for (const m of line.matchAll(/\bfont-(light|medium|bold|extrabold|thin|extralight|black)\b/g)) out.push(m[0]);
      for (const m of line.matchAll(/fontWeight:\s*["']?(\d{3})["']?/g)) if (!["400", "600"].includes(m[1])) out.push(m[0]);
      return out;
    },
    why: "weight other than 400 / 600",
  },
  {
    id: "colour",
    skip: (file) => COLOUR_EXEMPT.has(file),
    test: (line) => [
      ...line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g),
      ...line.matchAll(/\brgba?\([^)]*\)/g),
      ...line.matchAll(/\boklch\([^)]*\)/g),
    ]
      // `rgba(` inside a var() fallback is still a raw colour; HTML entities
      // such as &#8217; are not colours.
      .filter((m) => !/&#\d/.test(line.slice(Math.max(0, m.index - 2), m.index + 3)))
      .map((m) => m[0]),
    why: "raw colour (use a token from app/globals.css)",
  },
  {
    id: "radius",
    test: (line) => {
      const out = [];
      for (const m of line.matchAll(/\brounded(-(?:sm|md|lg|xl|2xl|3xl|\[[^\]]+\]))\b/g)) out.push(m[0]);
      for (const m of line.matchAll(/borderRadius:\s*([^,}]+)/g)) {
        const OK = ["4", "4px", "0", "var(--radius)", "var(--radius-card)", "50%", "radius", "r"];
        const v = m[1].trim().replace(/^["'`]|["'`]$/g, "");
        // A ternary passes when every literal it can produce is allowed.
        const literals = v.includes("?") ? [...v.matchAll(/["'`]([^"'`]+)["'`]|\b(\d+)\b/g)].map((x) => x[1] || x[2]) : null;
        if (literals ? !literals.every((x) => OK.includes(x)) : !OK.includes(v)) out.push(m[0]);
      }
      return out;
    },
    why: "radius other than 4px (rounded) or a person's circle",
  },
  {
    id: "shadow",
    test: (line) => {
      const out = [];
      for (const m of line.matchAll(/\bshadow(-(?:sm|md|lg|xl|2xl|inner|\[[^\]]+\]))?\b(?!-float)/g)) {
        if (/shadow-float/.test(line.slice(m.index, m.index + 13))) continue;
        if (/\bshadow\b/.test(m[0]) && /boxShadow|shadow-float|--shadow/.test(line)) continue;
        if (/^shadow(-|$)/.test(m[0]) && /\b(?:class(Name)?=|["'`\s])shadow(-[a-z]+|\b)/.test(line)) out.push(m[0]);
      }
      for (const m of line.matchAll(/boxShadow:\s*([^,}]+)/g)) {
        const v = m[1].trim().replace(/^["'`]|["'`]$/g, "");
        if (!/^(none|var\(--shadow-float\)|ring\b|.*\$\{)/.test(v)) out.push(m[0]);
      }
      return out;
    },
    why: "shadow on a static element (only var(--shadow-float) / shadow-float on floating elements)",
  },
  {
    id: "effects",
    test: (line) =>
      // `blur(` only as a CSS filter, not the DOM method `el.blur()`.
      [...line.matchAll(/\b(linear-gradient|radial-gradient|backdrop-filter|backdropFilter|backdrop-blur)|(?<!\.)\bblur\(/g)].map((m) => m[0]),
    why: "gradient or blur",
  },
  {
    id: "motion",
    test: (line) =>
      [
        ...line.matchAll(/from ["']motion\/react["']|from ["']framer-motion["']/g),
        ...line.matchAll(/\banimate-(pulse|bounce|ping)\b/g),
        ...line.matchAll(/\b(?:group-)?hover:(?:-?translate|scale)-/g),
      ].map((m) => m[0]),
    why: "decorative motion",
  },
  {
    id: "breakpoint",
    test: (line) => [...line.matchAll(/(?<![\w-])(md|xl|2xl):[\w[]/g)].map((m) => m[0]),
    why: "breakpoint other than sm: (640) / lg: (1024)",
  },
  {
    id: "caveat",
    test: (line) => [...line.matchAll(/\bfont-hand\b|Caveat|General Sans/g)].map((m) => m[0]),
    why: "retired typeface",
  },
  {
    id: "em-dash",
    test: (line) => (line.includes("—") ? ["—"] : []),
    why: "em dash in user-facing copy",
  },
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (EXT.test(name)) files.push(p);
  }
  return files;
}

// Remove comments but keep line numbers: // to end of line, /* … */ and {/* … */}
// blocks (possibly spanning lines). Strings are not tracked, which is fine for
// the patterns above.
function stripComments(src) {
  let out = "";
  let i = 0;
  let inBlock = false;
  while (i < src.length) {
    if (inBlock) {
      if (src.startsWith("*/", i)) {
        inBlock = false;
        i += 2;
      } else {
        out += src[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }
    if (src.startsWith("/*", i)) {
      inBlock = true;
      i += 2;
      continue;
    }
    // `//` that is not part of a URL (`https://`).
    if (src.startsWith("//", i) && src[i - 1] !== ":") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const findings = [];
for (const dir of DIRS) {
  for (const abs of walk(join(ROOT, dir))) {
    const file = relative(ROOT, abs);
    const raw = readFileSync(abs, "utf8");
    const rawLines = raw.split("\n");
    const lines = stripComments(raw).split("\n");
    lines.forEach((line, idx) => {
      const allow = /design-allow:/.test(rawLines[idx] || "") || /design-allow:/.test(rawLines[idx - 1] || "");
      if (allow) return;
      for (const rule of RULES) {
        if (rule.skip?.(file)) continue;
        for (const hit of rule.test(line)) findings.push({ file, line: idx + 1, rule: rule.id, hit, why: rule.why });
      }
    });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(findings, null, 2));
} else if (findings.length === 0) {
  console.log("check:design: no findings.");
} else {
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}] ${f.hit}  (${f.why})`);
  console.log(`\ncheck:design: ${findings.length} finding(s): ${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}
process.exit(findings.length ? 1 : 0);
