import { notFound } from "next/navigation";
import { getRevisionForModeration } from "@/lib/supabase/profileRevisions";
import { getTutorReviews } from "@/lib/supabase/reviews";
import { editorToDisplay } from "@/lib/tutorShape";
import { resolveImage } from "@/lib/profileRevision";
import { adminPaths } from "@/lib/admin/urls";
import { PublicProfileView } from "@/app/tutor/[slug]/PublicProfileView";
import { requireAdmin } from "../../../guard";

export const metadata = { title: "Preview profile changes" };

// A verified tutor's submitted changes rendered through the same
// PublicProfileView students see, so the admin approves exactly what will
// publish. Read-only.
export default async function RevisionPreviewPage({ params }) {
  const { admin } = await requireAdmin();
  if (!admin) notFound();

  const found = await getRevisionForModeration(admin, params.id);
  if (!found) notFound();

  const display = editorToDisplay(found.draft, found.subjectCatalog);
  const tutor = {
    ...display,
    avatarImg: resolveImage(found.draft.avatarImg, found.signed),
    bannerImg: resolveImage(found.draft.bannerImg, found.signed),
  };
  const reviews = await getTutorReviews(admin, found.revision.tutorId);

  return (
    <div style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
      <div className="px-4 py-2.5 text-center text-[13px]" style={{ background: "#FFFBEB", color: "#92400E", borderBottom: "1px solid #FDE68A" }}>
        Preview of {found.tutorName}&apos;s submitted changes ({found.revision.status}). Not public.{" "}
        <a href={adminPaths.revision(found.revision.id)} className="font-medium underline underline-offset-2">Back to review</a>
      </div>
      <PublicProfileView tutor={tutor} docs={found.draftDocs.map((d) => ({ ...d, path: d.path || d.stagedPath || "" }))} reviews={reviews} preview />
    </div>
  );
}
