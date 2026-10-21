import { Avatar } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { CompanyRateCard, EnquireButton } from "@/app/companies/[slug]/CompanyCards";
import { RateCard } from "./RateCard";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { CredentialsList } from "./CredentialsList";
import { SimilarTutorMini } from "./SimilarTutorMini";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AboutCard } from "./AboutCard";
import { MessageTutorButton } from "./MessageTutorButton";
import { ProfileBlockBanner } from "./ProfileBlockBanner";
import { ProfileSaveButton } from "./ProfileSaveButton";
import { RevealStack } from "./RevealStack";
import { ReviewsCard } from "./ReviewsCard";
import { Section, SidebarHeading, SubjectsCard, DocumentationCard, ServiceAreaCard, cardStyle, formatDelivery, buildCredentialTiles } from "./ProfileCards";

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
        <div className="relative bg-[color:var(--paper-card)] overflow-hidden" style={cardStyle}>
          {/* Save bookmark — top-right of the banner. Public view only; the
              owner branch above never reaches here. */}
          {!preview && <ProfileSaveButton tutorId={tutor.id} variant="banner" />}
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
        </RevealStack>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[10px] mt-[10px] items-start">
          <RevealStack className="space-y-[10px] min-w-0" delayChildren={0.12}>
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

          <RevealStack as="aside" className="space-y-[10px]" delayChildren={0.12}>
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
            {similar.length > 0 && <SimilarTutorsCard similar={similar} />}
          </RevealStack>
        </div>
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
