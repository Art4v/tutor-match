import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug, getFeaturedTutors, getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { Avatar } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { RateCard } from "./RateCard";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { CredentialsList } from "./CredentialsList";
import { SimilarTutorMini } from "./SimilarTutorMini";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AboutCard } from "./AboutCard";
import { OwnerProfile } from "./OwnerProfile";
import { MessageTutorButton } from "./MessageTutorButton";
import { TutorBlockProvider } from "./TutorBlockProvider";
import { ProfileBlockBanner } from "./ProfileBlockBanner";
import { ProfileSaveButton } from "./ProfileSaveButton";
import { listTutorDocs } from "@/lib/supabase/storage";
import { Section, SidebarHeading, SubjectsCard, DocumentationCard, RatingsCard, ServiceAreaCard, cardStyle, formatDelivery, buildCredentialTiles } from "./ProfileCards";

export async function generateMetadata({ params }) {
  const supabase = createSupabaseServerClient();
  const tutor = await getTutorBySlug(supabase, params.slug);
  // Plain-string title flows through the root template -> "MatchTutor · <name>".
  // No match -> {} falls back to the "MatchTutor" default (page calls notFound).
  return tutor?.name ? { title: tutor.name } : {};
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
      return <OwnerProfile editorTutor={me} userId={user.id} />;
    }
  }

  const tutor = await getTutorBySlug(supabase, params.slug);
  if (!tutor) return notFound();

  const similarPool = await getFeaturedTutors(supabase, 50, tutor.id);
  const similar = rankTutors(similarPool).slice(0, 4);

  // Public documents (`tutor_documents` is public-read, so the anon server
  // client can read any tutor's rows).
  const docs = await listTutorDocs(supabase, tutor.id);

  const deliveryLabel = formatDelivery(tutor);
  const tiles = buildCredentialTiles(tutor.credentials);

  return (
    <TutorBlockProvider tutorId={tutor.id} tutorName={tutor.name}>
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden">
      {/* Same cream desk + floating stationery as the featured section. */}
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1128px] mx-auto px-6 pt-6 pb-24">
        {/* Shown only when the signed-in student has blocked this tutor. */}
        <ProfileBlockBanner tutorName={tutor.name} />
        <div className="relative bg-[color:var(--paper-card)] overflow-hidden" style={cardStyle}>
          {/* Save bookmark — top-right of the banner. Public view only; the
              owner branch above never reaches here. */}
          <ProfileSaveButton tutorId={tutor.id} variant="banner" />
          <div
            style={{
              height: 150,
              background: tutor.bannerImg
                ? `url(${tutor.bannerImg}) center / cover no-repeat`
                : `linear-gradient(135deg, ${tutor.bannerBg ?? tutor.avatarBg}, oklch(0.96 0.01 250))`,
            }}
          />
          <div className="px-7 pb-[22px]" style={{ marginTop: -54 }}>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <Avatar tutor={tutor} size={108} ring />
            </div>

            <ProfileHeaderText tutor={tutor} deliveryLabel={deliveryLabel} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[10px] mt-[10px] items-start">
          <div className="space-y-[10px] min-w-0">
            {tutor.bioLong && <AboutCard text={tutor.bioLong} />}

            {tiles.length > 0 && (
              <Section title="Credentials" subtitle="What sets this tutor apart">
                <CredentialsList tiles={tiles} />
              </Section>
            )}

            {tutor.experience.length > 0 && (
              <Section title="Experience">
                <ExperienceTimeline experience={tutor.experience} />
              </Section>
            )}

            {tutor.education.length > 0 && (
              <Section title="Education">
                <EducationTimeline education={tutor.education} />
              </Section>
            )}

            {tutor.availability && (
              <Section title="Availability" subtitle="When you can book a session each week">
                <AvailabilityGrid availability={tutor.availability} />
              </Section>
            )}
          </div>

          <aside className="space-y-[10px]">
            <RateCard tutor={tutor} />
            {tutor.subjects.length > 0 && <SubjectsCard subjects={tutor.subjects} />}
            {docs.length > 0 && <DocumentationCard docs={docs} />}
            <RatingsCard />
            {(tutor.serviceArea?.suburb || tutor.suburb) && <ServiceAreaCard tutor={tutor} />}
            {similar.length > 0 && <SimilarTutorsCard similar={similar} />}
          </aside>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[color:var(--paper-card)] p-4 z-40 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
        <div>
          <div className="text-[20px] font-light tabular-nums" style={{ color: "var(--ink-graphite-deep)" }}>
            ${tutor.rate}
            <span className="text-[13px] font-normal" style={{ color: "var(--sage)" }}>/hr</span>
          </div>
          <div className="text-[12.5px]" style={{ color: "var(--sage)" }}>Online or in person</div>
        </div>
        <MessageTutorButton tutor={tutor} full={false} />
      </div>
    </div>
    </TutorBlockProvider>
  );
}

function SimilarTutorsCard({ similar }) {
  return (
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      <SidebarHeading>Similar tutors</SidebarHeading>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {similar.map((t) => (
          <SimilarTutorMini key={t.id} tutor={t} />
        ))}
      </div>
    </div>
  );
}
