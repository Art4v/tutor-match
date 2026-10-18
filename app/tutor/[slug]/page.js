import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug, getFeaturedTutors, getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { OwnerProfile } from "./OwnerProfile";
import { TutorBlockProvider } from "./TutorBlockProvider";
import { PublicProfileView } from "./PublicProfileView";
import { listTutorDocs } from "@/lib/supabase/storage";
import { getTutorReviews } from "@/lib/supabase/reviews";
import { getCompanyBySlug } from "@/lib/supabase/companies";
import { getMyOpenRevision } from "@/lib/supabase/profileRevisions";
import { JsonLd } from "@/components/JsonLd";
import { tutorJsonLd } from "@/lib/seo/schema";
import { subjectLabel } from "@/lib/subjects";
import { stateName } from "@/lib/states";

export async function generateMetadata({ params }) {
  const supabase = createSupabaseServerClient();
  const tutor = await getTutorBySlug(supabase, params.slug);
  // Plain-string title flows through the root template -> "MatchTutor · <name>".
  // No match -> {} falls back to the "MatchTutor" default (page calls notFound).
  if (!tutor?.name) return {};
  const description = tutorDescription(tutor);
  const path = `/tutor/${tutor.slug}`;
  return {
    title: tutor.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title: `MatchTutor · ${tutor.name}`,
      description,
      url: path,
      ...(tutor.avatarImg ? { images: [tutor.avatarImg] } : {}),
    },
  };
}

// One factual sentence for the meta description and link previews: the
// tagline when there is one, then subjects, location and ATAR as listed.
function tutorDescription(tutor) {
  const subjects = tutor.subjects.slice(0, 3).map((s) => subjectLabel(s));
  const where = [tutor.suburb, stateName(tutor.city)].filter(Boolean).join(", ");
  const facts = [
    subjects.length ? `${subjects.join(", ")} tutor` : "Private tutor",
    where ? `based in ${where}` : null,
    tutor.atar ? `ATAR ${Number(tutor.atar).toFixed(2)}` : null,
  ].filter(Boolean).join(", ");
  const tagline = tutor.bio.trim();
  if (!tagline) return `${facts}.`;
  return `${/[.!?]$/.test(tagline) ? tagline : `${tagline}.`} ${facts}.`;
}

export default async function ProfilePage({ params }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Owner view — a signed-in tutor visiting their own slug edits inline. Load
  // the editor-shaped profile (no visibility filter) so a hidden profile is
  // still editable by its owner, then render the client editing shell.
  if (user) {
    const me = await getTutorProfileForEditor(supabase, user.id);
    if (me && me.slug === params.slug) {
      if (!me.onboarded) redirect("/onboarding");
      // A verified tutor edits a reviewed draft (0072): load the open one, if
      // any, so the editor opens on the draft rather than the live profile.
      const revision = me.gated ? await getMyOpenRevision(supabase, user.id) : null;
      return <OwnerProfile editorTutor={me} userId={user.id} revision={revision} />;
    }
  }

  const tutor = await getTutorBySlug(supabase, params.slug);
  if (!tutor) return notFound();

  const similarPool = await getFeaturedTutors(supabase, 50, tutor.id);
  const similar = rankTutors(similarPool).slice(0, 4);

  // Public documents (`tutor_documents` is public-read, so the anon server
  // client can read any tutor's rows).
  const docs = await listTutorDocs(supabase, tutor.id);

  // Approved reviews + author name/avatar, via the get_tutor_reviews RPC (0057)
  // — the table alone can't expose a student's name to a public page.
  const reviews = await getTutorReviews(supabase, tutor.id);

  // A company tutor renders the COMPANY's rate card, never its own: the company
  // owns pricing (packages only), and a company tutor has no rate at all
  // (0069). Null for an independent tutor, which leaves every branch below
  // inert.
  const company = tutor.company
    ? await getCompanyBySlug(supabase, tutor.company.slug)
    : null;

  return (
    <TutorBlockProvider tutorId={tutor.id} tutorName={tutor.name}>
      <JsonLd data={tutorJsonLd(tutor)} />
      <PublicProfileView tutor={tutor} docs={docs} reviews={reviews} company={company} similar={similar} />
    </TutorBlockProvider>
  );
}
