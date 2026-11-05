"use client";
import { Icon } from "@/components/Icon";
import { useTutorBlock } from "./TutorBlockProvider";

// Inline alert above the profile header, shown when a block exists between the
// signed-in student and this tutor (the one status-bordered box on the screen,
// DESIGN.md §1):
//   * student blocked the tutor  → "You've blocked X" + an "Unblock" link.
//   * tutor blocked the student  → "You've been blocked" with NO unblock (it
//                                   isn't the student's block to lift).
// blockedByThem takes precedence (messaging is closed regardless).
export function ProfileBlockBanner({ tutorName }) {
  const { blocked, blockedByThem, busy, requestUnblock } = useTutorBlock();
  if (!blocked && !blockedByThem) return null;

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  return (
    <div className="mb-6 flex items-center gap-3 rounded border border-error px-4 py-3 text-[14px] leading-5 text-[color:var(--text)]">
      <Icon name="ban" size={16} className="shrink-0 text-error" />
      {blockedByThem ? (
        <span>You&apos;ve been blocked by {firstName}. You can&apos;t message each other.</span>
      ) : (
        <>
          <span>You&apos;ve blocked {firstName}. You can&apos;t message each other.</span>
          <button
            type="button"
            onClick={requestUnblock}
            disabled={busy}
            className="ml-auto min-h-6 shrink-0 font-semibold text-error underline underline-offset-2 disabled:opacity-50"
          >
            {busy ? "Unblocking…" : "Unblock"}
          </button>
        </>
      )}
    </div>
  );
}
