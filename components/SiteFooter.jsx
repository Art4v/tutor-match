"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";

// Auth pages render inside a centered card (app/(auth)/layout.js) and stay
// intentionally chrome-free, so the global footer is suppressed there.
const HIDDEN_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  // The full-height chat fills the viewport; the footer would sit below the fold.
  "/messages",
]);

// Mounted once in the root layout so the footer appears on every page. Kept as
// a thin client wrapper purely so it can read the pathname; the actual markup
// lives in <Footer />.
export function SiteFooter() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname)) return null;
  return <Footer />;
}
