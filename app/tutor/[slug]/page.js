import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug, getFeaturedTutors } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { subjectLabel } from "@/lib/subjects";
import { yearRangeLabel } from "@/lib/yearLevels";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, Chip, Button } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { RateCard } from "./RateCard";
import ServiceAreaMap from "./ServiceAreaMap";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { CredentialsList } from "./CredentialsList";
import { SimilarTutorMini } from "./SimilarTutorMini";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AboutCard } from "./AboutCard";

export default async function ProfilePage({ params }) {
  const supabase = createSupabaseServerClient();
  const tutor = await getTutorBySlug(supabase, params.slug);
  if (!tutor) return notFound();

  const similarPool = await getFeaturedTutors(supabase, 50, tutor.id);
  const similar = rankTutors(similarPool).slice(0, 4);

  const deliveryLabel = formatDelivery(tutor);

  return (
    <div
      className="desk-surface relative overflow-hidden"
      // Bleed under the fixed transparent nav (cancels the layout's nav-height
      // spacer, same as HomeHero) so the desk backdrop shows through it.
      style={{ marginTop: "calc(-1 * var(--nav-h))", paddingTop: "var(--nav-h)" }}
    >
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

            {(() => {
              const metaForIcon = (icon) => {
                switch (icon) {
                  case "atar":        return { caption: "ATAR",       kind: "stat" };
                  case "graduation":  return { caption: "DEGREE",     kind: "credential" };
                  case "check-badge": return { caption: "STATE RANK", kind: "credential" };
                  case "star":        return { caption: "HIGHLIGHT",  kind: "credential" };
                  case "trophy":      return { caption: "AWARD",      kind: "credential" };
                  default:            return { caption: "CREDENTIAL", kind: "credential" };
                }
              };
              const tiles = [];
              for (const [i, c] of (tutor.credentials ?? []).entries()) {
                const label = typeof c === "string" ? c : c.label;
                if (!label) continue;
                const icon = (typeof c === "string" ? null : c.icon) || "trophy";
                const meta = metaForIcon(icon);
                tiles.push({ key: `cred-${i}`, caption: meta.caption, value: label, icon, kind: meta.kind });
              }
              if (tiles.length === 0) return null;
              return (
                <Section title="Credentials" subtitle="What sets this tutor apart">
                  <CredentialsList tiles={tiles} />
                </Section>
              );
            })()}

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

function formatDelivery(tutor) {
  const parts = [];
  if (tutor.deliversInPerson) parts.push("In-person");
  if (tutor.deliversOnline) parts.push("online");
  if (parts.length === 0) return null;
  return parts.join(" + ");
}

function Section({ title, subtitle, children, id }) {
  // The whole card fades in together via SectionReveal — no per-element typing.
  return (
    <SectionReveal
      as="section"
      id={id}
      hover
      className="paper-page bg-[color:var(--paper-card)]"
      style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 24 }}
    >
      <div className="mb-5">
        <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <div className="text-[13px] text-slate-500 mt-0.5">{subtitle}</div>
        )}
      </div>
      {children}
    </SectionReveal>
  );
}

function SubjectsCard({ subjects }) {
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">Subjects</div>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <Chip key={s.slug} tone="cream" icon="graduation">{subjectLabel(s)}</Chip>
        ))}
      </div>
    </SectionReveal>
  );
}

function RatingsCard() {
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22 }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[14px] font-semibold text-slate-900">Ratings &amp; reviews</div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider"
          style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 999, color: "var(--ink-muted)" }}
        >
          Coming soon
        </span>
      </div>
      <div className="flex flex-col items-center text-center py-6">
        <div className="flex items-center gap-1.5 mb-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Icon key={i} name="star" size={22} className="text-slate-200" />
          ))}
        </div>
        <div className="text-[13px] text-slate-500 leading-[1.55] max-w-[260px]">
          Ratings and reviews are coming soon — we&apos;re working on a way for verified students to leave them.
        </div>
      </div>
    </SectionReveal>
  );
}

function ServiceAreaCard({ tutor }) {
  const sa = tutor.serviceArea;
  const radiusKm = sa?.radiusKm ?? 10;
  const hasCoords = Number.isFinite(sa?.lat) && Number.isFinite(sa?.lng);
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)] overflow-hidden" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)" }}>
      <div className="px-5 pt-5 pb-5">
        <div className="text-[14px] font-semibold text-slate-900">Service area</div>
        <div className="text-[12.5px] text-slate-500 mt-0.5">
          In-person within {radiusKm} km of {sa?.suburb || tutor.suburb}
        </div>
      </div>
      {hasCoords && (
        <div className="px-5 pb-5">
          <ServiceAreaMap lat={sa.lat} lng={sa.lng} radiusKm={radiusKm} />
        </div>
      )}
    </SectionReveal>
  );
}

function SimilarTutorsCard({ similar }) {
  return (
    <SectionReveal className="bg-transparent" style={{ borderRadius: 0 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4 px-1">Similar tutors</div>
      <SimilarTutorsStack similar={similar} />
    </SectionReveal>
  );
}

function SimilarTutorsStack({ similar }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {similar.map((t) => (
        <SimilarTutorMini key={t.id} tutor={t} />
      ))}
    </div>
  );
}

