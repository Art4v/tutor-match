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
    <div>
      <div role="status" className="mb-6 p-4 rounded border border-warning text-[14px] leading-5 text-[color:var(--text)]">
        Preview of {found.tutorName}&apos;s submitted changes ({found.revision.status}). Not public.{" "}
        <a href={adminPaths.revision(found.revision.id)} className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover">Back to review</a>
      </div>
      <PublicProfileView tutor={tutor} docs={found.draftDocs.map((d) => ({ ...d, path: d.path || d.stagedPath || "" }))} reviews={reviews} preview />
    </div>
  );
}
