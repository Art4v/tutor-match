"use client";
import { SaveTutorButton } from "@/components/SaveTutorButton";
import { useTutorBlock } from "./TutorBlockProvider";

// Thin profile-only wrapper: disables the bookmark while the signed-in student
// has this tutor blocked (a blocked tutor is auto-unsaved at block time, so this
// just prevents re-saving until they unblock).
export function ProfileSaveButton({ tutorId, variant = "banner" }) {
  const { blocked, blockedByThem } = useTutorBlock();
  return <SaveTutorButton tutorId={tutorId} variant={variant} disabled={blocked || blockedByThem} />;
}
