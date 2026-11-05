"use client";

import { useState } from "react";
import { BugReportModal } from "@/components/BugReportModal";

// Client island for the (server-rendered) Footer: a footer-styled trigger that
// opens the BugReportModal. Kept separate so Footer.js stays a server component.
export function ReportBugLink({ className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        Report a bug
      </button>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </>
  );
}
