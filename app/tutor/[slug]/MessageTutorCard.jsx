"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { useTutorBlock } from "./TutorBlockProvider";

// Sidebar card on a tutor's public profile that lets a STUDENT start a
// conversation. Clicking "Message" just navigates to /messages?to=<slug> — an
// empty draft thread — so no conversation row is created (and the tutor sees
// nothing) until the student actually sends their first message.
//
// When the student has blocked this tutor the card reflects that (soft red tint,
// faded non-interactive Message button). Blocking is done from the conversation;
// the profile's reversal (Unblock) lives on the ProfileBlockBanner above.
//
// Viewer gating (from the shared context, sourced from SavedTutorsProvider):
//   - tutor (logged-in non-student) → hidden entirely (tutors can't initiate)
//   - logged-out visitor           → CTA routes to /signup (matches SaveTutorButton)
//   - student                      → CTA opens the draft thread
// The owner branch on the profile page short-circuits earlier, so this card
// never renders for the profile's owner.
export function MessageTutorCard({ tutorSlug, tutorName }) {
  const router = useRouter();
  const { isStudent, isLoggedIn, ready, blocked, blockedByThem } = useTutorBlock();
  const [navBusy, setNavBusy] = useState(false);

  // A logged-in tutor can't message students — hide the card completely.
  if (ready && isLoggedIn && !isStudent) return null;

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";
  const isBlocked = blocked || blockedByThem; // either direction closes messaging

  const onMessage = () => {
    if (navBusy) return;
    setNavBusy(true);
    if (isStudent) router.push(`/messages?to=${encodeURIComponent(tutorSlug)}`);
    else router.push("/signup"); // logged-out decoy
  };

  return (
    <SectionReveal
      hover
      className={`paper-page ${isBlocked ? "" : "bg-[color:var(--paper-card)]"}`}
      style={{
        border: `1px solid ${isBlocked ? "#FECACA" : "var(--paper-line)"}`,
        borderRadius: "var(--radius-card)",
        padding: 22,
        background: isBlocked ? "#FEF2F2" : undefined,
      }}
    >
      <div className="text-[14px] font-semibold text-slate-900">Message {firstName}</div>
      {blockedByThem ? (
        <div className="text-[12.5px] text-slate-500 mt-1 leading-[1.5]">
          You&apos;ve been blocked by {firstName}. You can&apos;t message them.
        </div>
      ) : blocked ? (
        <div className="text-[12.5px] text-slate-500 mt-1 leading-[1.5]">
          You&apos;ve blocked {firstName}. Unblock to message them again.
        </div>
      ) : (
        <div className="text-[12.5px] text-slate-500 mt-1 leading-[1.5]">
          Ask about availability, rates, or whether they&apos;re the right fit before you start a conversation.
        </div>
      )}

      <div className="mt-4">
        {isBlocked ? (
          // Faded red, non-interactive while blocked (matches Button size="lg").
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-2 font-medium w-full"
            style={{ padding: "11px 20px", fontSize: 15, height: 44, borderRadius: 10, background: "#FCA5A5", color: "#fff", border: "1px solid #FCA5A5", cursor: "not-allowed" }}
          >
            <Icon name="message" size={16} />
            Message {firstName}
          </button>
        ) : (
          <Button variant="primary" size="lg" icon="message" full disabled={!ready || navBusy} onClick={onMessage}>
            {isStudent ? `Message ${firstName}` : "Message"}
          </Button>
        )}
      </div>
    </SectionReveal>
  );
}
