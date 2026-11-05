"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Auth pages render a plain centred form (app/(auth)/layout.js) and stay
// chrome-free, so the global footer is suppressed there.
const HIDDEN_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  // The full-height chat fills the viewport; the footer would sit below the fold.
  "/messages",
]);

// Mounted once in the root layout so the footer appears on every page. A client
// wrapper because it reads the pathname and the session: "Become a tutor" is
// shown to logged-out visitors only (REDESIGN_DECISIONS.md item 3). It starts
// hidden and appears once the session check says nobody is signed in, so a
// signed-in user never sees it flash.
export function SiteFooter() {
  const pathname = usePathname();
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setLoggedOut(!data?.user);
      })
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedOut(!session?.user);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (HIDDEN_PATHS.has(pathname)) return null;
  return <Footer showBecomeTutor={loggedOut} />;
}
