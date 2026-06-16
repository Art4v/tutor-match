import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug, getFeaturedTutors, getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { Avatar, Button } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { RateCard } from "./RateCard";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { CredentialsList } from "./CredentialsList";
import { SimilarTutorMini } from "./SimilarTutorMini";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AboutCard } from "./AboutCard";
import { OwnerProfile } from "./OwnerProfile";
import { Section, SubjectsCard, RatingsCard, ServiceAreaCard, formatDelivery, buildCredentialTiles } from "./ProfileCards";

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

  const deliveryLabel = formatDelivery(tutor);
  const tiles = buildCredentialTiles(tutor.credentials);

  return (
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden">
      {/* Same cream desk + floating stationery as the featured section. */}
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-6 pb-24">
        <SectionReveal hover className="paper-page relative bg-[color:var(--paper-card)] overflow-hidden" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)" }}>
          <div
            style={{
              height: 140,
              background: tutor.bannerImg
                ? `url(${tutor.bannerImg}) center / cover no-repeat`
                : `linear-gradient(135deg, ${tutor.bannerBg ?? tutor.avatarBg}, oklch(0.96 0.01 250))`,
            }}
          />
          <div className="px-7 pb-7" style={{ marginTop: -54 }}>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <Avatar tutor={tutor} size={108} ring />
            </div>

            <ProfileHeaderText tutor={tutor} deliveryLabel={deliveryLabel} />
          </div>
        </SectionReveal>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-8">
          <div className="space-y-8 min-w-0">
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

          <aside className="space-y-5">
            <RateCard tutor={tutor} />
            {tutor.subjects.length > 0 && <SubjectsCard subjects={tutor.subjects} />}
            <RatingsCard />
            {(tutor.serviceArea?.suburb || tutor.suburb) && <ServiceAreaCard tutor={tutor} />}
            {similar.length > 0 && <SimilarTutorsCard similar={similar} />}
          </aside>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[color:var(--paper-card)] p-4 z-40 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
        <div>
          <div className="text-[18px] font-semibold tabular-nums">
            ${tutor.rate}
            <span className="text-[13px] text-slate-400 font-normal">/hr</span>
          </div>
          <div className="text-[11.5px] text-slate-500">Online or in person</div>
        </div>
        <Button variant="primary" size="lg" icon="calendar" disabled>Request a lesson</Button>
      </div>
    </div>
  );
}

function SimilarTutorsCard({ similar }) {
  return (
    <SectionReveal className="bg-transparent" style={{ borderRadius: 0 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4 px-1">Similar tutors</div>
      <div className="grid grid-cols-2 gap-3">
        {similar.map((t) => (
          <SimilarTutorMini key={t.id} tutor={t} />
        ))}
      </div>
    </SectionReveal>
  );
}
