// Server-side date formatting for /admin, pinned to Sydney so the server and
// client never disagree at hydration (see ReviewItem.jsx).
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Sydney",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

export const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : "");
export const formatDateTime = (iso) => (iso ? dateTimeFmt.format(new Date(iso)) : "");

// History action -> plain words. Keep in step with the admin_actions CHECK (0074).
export const ACTION_LABELS = {
  verification_approved: "Approved verification",
  verification_rejected: "Rejected verification",
  review_approved: "Published review",
  review_rejected: "Rejected review",
  report_disable_reported: "Disabled reported account",
  report_disable_reporter: "Disabled reporter",
  report_dismiss: "Dismissed report",
  report_remove_review: "Removed reported review",
  revision_approved: "Approved profile changes",
  revision_rejected: "Rejected profile changes",
  account_disabled: "Disabled account",
  account_enabled: "Re-enabled account",
  author_granted: "Granted authoring",
  author_revoked: "Revoked authoring",
  company_invited: "Invited company",
  company_link_issued: "Copied claim link",
  company_hidden: "Hid company",
  company_shown: "Made company live",
  company_deleted: "Deleted company",
};

// The History filter groups actions by prefix (lib/supabase/adminDashboard.js).
export const ACTION_GROUPS = [
  { value: "verification", label: "Verification" },
  { value: "review", label: "Reviews" },
  { value: "report", label: "Reports" },
  { value: "revision", label: "Profile changes" },
  { value: "account", label: "Account status" },
  { value: "author", label: "Authoring" },
  { value: "company", label: "Companies" },
];

// Keep in sync with the 0059 CHECK + ReportModal + lib/email/send.js.
export const REPORT_CATEGORY_LABELS = {
  harassment: "Harassment or abuse",
  spam: "Spam",
  inappropriate: "Inappropriate content",
  scam: "Scam or fraud",
  other: "Other",
  inappropriate_review: "Inappropriate review",
};
