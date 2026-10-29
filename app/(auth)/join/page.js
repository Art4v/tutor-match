import { Suspense } from "react";
import JoinFlow from "./JoinFlow";

// The tutor invite page (0076), reached only through the link an admin copies
// from /admin/tutor-invites.
//
// Deliberately a STATIC file: it reads no cookies and no database, and it is
// outside the middleware matcher, so a crawler loading it (any number of
// times, with any query string) costs no function run and no Supabase call.
// The key in ?k= is read in the browser and checked only when the form is
// submitted. It is also noindex and disallowed in robots.txt.
//
// "error", not "force-static": both keep the page static (the build fails if
// anything dynamic creeps in), but force-static also switches off
// useSearchParams' bail-out to the client (Next 14), so the prerendered HTML
// would always hold JoinFlow's empty-key branch ("This invite link is
// incomplete") and every real visit would hit a hydration mismatch. With
// "error" the Suspense boundary below renders in the browser, as intended.
export const dynamic = "error";

export const metadata = {
  title: "Join MatchTutor as a tutor",
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinFlow />
    </Suspense>
  );
}
