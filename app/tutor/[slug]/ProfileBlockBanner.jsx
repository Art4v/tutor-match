"use client";
import { Icon } from "@/components/Icon";
import { useTutorBlock } from "./TutorBlockProvider";

// Red-tinted banner above the profile header card, shown when a block exists
// between the signed-in student and this tutor:
//   * student blocked the tutor  → "You've blocked X" + an "Unblock" hyperlink.
//   * tutor blocked the student  → "You've been blocked" with NO unblock (it
//                                   isn't the student's block to lift).
// blockedByThem takes precedence (messaging is closed regardless).
export function ProfileBlockBanner({ tutorName }) {
  const { blocked, blockedByThem, busy, requestUnblock } = useTutorBlock();
  if (!blocked && !blockedByThem) return null;

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  return (
    <div
      className="flex items-center gap-2.5 mb-4 px-4 py-2.5"
      style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "var(--radius-card)" }}
    >
      <span className="inline-flex items-center justify-center shrink-0" style={{ color: "#DC2626" }}>
        <Icon name="ban" size={16} />
      </span>
      {blockedByThem ? (
        <span className="text-[13px] text-slate-700">
          You&apos;ve been blocked by {firstName}. You can&apos;t message each other.
        </span>
      ) : (
        <>
          <span className="text-[13px] text-slate-700">
            You&apos;ve blocked {firstName}. You can&apos;t message each other.
          </span>
          <button
            type="button"
            onClick={requestUnblock}
            disabled={busy}
            className="ml-auto shrink-0 text-[13px] font-medium underline underline-offset-2 disabled:opacity-50"
            style={{ color: "#DC2626" }}
          >
            {busy ? "Unblocking…" : "Unblock"}
          </button>
        </>
      )}
    </div>
  );
}
