import { TutorRow } from "@/components/TutorRow";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { CompanyRateCard, EnquireButton } from "@/app/companies/[slug]/CompanyCards";
import { RateCard } from "./RateCard";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { CredentialsList } from "./CredentialsList";
import { ProfileHeader } from "./ProfileHeader";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AboutCard } from "./AboutCard";
import { MessageTutorButton } from "./MessageTutorButton";
import { ProfileBlockBanner } from "./ProfileBlockBanner";
import { ProfileSaveButton } from "./ProfileSaveButton";
import { RevealStack } from "./RevealStack";
import { ReviewsCard } from "./ReviewsCard";
import { Section, SubjectsCard, DocumentationCard, ServiceAreaCard, formatDelivery, buildCredentialTiles } from "./ProfileCards";

/**
 * The public tutor profile, as students see it. Rendered by /tutor/[slug]
 * (inside TutorBlockProvider, with JSON-LD alongside) and by the admin preview
 * of a verified tutor's submitted changes (/admin/profile-changes/[id]/preview), so
 * what an admin approves is exactly what will publish.
 *
 * `tutor` is the display shape (tutorRowToDetail, or editorToDisplay of a
 * draft). `preview` drops everything that acts on the viewer's behalf: the
 * bookmark, the block banner and the mobile contact bar.
 */
export function PublicProfileView({ tutor, docs = [], reviews = [], company = null, similar = [], preview = false }) {
  const deliveryLabel = formatDelivery(tutor);
  const tiles = buildCredentialTiles(tutor.credentials);

  return (
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden">
      {/* Same cream desk + floating stationery as the featured section. */}
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1128px] mx-auto px-6 pt-6 pb-24">
        {/* Shown only when the signed-in student has blocked this tutor. */}
        {!preview && <ProfileBlockBanner tutorName={tutor.name} />}
        <RevealStack>
          <ProfileHeader tutor={tutor} deliveryLabel={deliveryLabel}>
            {/* Save bookmark, top right of the header. Public view only; the
                owner branch never reaches here. */}
            {!preview && <ProfileSaveButton tutorId={tutor.id} variant="banner" />}
          </ProfileHeader>
        </RevealStack>

        {/* Sections, not cards: each carries its own padding and bottom rule,
            so the columns need no gap between children. The contact column
            leads the sidebar; below lg the main column comes first and the
            fixed contact bar covers contact. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-x-12 items-start">
          <RevealStack className="min-w-0" delayChildren={0.12}>
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
          </RevealStack>

          <RevealStack as="aside" className="min-w-0 pt-6" delayChildren={0.12}>
            {company ? <CompanyRateCard company={company} /> : <RateCard tutor={tutor} showMessage={!preview} />}
            {tutor.subjects.length > 0 && <SubjectsCard subjects={tutor.subjects} />}
            {docs.length > 0 && <DocumentationCard docs={docs} />}
            {/* Reviews are COMPANY-level for company tutors (0066), so the
                per-tutor card is suppressed here. The hidden UI is not the
                boundary: /api/reviews refuses a company-managed tutor id. */}
            {!company && (
              <ReviewsCard tutorId={tutor.id} tutorName={tutor.name} rating={tutor.rating} reviewCount={tutor.reviews} reviews={reviews} />
            )}
            {(tutor.serviceArea?.suburb || tutor.suburb) && <ServiceAreaCard tutor={tutor} />}
          </RevealStack>
        </div>

        {!preview && <OtherVerifiedTutors similar={similar} />}
      </div>

      {!preview && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[color:var(--paper-card)] p-4 z-40 flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
          <div>
            <div className="text-[20px] font-light tabular-nums" style={{ color: "var(--ink-graphite-deep)" }}>
              {company ? company.name : `$${tutor.rate}`}
              {!company && <span className="text-[13px] font-normal" style={{ color: "var(--sage)" }}>/hr</span>}
            </div>
            <div className="text-[12.5px]" style={{ color: "var(--sage)" }}>
              {company ? "Priced by package" : "Online or in person"}
            </div>
          </div>
          {/* Companies are contacted through their own site, never by DM.
              start_conversation() refuses a company tutor outright (0065), so
              this swap is presentation catching up with the database. */}
          {company ? <EnquireButton company={company} full={false} /> : <MessageTutorButton tutor={tutor} full={false} />}
        </div>
      )}
    </div>
  );
}

// Related tutors, after the main columns: the same ruled list of rows as
// /browse. Headed "Other verified tutors" (they were never similar) and
// filtered here to individually verified tutors so the heading is true; a
// company tutor is excluded, since its tick is not earned individually.
function OtherVerifiedTutors({ similar }) {
  const tutors = (similar ?? []).filter((t) => t.verified && !t.company && !t.isCompanyTutor);
  if (tutors.length === 0) return null;
  return (
    <section className="pt-12">
      <h2 className="text-[22px] font-light text-slate-800 tracking-tight">Other verified tutors</h2>
      <ul className="mt-4 border-t border-[color:var(--paper-line)]">
        {tutors.map((t) => (
          <li key={t.id} className="border-b border-[color:var(--paper-line)]">
            <TutorRow tutor={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
