"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Keeps a single equal-score shuffle seed in the URL (`?seed=`) for the life of
 * one page load. The server does the ranking, so the seed has to travel in the
 * URL — but it must be CLIENT-controlled so the order behaves correctly:
 *
 *   - flipping pages / changing filters copies the existing `seed` forward
 *     (pageHref + BrowseFilters both clone the current params), so the order
 *     stays put as you page through results;
 *   - a real browser refresh re-evaluates this module, so SESSION_SEED is
 *     regenerated and the order reshuffles — exactly once per refresh.
 *
 * SESSION_SEED is module-level on purpose: it survives client-side navigation
 * (Next soft nav doesn't re-run modules) but resets on a hard reload.
 *
 * Renders nothing. On first paint the URL has no seed, so the server ranks with
 * the deterministic seed 0; this effect then writes the real seed and the grid
 * settles into its shuffled order.
 */
let SESSION_SEED = null;
function sessionSeed() {
  if (SESSION_SEED == null) SESSION_SEED = 1 + Math.floor(Math.random() * 0x7ffffffe);
  return SESSION_SEED;
}

export function BrowseSeed() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const seed = String(sessionSeed());
    if (sp.get("seed") === seed) return;
    const next = new URLSearchParams(sp.toString());
    next.set("seed", seed);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [router, pathname, sp]);

  return null;
}
