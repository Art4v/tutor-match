import { Suspense } from "react";
import JoinFlow from "./JoinFlow";

// Quick join (0076, public since 0077): a tutor signs up and lets MatchTutor
// set up and manage their profile. Linked from the TopNav "Quick join" button.
//
// Deliberately a STATIC file: it reads no cookies and no database, and it is
// outside the middleware matcher, so a crawler loading it (any number of
// times, with any query string) costs no function run and no Supabase call.
// It is also noindex and disallowed in robots.txt, by decision.
//
// "error", not "force-static": both keep the page static (the build fails if
// anything dynamic creeps in), but force-static also switches off
// useSearchParams' bail-out to the client (Next 14), so the prerendered HTML
// would be baked from an empty query and every real visit would hit a
// hydration mismatch. With "error" the Suspense boundary below renders in the
// browser, as intended. (JoinFlow no longer reads the query, but keep "error":
// it is the build-time proof the page stays static.)
export const dynamic = "error";

export const metadata = {
  title: "Quick join",
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinFlow />
    </Suspense>
  );
}
