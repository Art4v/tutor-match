import { absUrl } from "@/lib/site";

// ============================================================================
// /robots.txt
// ----------------------------------------------------------------------------
// Public pages are open to search engines AND to AI crawlers, both the
// retrieval bots that fetch a page to answer a user live (ChatGPT-User,
// Claude-User, Perplexity-User, ...) and the training bots (GPTBot, ClaudeBot,
// Google-Extended, CCBot). Allowing training is a deliberate product decision
// and is disclosed in the privacy policy ("Search engines and AI services").
//
// The bots are named explicitly rather than relying on `*` alone because some
// operators only honour a group addressed to their own user agent, and because
// it makes the decision readable here. Every group shares one disallow list:
// private, signed-in and token-gated routes that have nothing to index.
//
// Nothing here or anywhere on the site addresses instructions to AI models.
// See "AI and search discoverability" in CLAUDE.md.
// ============================================================================

const CRAWLERS = [
  // Search engines
  "Googlebot",
  "Bingbot",
  // OpenAI
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  // Anthropic
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Google AI and Apple AI training opt-ins
  "Google-Extended",
  "Applebot-Extended",
  // Common Crawl (feeds many models)
  "CCBot",
];

const DISALLOW = [
  "/api/",
  "/admin/",
  "/auth/",
  "/settings",
  "/account",
  "/account-disabled",
  "/onboarding",
  "/notifications",
  "/messages",
  "/author",
  "/profile",
  "/company",
  "/companies/claim",
  "/choose-role",
  "/reset-password",
];

export default function robots() {
  return {
    rules: [
      { userAgent: CRAWLERS, allow: "/", disallow: DISALLOW },
      { userAgent: "*", allow: "/", disallow: DISALLOW },
    ],
    sitemap: absUrl("/sitemap.xml"),
  };
}
