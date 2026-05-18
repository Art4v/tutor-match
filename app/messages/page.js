// ============================================================================
// Messaging is disabled for v1.
// ----------------------------------------------------------------------------
// The original two-pane messages UI is preserved in this file's git history
// (before lib/data.js was deleted in slice 4). When we revive this feature,
// either restore from git or rebuild against a real `conversations` table.
//
// For now the route stays alive only so old saved links don't 404 — but
// nothing in the UI links here.
// ============================================================================

import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function MessagesDisabledPage() {
  return (
    <div className="bg-white">
      <div className="max-w-[720px] mx-auto px-6 py-24 text-center">
        <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">
          Messaging is coming soon
        </h1>
        <p className="text-[15px] text-slate-600 mt-3 leading-[1.55]">
          We&apos;re focusing on the directory first. Until in-app messaging ships, browse tutors and reach out via the contact details on their profile.
        </p>
        <Link
          href="/browse"
          className="inline-flex items-center gap-1 mt-6 text-[14px] font-medium text-slate-900 hover:underline"
        >
          Browse tutors →
        </Link>
      </div>
      <Footer />
    </div>
  );
}
