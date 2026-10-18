import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRevisionToken } from "@/lib/revisionToken";
import { getRevisionForModeration } from "@/lib/supabase/profileRevisions";
import { getTutorReviews } from "@/lib/supabase/reviews";
import { editorToDisplay } from "@/lib/tutorShape";
import { resolveImage } from "@/lib/profileRevision";
import { PublicProfileView } from "@/app/tutor/[slug]/PublicProfileView";
import { Shell, StateCard, tokenErrorCard } from "../AdminShell";

export const metadata = { title: "Preview profile changes", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full-page preview of a verified tutor's submitted profile changes, rendered
// through the same PublicProfileView students see, so the admin approves
// exactly what will publish. Same token as the review page; read-only.
export default async function AdminProfileRevisionPreviewPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { revisionId, error } = verifyRevisionToken(token);
  if (error) {
    const card = tokenErrorCard(error);
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title={card.title} body={card.body} />
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Server not configured" body="Previews need SUPABASE_SERVICE_ROLE_KEY set on the server." />
      </Shell>
    );
  }

  const found = await getRevisionForModeration(admin, revisionId);
  if (!found) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Not found" body="These changes no longer exist." />
      </Shell>
    );
  }

  const display = editorToDisplay(found.draft, found.subjectCatalog);
  const tutor = {
    ...display,
    avatarImg: resolveImage(found.draft.avatarImg, found.signed),
    bannerImg: resolveImage(found.draft.bannerImg, found.signed),
  };
  const reviews = await getTutorReviews(admin, found.revision.tutorId);
  const reviewHref = `/admin/profile-revision?token=${encodeURIComponent(token)}`;

  return (
    <>
      <div className="relative z-50 px-4 py-2.5 text-center text-[13px]" style={{ background: "#FFFBEB", color: "#92400E", borderBottom: "1px solid #FDE68A" }}>
        Preview of {found.tutorName}&apos;s submitted changes ({found.revision.status}). Not public.{" "}
        <a href={reviewHref} className="font-medium underline underline-offset-2">Back to review</a>
      </div>
      <PublicProfileView tutor={tutor} docs={found.draftDocs.map((d) => ({ ...d, path: d.path || d.stagedPath || "" }))} reviews={reviews} preview />
    </>
  );
}
