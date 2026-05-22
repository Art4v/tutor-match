import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorBySlug, getFeaturedTutors } from "@/lib/supabase/tutors";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, Chip } from "@/components/ui";
import { SaveButton } from "./SaveButton";
import { RateCard } from "./RateCard";
import ServiceAreaMap from "./ServiceAreaMap";

export default async function ProfilePage({ params }) {
  const supabase = createSupabaseServerClient();
  const tutor = await getTutorBySlug(supabase, params.slug);
  if (!tutor) return notFound();

  const similar = await getFeaturedTutors(supabase, 3, tutor.id);

  const deliveryLabel = formatDelivery(tutor);

  return (
    <div className="bg-white">
      <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-24">
        <div className="relative bg-white overflow-hidden" style={{ border: "1px solid #E5E7EB", borderRadius: 16 }}>
          <div
            style={{
              height: 140,
              background: tutor.bannerImg
                ? `url(${tutor.bannerImg}) center / cover no-repeat`
                : `linear-gradient(135deg, ${tutor.avatarBg}, oklch(0.96 0.01 250))`,
            }}
          />
          <div className="px-7 pb-7" style={{ marginTop: -54 }}>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <Avatar tutor={tutor} size={108} ring />
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">{tutor.name}</h1>
                {tutor.verified && <VerifiedTick size={18} />}
              </div>
              {tutor.role && <div className="text-[15px] text-slate-600 mt-1">{tutor.role}</div>}
              <div className="flex items-center gap-4 text-[13.5px] text-slate-500 mt-2 flex-wrap">
                {(tutor.location || tutor.suburb || tutor.city) && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="map-pin" size={13} />
                    {tutor.location || [tutor.suburb, tutor.city].filter(Boolean).join(", ")}
                  </span>
                )}
                {deliveryLabel && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="globe" size={13} /> {deliveryLabel}
                  </span>
                )}
                {tutor.responsive && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />
                    {tutor.responsive}
                  </span>
                )}
              </div>

              {tutor.credentials.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {tutor.credentials.map((c, i) => {
                    const label = typeof c === "string" ? c : c.label;
                    const iconHint = typeof c === "string"
                      ? (label?.includes("ATAR") ? "graduation" : "trophy")
                      : (c.icon || (label?.includes("ATAR") ? "graduation" : "trophy"));
                    return (
                      <Chip key={i} tone="cream" icon={iconHint}>{label}</Chip>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-5 mt-5 text-[13px] text-slate-500 pt-5 flex-wrap" style={{ borderTop: "1px solid #F1F5F9" }}>
                {tutor.rating != null && (
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <Icon name="star" size={13} className="text-slate-700" />
                    <span className="text-slate-900 font-medium">{tutor.rating.toFixed(1)}</span>
                    · {tutor.reviews} reviews
                  </span>
                )}
                {tutor.yearsTutoring != null && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="clock" size={13} />
                    <span className="text-slate-900 font-medium">{tutor.yearsTutoring} yrs</span>
                    <span>tutoring</span>
                  </span>
                )}
                {tutor.languages.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="language" size={13} />
                    {tutor.languages.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {tutor.bio && (
          <p className="text-[15px] text-slate-600 leading-[1.6] mt-4 max-w-[760px]">{tutor.bio}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-8">
          <div className="space-y-8 min-w-0">
            {tutor.bioLong && (
              <Section id="about" title="About">
                <div className="text-[15px] text-slate-600 leading-[1.6] whitespace-pre-line">
                  {tutor.bioLong}
                </div>
              </Section>
            )}

            <Section title="Credentials" subtitle="What sets this tutor apart">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "ATAR", value: tutor.atar ? tutor.atar.toFixed(2) : "—", icon: "graduation" },
                  { label: "Rank", value: tutor.rank || "—", icon: "trophy", sub: tutor.rankSubject || undefined },
                  { label: "Rating", value: tutor.rating ? tutor.rating.toFixed(1) : "—", icon: "star", sub: tutor.rating ? `${tutor.reviews} reviews` : undefined },
                  { label: "Rate", value: `$${tutor.rate}`, icon: "trending-up", sub: "/hour" },
                ].map((c) => (
                  <div key={c.label} className="p-4" style={{ border: "1px solid #E5E7EB", borderRadius: 12, background: "#FAFAFA" }}>
                    <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 uppercase tracking-wider font-medium">
                      <Icon name={c.icon} size={12} /> {c.label}
                    </div>
                    <div className="text-[22px] font-semibold text-slate-900 mt-1 tabular-nums">
                      {c.value}
                      {c.sub && <span className="text-[12.5px] text-slate-400 font-normal ml-1">{c.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {tutor.experience.length > 0 && (
              <Section title="Experience">
                <ol className="space-y-5">
                  {tutor.experience.map((e, i) => (
                    <li key={i} className="flex gap-4">
                      <div className="flex flex-col items-center" style={{ width: 32 }}>
                        <div className="w-8 h-8 rounded-md inline-flex items-center justify-center text-slate-600" style={{ background: "#F3F4F6" }}>
                          <Icon name="briefcase" size={14} />
                        </div>
                        {i < tutor.experience.length - 1 && <div style={{ width: 1, flex: 1, background: "#E5E7EB", marginTop: 4 }} />}
                      </div>
                      <div className="pb-1 flex-1">
                        <div className="text-[14.5px] font-semibold text-slate-900">{e.role}</div>
                        <div className="text-[13.5px] text-slate-600">{e.org}</div>
                        <div className="text-[12.5px] text-slate-400 mt-0.5">{e.period}</div>
                        <div className="text-[13.5px] text-slate-600 mt-2 leading-[1.55]">{e.note}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {tutor.education.length > 0 && (
              <Section title="Education">
                <ul className="space-y-4">
                  {tutor.education.map((e, i) => (
                    <li key={i} className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-md inline-flex items-center justify-center text-slate-600 shrink-0" style={{ background: "#F3F4F6" }}>
                        <Icon name="graduation" size={14} />
                      </div>
                      <div>
                        <div className="text-[14.5px] font-semibold text-slate-900">{e.school}</div>
                        <div className="text-[13.5px] text-slate-500 mt-0.5">{e.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {tutor.reviews > 0 && (
              <Section
                title={`Reviews · ${tutor.reviews}`}
                subtitle={tutor.rating ? `${tutor.rating.toFixed(1)} average from ${tutor.reviews} parents and students` : undefined}
              >
                <div className="text-[14px] text-slate-500">
                  Reviews are coming soon — we&apos;re working on a way for verified students to leave them.
                </div>
              </Section>
            )}

            {tutor.availability && (
              <Section title="Availability" subtitle="This week — times shown in your timezone">
                <AvailabilityGrid availability={tutor.availability} />
              </Section>
            )}
          </div>

          <aside className="space-y-5">
            <RateCard tutor={tutor} />
            {tutor.subjects.length > 0 && <SubjectsCard subjects={tutor.subjects} />}
            <VerificationCard />
            {(tutor.serviceArea?.suburb || tutor.suburb) && <ServiceAreaCard tutor={tutor} />}
            {similar.length > 0 && <SimilarTutorsCard similar={similar} />}
          </aside>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white p-4 z-40 flex items-center justify-between gap-3" style={{ borderTop: "1px solid #E5E7EB" }}>
        <div>
          <div className="text-[18px] font-semibold tabular-nums">
            ${tutor.rate}
            <span className="text-[13px] text-slate-400 font-normal">/hr</span>
          </div>
          <div className="text-[11.5px] text-slate-500">First lesson free</div>
        </div>
        <SaveButton tutorId={tutor.id} variant="primary" size="lg" />
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
  return (
    <section id={id} className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 24 }}>
      <div className="mb-5">
        <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <div className="text-[13px] text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

function SubjectsCard({ subjects }) {
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">Subjects</div>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s, i) => (
          <Chip key={i} tone="cream" icon="graduation">{s}</Chip>
        ))}
      </div>
    </div>
  );
}

function VerificationCard() {
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[14px] font-semibold text-slate-900">Verification</div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider"
          style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 999, color: "#64748B" }}
        >
          Coming soon
        </span>
      </div>
      <div className="text-[13px] text-slate-500 leading-[1.5] flex items-center gap-2">
        <Icon name="shield" size={14} className="text-slate-400 shrink-0" />
        Identity &amp; credential checks are coming soon.
      </div>
    </div>
  );
}

function ServiceAreaCard({ tutor }) {
  const sa = tutor.serviceArea;
  const radiusKm = sa?.radiusKm ?? 10;
  const hasCoords = Number.isFinite(sa?.lat) && Number.isFinite(sa?.lng);
  return (
    <div className="bg-white overflow-hidden" style={{ border: "1px solid #E5E7EB", borderRadius: 16 }}>
      <div className="px-5 pt-5 pb-5">
        <div className="text-[14px] font-semibold text-slate-900">Service area</div>
        <div className="text-[12.5px] text-slate-500 mt-0.5">In-person within {radiusKm} km of {sa?.suburb || tutor.suburb}</div>
      </div>
      {hasCoords && (
        <div className="px-5 pb-5">
          <ServiceAreaMap lat={sa.lat} lng={sa.lng} radiusKm={radiusKm} />
        </div>
      )}
    </div>
  );
}

function SimilarTutorsCard({ similar }) {
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">Similar tutors</div>
      <ul className="space-y-4">
        {similar.map((t) => (
          <li key={t.id}>
            <Link href={`/tutor/${t.slug}`} className="flex items-center gap-3 cursor-pointer group">
              <Avatar tutor={t} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[13.5px] font-medium text-slate-900 group-hover:underline truncate">
                  {t.name} {t.verified && <VerifiedTick size={11} />}
                </div>
                <div className="text-[12px] text-slate-500 truncate">{t.subjects?.slice(0, 2).join(" · ")}</div>
              </div>
              <div className="text-[12.5px] font-medium text-slate-900 tabular-nums whitespace-nowrap">
                ${t.rate}
                <span className="text-slate-400 font-normal">/hr</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AvailabilityGrid({ availability }) {
  const { hours, days, grid } = availability;
  const colorFor = (v) => {
    if (v === 0) return { bg: "#F8FAFC", color: "#CBD5E1", label: "—" };
    if (v === 1) return { bg: "#F0FDF4", color: "#10B981", label: "Free" };
    return { bg: "#F3F4F6", color: "#94A3B8", label: "Booked" };
  };
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" style={{ borderCollapse: "separate", borderSpacing: 4 }}>
          <thead>
            <tr>
              <th className="text-left text-slate-400 font-normal" style={{ width: 50 }}></th>
              {days.map((d) => (
                <th key={d} className="text-center text-slate-500 font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h, hi) => (
              <tr key={h}>
                <td className="text-slate-400 tabular-nums pr-2 text-right">{h}</td>
                {days.map((_, di) => {
                  const v = grid[hi]?.[di] ?? 0;
                  const c = colorFor(v);
                  return (
                    <td key={di}>
                      <div
                        className="h-8 rounded-md flex items-center justify-center font-medium"
                        style={{ background: c.bg, color: c.color }}
                        title={c.label}
                      >
                        {v === 1 && <Icon name="check" size={12} strokeWidth={2.5} />}
                        {v === 2 && <Icon name="x" size={11} strokeWidth={2.5} />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-4 text-[12px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }} /> Free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: "#F3F4F6" }} /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ background: "#F8FAFC" }} /> Unavailable
        </span>
      </div>
    </div>
  );
}
