"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { useSavedTutors } from "@/components/SavedTutorsProvider";

// Sidebar card on a tutor's public profile that lets a STUDENT start a
// conversation. Clicking "Message" just navigates to /messages?to=<slug> — an
// empty draft thread — so no conversation row is created (and the tutor sees
// nothing) until the student actually sends their first message.
//
// Viewer gating reuses the app-wide SavedTutorsProvider context (the co-located
// SaveTutorButton uses the same), so no extra role fetch is needed:
//   - tutor (logged-in non-student) → hidden entirely (tutors can't initiate)
//   - logged-out visitor           → CTA routes to /signup (matches SaveTutorButton)
//   - student                      → CTA opens the draft thread
// The owner branch on the profile page short-circuits earlier, so this card
// never renders for the profile's owner.
export function MessageTutorCard({ tutorSlug, tutorName }) {
  const router = useRouter();
  const { isStudent, isLoggedIn, ready } = useSavedTutors();
  const [busy, setBusy] = useState(false);

  // A logged-in tutor can't message students — hide the card completely.
  if (ready && isLoggedIn && !isStudent) return null;

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  const onClick = () => {
    if (busy) return;
    setBusy(true);
    if (isStudent) router.push(`/messages?to=${encodeURIComponent(tutorSlug)}`);
    else router.push("/signup"); // logged-out decoy
  };

  return (
    <SectionReveal
      hover
      className="paper-page bg-[color:var(--paper-card)]"
      style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22 }}
    >
      <div className="text-[14px] font-semibold text-slate-900">Message {firstName}</div>
      <div className="text-[12.5px] text-slate-500 mt-1 leading-[1.5]">
        Ask about availability, rates, or whether they&apos;re the right fit before you start a conversation.
      </div>
      <div className="mt-4">
        <Button variant="primary" size="lg" icon="message" full disabled={!ready || busy} onClick={onClick}>
          {isStudent ? `Message ${firstName}` : "Message"}
        </Button>
      </div>
    </SectionReveal>
  );
}
