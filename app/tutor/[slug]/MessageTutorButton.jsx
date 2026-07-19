"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useTutorBlock } from "./TutorBlockProvider";

// The "Message <tutor>" CTA, shared by the rate card (sidebar) and the mobile
// bottom bar. Extracted from the old MessageTutorCard so both call sites use one
// source of gating logic.
//
// Viewer gating (from TutorBlockProvider, sourced from SavedTutorsProvider):
//   - tutor (logged-in non-student) → disabled button + "Only available to students" note
//   - logged-out visitor           → CTA routes to /signup (decoy, matches SaveTutorButton)
//   - student                      → CTA opens the draft thread /messages?to=<slug>
// The owner branch on the profile page short-circuits earlier, so this never
// renders for the profile's owner. Block awareness (red state) intentionally
// lives elsewhere now — the block is still enforced server-side in /messages.
export function MessageTutorButton({ tutor, full = true }) {
  const router = useRouter();
  const { isStudent, isLoggedIn, ready } = useTutorBlock();
  const [navBusy, setNavBusy] = useState(false);

  const firstName = (tutor.name ?? "").trim().split(/\s+/)[0] || "this tutor";
  // A logged-in tutor can't message — show the button disabled, with a note.
  const isTutorViewer = ready && isLoggedIn && !isStudent;

  const onMessage = () => {
    if (navBusy) return;
    setNavBusy(true);
    if (isStudent) router.push(`/messages?to=${encodeURIComponent(tutor.slug)}`);
    else router.push("/signup"); // logged-out decoy
  };

  const button = (
    <Button
      variant="primary"
      size={full ? "xl" : "lg"}
      icon="message"
      full={full}
      disabled={!ready || navBusy || isTutorViewer}
      onClick={isTutorViewer ? undefined : onMessage}
    >
      {isStudent ? `Message ${firstName}` : "Message"}
    </Button>
  );

  // Caption only in the full (sidebar) layout — the mobile bar is a tight row.
  if (isTutorViewer && full) {
    return (
      <div className="space-y-1.5">
        {button}
        <div className="text-center text-[12px] text-slate-400">Only available to students</div>
      </div>
    );
  }

  return button;
}
