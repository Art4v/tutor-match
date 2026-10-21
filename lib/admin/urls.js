// Dashboard deep links, shared by the alert emails, the History rows and the
// redirect stubs that catch old token links. One definition per target type.

export const adminPaths = {
  verification: (tutorId) => `/admin/verification/${tutorId}`,
  review: (reviewId) => `/admin/reviews/${reviewId}`,
  report: (reportId) => `/admin/reports/${reportId}`,
  revision: (revisionId) => `/admin/profile-changes/${revisionId}`,
  revisionPreview: (revisionId) => `/admin/profile-changes/${revisionId}/preview`,
  company: () => `/admin/companies`,
  user: (userId) => `/admin/users/${userId}`,
};

/** Dashboard link for an admin_actions row, or null when there is no page for it. */
export function historyTargetHref(row) {
  if (!row?.target_id) return null;
  switch (row.target_type) {
    case "tutor":
      return adminPaths.verification(row.target_id);
    case "review":
      return adminPaths.review(row.target_id);
    case "report":
      return adminPaths.report(row.target_id);
    case "revision":
      return adminPaths.revision(row.target_id);
    case "company":
      return row.action === "company_deleted" ? null : adminPaths.company();
    case "user":
      return adminPaths.user(row.target_id);
    default:
      return null;
  }
}
