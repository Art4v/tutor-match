// Shared by the /api/profile-revisions routes (not itself a route: only
// route.js files are). Keeps the owner gate, the "what changed" computation and
// the admin email in one place so submit and resend cannot drift.

import { NextResponse } from "next/server";
import { adminProfileRevisionEmail } from "@/lib/email/send";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminPaths } from "@/lib/admin/urls";
import { getTutorProfileForEditor, getSubjects } from "@/lib/supabase/tutors";
import { listTutorDocs } from "@/lib/supabase/storage";
import { getMyOpenRevision } from "@/lib/supabase/profileRevisions";
import { isAccountEnabled } from "@/lib/supabase/account";
import { payloadToEditor, payloadDocsToList } from "@/lib/profileRevision";
import { diffProfiles } from "@/lib/profileDiff";

/**
 * Signed in, enabled, and a GATED tutor (verified, not a company tutor).
 * Returns { user, me } or { res } (an error response to return as is).
 */
export async function requireGatedTutor(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  // middleware exempts /api, so enforce "not disabled" here (0052).
  if (!(await isAccountEnabled(supabase, user.id))) {
    return { res: NextResponse.json({ error: "Your account is disabled." }, { status: 403 }) };
  }
  const me = await getTutorProfileForEditor(supabase, user.id);
  if (!me) {
    return { res: NextResponse.json({ error: "No tutor profile." }, { status: 404 }) };
  }
  if (!me.gated) {
    return { res: NextResponse.json({ error: "Only verified tutors submit changes for review." }, { status: 403 }) };
  }
  return { user, me };
}

/**
 * The caller's open revision and its diff against the live profile.
 * Returns { revision, diff } (revision null when there is none).
 */
export async function loadOwnRevisionDiff(supabase, me) {
  const revision = await getMyOpenRevision(supabase, me.id);
  if (!revision) return { revision: null, diff: [] };
  const [liveDocs, subjectCatalog] = await Promise.all([listTutorDocs(supabase, me.id), getSubjects(supabase)]);
  const diff = diffProfiles({
    live: me,
    draft: payloadToEditor(revision.payload, me),
    liveDocs,
    draftDocs: payloadDocsToList(revision.payload, liveDocs),
    subjectCatalog,
  });
  return { revision, diff };
}

/** One short line per changed field, for the admin email. */
export function changeLines(diff) {
  return (diff ?? []).map((d) => {
    if (d.kind === "subjects") {
      const parts = [
        d.added.length ? `added ${d.added.join(", ")}` : null,
        d.removed.length ? `removed ${d.removed.join(", ")}` : null,
      ].filter(Boolean);
      return parts.length ? `Subjects: ${parts.join("; ")}` : "Subjects: reordered";
    }
    if (d.kind === "documents") {
      const parts = [
        d.added.length ? `${d.added.length} added` : null,
        d.removed.length ? `${d.removed.length} removed` : null,
        d.renamed.length ? `${d.renamed.length} renamed` : null,
      ].filter(Boolean);
      return `Documents: ${parts.join(", ")}`;
    }
    return d.label;
  });
}

/** Dashboard links for `revisionId` (both need an admin session). */
export function revisionLinks(request, revisionId) {
  const origin = new URL(request.url).origin;
  return {
    origin,
    reviewUrl: `${origin}${adminPaths.revision(revisionId)}`,
    previewUrl: `${origin}${adminPaths.revisionPreview(revisionId)}`,
  };
}

/** Alert the admins with the review + preview links. Never throws. */
export async function emailAdminAboutRevision({ links, me, diff, resent = false }) {
  const tutorName = me.name || "A verified tutor";
  return emailAdmins({
    subject: `${resent ? "Reminder: profile" : "Profile"} changes to review: ${tutorName}`,
    html: adminProfileRevisionEmail({
      tutorName,
      changes: changeLines(diff),
      reviewUrl: links.reviewUrl,
      previewUrl: links.previewUrl,
      profileUrl: me.slug ? `${links.origin}/tutor/${me.slug}` : null,
      resent,
    }),
  });
}
