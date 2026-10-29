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
  tutorInvites: () => `/admin/tutor-invites`,
  managedTutor: (tutorId) => `/admin/tutor-invites/${tutorId}`,
  managedTutorEdit: (tutorId) => `/admin/tutor-invites/${tutorId}/edit`,
};

// History actions about a managed tutor (0076) link to its management page
// rather than the verification queue.
const MANAGED_ACTIONS = new Set([
  "managed_profile_edited",
  "managed_visibility_set",
  "managed_document_changed",
  "verification_set",
  "managed_setup_done",
]);

/** Dashboard link for an admin_actions row, or null when there is no page for it. */
export function historyTargetHref(row) {
  if (row?.action === "tutor_invite_rotated") return adminPaths.tutorInvites();
  if (!row?.target_id) return null;
  if (MANAGED_ACTIONS.has(row.action)) return adminPaths.managedTutor(row.target_id);
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
