import { Avatar } from "@/components/ui";
import { TutorCard } from "@/components/TutorCard";
import { CompanyRateCard } from "@/app/companies/[slug]/CompanyCards";
import { RateCard } from "./RateCard";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { CredentialsList } from "./CredentialsList";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AboutCard } from "./AboutCard";
import { ProfileBlockBanner } from "./ProfileBlockBanner";
import { ProfileSaveButton } from "./ProfileSaveButton";
import { ReviewsCard } from "./ReviewsCard";
import { Section, SubjectsCard, DocumentationCard, ServiceAreaCard, formatDelivery, buildCredentialTiles } from "./ProfileCards";

/**
 * The public tutor profile, as students see it (REDESIGN_DECISIONS.md item 5).
 * Rendered by /tutor/[slug] (inside TutorBlockProvider, with JSON-LD alongside)
 * and by the admin preview of a verified tutor's submitted changes
 * (/admin/profile-changes/[id]/preview), so what an admin approves is exactly
 * what will publish.
 *
 * `tutor` is the display shape (tutorRowToDetail, or editorToDisplay of a
 * draft). `preview` drops everything that acts on the viewer's behalf: the
 * bookmark, the block banner and the Message button.
 *
 * Layout: header (banner only if uploaded, photo, name block), then a main
 * column of flat sections and, from 1024px, a sticky contact column on the
 * right. Below 1024px the contact column sits inline directly under the header
 * (it comes first in source order for that reason; the grid placement moves it
 * right on wide screens). There is no fixed bottom bar.
 */
export function PublicProfileView({ tutor, docs = [], reviews = [], company = null, similar = [], preview = false }) {
  const tiles = buildCredentialTiles(tutor.credentials);

  return (
    <div className="bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-6 pb-16">
        {/* Shown only when the signed-in student has blocked this tutor. */}
        {!preview && <ProfileBlockBanner tutorName={tutor.name} />}

        <ProfileHeader
          tutor={tutor}
          action={!preview && <ProfileSaveButton tutorId={tutor.id} className="right-0 top-0" />}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-12">
          <aside className="pt-6 lg:col-start-2 lg:row-start-1 lg:mt-6 lg:pt-0 lg:sticky lg:top-20 lg:self-start">
            {/* A company tutor shows the COMPANY's packages and Enquire, never a
                rate of its own (0069) and never Message (start_conversation()
                refuses a company tutor, 0065). */}
            {company ? <CompanyRateCard company={company} /> : <RateCard tutor={tutor} showMessage={!preview} />}
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            {tutor.bioLong && <AboutCard text={tutor.bioLong} />}

            {tutor.subjects.length > 0 && <SubjectsCard subjects={tutor.subjects} />}

            {tiles.length > 0 && (
              <Section title="Credentials">
                <CredentialsList tiles={tiles} />
              </Section>
            )}

            {docs.length > 0 && <DocumentationCard docs={docs} />}

            {tutor.education.length > 0 && (
              <Section title="Education">
                <EducationTimeline education={tutor.education} />
              </Section>
            )}

            {tutor.experience.length > 0 && (
              <Section title="Experience">
                <ExperienceTimeline experience={tutor.experience} />
              </Section>
            )}

            {/* Reviews are COMPANY-level for company tutors (0067), so the
                per-tutor section is suppressed here. The hidden UI is not the
                boundary: /api/reviews refuses a company-managed tutor id. */}
            {!company && (
              <ReviewsCard tutorId={tutor.id} tutorName={tutor.name} rating={tutor.rating} reviewCount={tutor.reviews} reviews={reviews} />
            )}

            {tutor.availability && (
              <Section title="Availability" subtitle="Times this tutor is usually free each week">
                <AvailabilityGrid availability={tutor.availability} />
              </Section>
            )}

            {(tutor.serviceArea?.suburb || tutor.suburb) && <ServiceAreaCard tutor={tutor} />}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="pt-12">
            <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Other verified tutors</h2>
            <ul className="mt-4 border-t border-rule">
              {similar.map((t) => (
                <li key={t.id} className="border-b border-rule">
                  <TutorCard tutor={t} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Banner (only when the tutor uploaded one: no strip, no gradient fallback),
 * circle photo overlapping its bottom-left edge, then the name block. `action`
 * is the top-right slot (the bookmark on the public view). Exported so the
 * owner editor can render the same header.
 */
export function ProfileHeader({ tutor, action = null }) {
  const banner = tutor.bannerImg || null;
  return (
    <header className="border-b border-rule pb-6">
      {banner && (
        <div
          aria-hidden="true"
          className="h-[120px] sm:h-[160px] rounded bg-surface-2"
          style={{ backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className={banner ? "-mt-12 ml-4 w-fit sm:ml-6" : "w-fit"}>
          <Avatar tutor={tutor} size={112} ring={!!banner} />
        </div>
        <div className={`min-w-0 flex-1 ${action ? "pr-12" : ""} ${banner ? "sm:pt-4" : "sm:pt-2"}`}>
          <ProfileHeaderText tutor={tutor} deliveryLabel={formatDelivery(tutor)} />
        </div>
        {action && <div className={`absolute right-0 ${banner ? "top-4" : "top-0"}`}>{action}</div>}
      </div>
    </header>
  );
}
