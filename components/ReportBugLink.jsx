"use client";

import { useState } from "react";
import { BugReportModal } from "@/components/BugReportModal";

// Client island for the (server-rendered) Footer: a footer-styled trigger that
// opens the BugReportModal. Kept separate so Footer.js stays a server component.
export function ReportBugLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="footer-link"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
      >
        Report a bug
      </button>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </>
  );
}
