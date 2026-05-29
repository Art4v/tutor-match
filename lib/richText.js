/**
 * Lightweight markdown helpers for tutor bios.
 *
 * The settings editor's About toolbar writes a tiny markdown subset into the
 * `bio` (tagline) and `bioLong` fields:
 *   **bold**          → strong
 *   *italic*          → em
 *   "- item" lines    → bulleted list   (long bio only)
 *   "1. item" lines   → numbered list   (long bio only)
 *
 * `<RichText>` / `<InlineMarkdown>` (components/RichText.jsx) render this on the
 * public profile. Compact card contexts (browse / similar-tutor / preview) call
 * `stripMarkdown` instead so the raw markers never leak into a one-line label.
 */

/** Strip all markdown markers, returning clean plain text for card contexts. */
export function stripMarkdown(text) {
  if (!text) return "";
  return String(text)
    .replace(/\*\*([^*]+?)\*\*/g, "$1")   // bold
    .replace(/\*([^*]+?)\*/g, "$1")        // italic
    .replace(/^[ \t]*[-*]\s+/gm, "")       // bullet markers
    .replace(/^[ \t]*\d+\.\s+/gm, "")      // numbered markers
    .replace(/[ \t]+/g, " ")               // collapse runs of spaces
    .replace(/\n{3,}/g, "\n\n")            // collapse blank-line runs
    .trim();
}
