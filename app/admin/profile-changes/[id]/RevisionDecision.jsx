"use client";

import { DecisionPanel } from "../../_components/DecisionPanel";

// Approve and reject are separate routes (approve also copies staged files
// into the public buckets), so each action names its own path.
export function RevisionDecision({ revisionId, tutorName }) {
  return (
    <DecisionPanel
      endpoint="/api/admin/profile-revisions"
      body={{ revisionId }}
      reasonHint="Sent to the tutor if you reject."
      actions={[
        { key: "approve", label: "Approve", busyLabel: "Approving…", tone: "primary", icon: "check", path: "approve", doneText: `${tutorName}'s changes are live.` },
        { key: "reject", label: "Reject", busyLabel: "Rejecting…", tone: "danger-outline", icon: "x", path: "reject", doneText: `${tutorName}'s changes were not approved.` },
      ]}
    />
  );
}
