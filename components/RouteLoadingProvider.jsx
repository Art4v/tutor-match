"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

/**
 * Full-viewport loading overlay (blurred backdrop + spinner) for route
 * transitions. Next 14 has no router events, so the only reliable
 * "navigation finished" signal is useTransition's isPending around
 * router.push/replace — every navigation that should show the overlay must
 * flow through `navigate()`:
 *
 *   - plain <a>/<Link> clicks are intercepted by a document-level capture
 *     listener below (opt out per-link with `data-no-loading`), so existing
 *     Links need no changes and prefetching is untouched;
 *   - programmatic call sites (browse filters, hero search) call
 *     `useRouteLoading().navigate(href, { replace, scroll })` directly.
 *
 * Anti-flicker: the overlay only appears if the transition is still pending
 * after SHOW_DELAY_MS, and once shown stays at least MIN_VISIBLE_MS so fast
 * navigations show nothing and slow ones never blink.
 */

const SHOW_DELAY_MS = 250;
const MIN_VISIBLE_MS = 400;

const RouteLoadingContext = createContext(null);

export function useRouteLoading() {
  const ctx = useContext(RouteLoadingContext);
  const router = useRouter();
  // Safe fallback outside the provider: navigate without the overlay.
  if (ctx) return ctx;
  return {
    navigate: (href, { replace = false, scroll = true } = {}) => {
      if (replace) router.replace(href, { scroll });
      else router.push(href, { scroll });
    },
  };
}

export function RouteLoadingProvider({ children }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visible, setVisible] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const shownAt = useRef(0);

  const navigate = useCallback(
    (href, { replace = false, scroll = true } = {}) => {
      startTransition(() => {
        if (replace) router.replace(href, { scroll });
        else router.push(href, { scroll });
      });
    },
    [router]
  );

  // Delay-then-minimum-duration state machine on the transition flag.
  useEffect(() => {
    if (isPending) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
      if (!visible && !showTimer.current) {
        showTimer.current = setTimeout(() => {
          showTimer.current = null;
          shownAt.current = Date.now();
          setVisible(true);
        }, SHOW_DELAY_MS);
      }
    } else {
      clearTimeout(showTimer.current);
      showTimer.current = null;
      if (visible && !hideTimer.current) {
        const elapsed = Date.now() - shownAt.current;
        hideTimer.current = setTimeout(() => {
          hideTimer.current = null;
          setVisible(false);
        }, Math.max(0, MIN_VISIBLE_MS - elapsed));
      }
    }
  }, [isPending, visible]);

  useEffect(
    () => () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    },
    []
  );

  // No scrolling while the overlay is up (shared lock toggles overflow:hidden).
  // Programmatic scrolls (Next's scroll-to-top on navigation) still work.
  useEffect(() => {
    if (!visible) return;
    lockScroll();
    return () => unlockScroll();
  }, [visible]);

  // Capture-phase listener so internal left-clicks on links route through the
  // transition (and therefore the overlay). Runs before next/link's own
  // onClick; Link checks e.defaultPrevented and stands down.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (a.hasAttribute("download") || a.hasAttribute("data-no-loading")) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // External origins, mailto:, tel: etc. stay with the browser.
      if (url.origin !== window.location.origin) return;
      // Pure in-page hash jump: let the browser handle it.
      if (
        url.hash &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate]);

  return (
    <RouteLoadingContext.Provider value={{ navigate }}>
      {children}
      {/* Above TopNav (z-40); below the blocking VerificationPrompt (z-[90])
          and PolicyConsentGate (z-[100]) modals. Kept mounted so opacity can
          transition; pointer-events off while hidden. */}
      <div
        aria-hidden={!visible}
        className="fixed inset-0 z-[80] flex items-center justify-center"
        style={{
          background: "rgba(255, 255, 255, 0.45)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      >
        <div role="status" aria-live="polite">
          <div
            className={visible ? "route-loading-spinner" : ""}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "3px solid var(--ink-graphite-line)",
              borderTopColor: "var(--ink-graphite)",
            }}
          />
          {visible && <span className="sr-only">Loading</span>}
        </div>
      </div>
    </RouteLoadingContext.Provider>
  );
}
