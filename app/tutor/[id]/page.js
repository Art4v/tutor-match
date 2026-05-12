"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { getTutor, TUTORS } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, OnlineDot, Chip, Button } from "@/components/ui";
import { useSaved } from "@/components/SavedContext";

export default function ProfilePage({ params }) {
  const tutor = getTutor(params.id);
  if (!tutor) return notFound();

  const router = useRouter();
  const { savedIds, toggleSave } = useSaved();
  const saved = savedIds.includes(tutor.id);
  const [tab, setTab] = useState("about");

  const onMessage = () => router.push(`/messages?tutor=${tutor.id}`);

  return (
    <div className="bg-white">
      <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-24">
        <div className="flex items-center gap-1.5 text-[12.5px] text-slate-500 mb-4">
          <Link href="/" className="hover:text-slate-900">Home</Link>
          <Icon name="chevron-right" size={12} />
          <Link href="/browse" className="hover:text-slate-900">Tutors</Link>
          <Icon name="chevron-right" size={12} />
          <span className="text-slate-700">{tutor.name}</span>
        </div>

        <div className="relative bg-white overflow-hidden" style={{ border: "1px solid #E5E7EB", borderRadius: 16 }}>
          <div
            style={{
              height: 140,
              background: `linear-gradient(135deg, ${tutor.avatarBg}, oklch(0.96 0.01 250))`,
            }}
          />
          <div className="px-7 pb-7" style={{ marginTop: -54 }}>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <Avatar tutor={tutor} size={108} ring />
              <div className="flex items-center gap-2 mb-1">
                <Button variant="outline" size="md" icon={saved ? "bookmark-fill" : "bookmark"} onClick={() => toggleSave(tutor.id)}>
                  {saved ? "Saved" : "Save"}
                </Button>
                <Button variant="outline" size="md" icon="more"></Button>
                <Button variant="primary" size="md" icon="message" onClick={onMessage}>
                  Message {tutor.name.split(" ")[0]}
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">{tutor.name}</h1>
                {tutor.verified && <VerifiedTick size={18} />}
              </div>
              <div className="text-[15px] text-slate-600 mt-1">{tutor.role}</div>
              <div className="flex items-center gap-4 text-[13.5px] text-slate-500 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Icon name="map-pin" size={13} />
                  {tutor.location || `${tutor.suburb}, ${tutor.city}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="globe" size={13} /> In-person + online
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />
                  {tutor.responsive}
                </span>
                {tutor.online && (
                  <span className="flex items-center gap-1.5">
                    <OnlineDot size={7} />
                    <span className="text-slate-700">Online now</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4">
                {tutor.credentials?.map((c) => (
                  <Chip key={c} tone="cream" icon={c.includes("ATAR") ? "graduation" : "trophy"}>{c}</Chip>
                ))}
              </div>

              <div className="flex items-center gap-5 mt-5 text-[13px] text-slate-500 pt-5 flex-wrap" style={{ borderTop: "1px solid #F1F5F9" }}>
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Icon name="star" size={13} className="text-slate-700" />
                  <span className="text-slate-900 font-medium">{tutor.rating?.toFixed(1)}</span>
                  · {tutor.reviews} reviews
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="users" size={13} />
                  <span className="text-slate-900 font-medium">40+</span>
                  <span>students taught</span>
                </span>
                {tutor.yearsTutoring && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="clock" size={13} />
                    <span className="text-slate-900 font-medium">{tutor.yearsTutoring} yrs</span>
                    <span>tutoring</span>
                  </span>
                )}
                {tutor.languages && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="language" size={13} />
                    {tutor.languages.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-[60px] z-20 bg-white mt-2 pt-2" style={{ borderBottom: "1px solid #E5E7EB" }}>
          <div className="flex gap-1">
            {[
              { id: "about", label: "About" },
              { id: "experience", label: "Experience" },
              { id: "reviews", label: `Reviews · ${tutor.reviews}` },
              { id: "availability", label: "Availability" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 pb-3 pt-2 text-[13.5px] font-medium transition-colors"
                style={{
                  color: tab === t.id ? "#0F172A" : "#64748B",
                  borderBottom: tab === t.id ? "2px solid #0F172A" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-8">
          <div className="space-y-8 min-w-0">
            <Section id="about" title="About">
              <div className="text-[15px] text-slate-600 leading-[1.6] whitespace-pre-line">
                {tutor.bioLong || tutor.bio}
              </div>
            </Section>

            <Section title="Credentials" subtitle="What sets this tutor apart">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "ATAR", value: tutor.atar.toFixed(2), icon: "graduation" },
                  { label: "Rank", value: "State", icon: "trophy", sub: "Maths Ext 2" },
                  { label: "Rating", value: tutor.rating?.toFixed(1), icon: "star", sub: `${tutor.reviews} reviews` },
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

            {tutor.experience && (
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

            {tutor.education && (
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

            {tutor.reviewsList && (
              <Section title={`Reviews · ${tutor.reviews}`} subtitle={`${tutor.rating?.toFixed(1)} average from ${tutor.reviews} parents and students`}>
                <ReviewsList reviews={tutor.reviewsList} />
              </Section>
            )}

            {tutor.availability && (
              <Section title="Availability" subtitle="This week — times shown in your timezone">
                <AvailabilityGrid availability={tutor.availability} />
              </Section>
            )}
          </div>

          <aside className="space-y-5">
            <RateCard tutor={tutor} onMessage={onMessage} />
            {tutor.verifications && <VerificationCard verifications={tutor.verifications} />}
            <ServiceAreaCard tutor={tutor} />
            <SimilarTutorsCard currentId={tutor.id} />
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
        <Button variant="primary" size="lg" icon="message" onClick={onMessage}>
          Message {tutor.name.split(" ")[0]}
        </Button>
      </div>
    </div>
  );
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

function RateCard({ tutor, onMessage }) {
  const [pkg, setPkg] = useState(0);
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="flex items-baseline gap-1">
        <span className="text-[34px] font-semibold text-slate-900 tabular-nums tracking-tight">${tutor.rate}</span>
        <span className="text-[14px] text-slate-400">/hour</span>
      </div>
      <div className="text-[12.5px] text-slate-500 mt-1">60-minute lesson · first 20 min free</div>

      {tutor.packages && (
        <div className="mt-5 space-y-2">
          {tutor.packages.map((p, i) => (
            <button
              key={i}
              onClick={() => setPkg(i)}
              className="w-full flex items-center justify-between p-3 text-left transition-colors"
              style={{
                border: `1px solid ${pkg === i ? "#0F172A" : "#E5E7EB"}`,
                borderRadius: 10,
                background: pkg === i ? "#F8FAFC" : "#fff",
              }}
            >
              <div>
                <div className="text-[13.5px] font-medium text-slate-900">{p.label}</div>
                <div className="text-[11.5px] text-slate-500">
                  {p.duration}
                  {p.save ? ` · ${p.save}` : ""}
                </div>
              </div>
              <div className="text-[15px] font-semibold tabular-nums text-slate-900">${p.price}</div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2">
        <Button variant="primary" size="lg" icon="message" full onClick={onMessage}>
          Message {tutor.name.split(" ")[0]}
        </Button>
        <Button variant="outline" size="lg" icon="calendar" full>Request a lesson</Button>
      </div>

      <div className="mt-4 pt-4 flex items-center gap-2 text-[12px] text-slate-500" style={{ borderTop: "1px solid #F1F5F9" }}>
        <Icon name="shield" size={13} />
        Payment held by tutormatch until lesson is confirmed
      </div>
    </div>
  );
}

function VerificationCard({ verifications }) {
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">Verification</div>
      <ul className="space-y-3">
        {verifications.map((v, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="text-slate-700 flex items-center gap-2">
              <Icon
                name={["identity", "mobile", "ATAR", "Children", "References"].some((k) => v.label.includes(k)) ? "shield-check" : "check-circle"}
                size={14}
                className="text-slate-400"
              />
              {v.label}
            </span>
            {v.done && <VerifiedTick size={13} />}
          </li>
        ))}
      </ul>
      <button className="w-full mt-4 text-[12.5px] text-slate-500 hover:text-slate-900 inline-flex items-center justify-center gap-1">
        How verification works <Icon name="arrow-up-right" size={11} />
      </button>
    </div>
  );
}

function ServiceAreaCard({ tutor }) {
  return (
    <div className="bg-white overflow-hidden" style={{ border: "1px solid #E5E7EB", borderRadius: 16 }}>
      <div className="px-5 pt-5">
        <div className="text-[14px] font-semibold text-slate-900">Service area</div>
        <div className="text-[12.5px] text-slate-500 mt-0.5">In-person within 10 km of {tutor.suburb}</div>
      </div>
      <div className="mt-4 relative" style={{ height: 200, background: "#F3F4F6" }}>
        <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
          <g stroke="#E5E7EB" strokeWidth="1" fill="none">
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={"h" + i} x1="0" y1={i * 25} x2="400" y2={i * 25} />
            ))}
            {Array.from({ length: 17 }).map((_, i) => (
              <line key={"v" + i} x1={i * 25} y1="0" x2={i * 25} y2="200" />
            ))}
          </g>
          <g stroke="#D1D5DB" strokeWidth="2.5" fill="none">
            <line x1="0" y1="75" x2="400" y2="75" />
            <line x1="0" y1="135" x2="400" y2="135" />
            <line x1="125" y1="0" x2="125" y2="200" />
            <line x1="275" y1="0" x2="275" y2="200" />
          </g>
          <rect x="60" y="20" width="55" height="45" fill="#E2E8F0" rx="3" />
          <rect x="290" y="145" width="80" height="40" fill="#E2E8F0" rx="3" />
          <circle cx="200" cy="100" r="68" fill="#0F172A" fillOpacity="0.06" stroke="#0F172A" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
          <g transform="translate(200 100)">
            <circle r="6" fill="#0F172A" />
            <circle r="14" fill="#0F172A" fillOpacity="0.12" />
          </g>
        </svg>
        <div className="absolute bottom-3 right-3 text-[10.5px] text-slate-500 bg-white/90 px-2 py-1 rounded" style={{ border: "1px solid #E5E7EB" }}>
          Map data · approximate
        </div>
      </div>
    </div>
  );
}

function SimilarTutorsCard({ currentId }) {
  const similar = TUTORS.filter((t) => t.id !== currentId).slice(0, 3);
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">Similar tutors</div>
      <ul className="space-y-4">
        {similar.map((t) => (
          <li key={t.id}>
            <Link href={`/tutor/${t.id}`} className="flex items-center gap-3 cursor-pointer group">
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

function ReviewsList({ reviews }) {
  return (
    <ul className="space-y-5">
      {reviews.map((r, i) => (
        <li key={i} className="pb-5" style={{ borderBottom: i < reviews.length - 1 ? "1px solid #F1F5F9" : "none" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-medium text-slate-700"
              style={{ background: `oklch(0.94 0.01 ${(i * 70) % 360})` }}
            >
              {r.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-medium text-slate-900">{r.name}</div>
              <div className="text-[12px] text-slate-500">{r.role} · {r.date}</div>
            </div>
            <div className="flex items-center gap-1 text-[12.5px] text-slate-700 tabular-nums">
              <Icon name="star" size={12} />
              5.0
            </div>
          </div>
          <p className="text-[14px] text-slate-700 leading-[1.6] mt-3">{r.body}</p>
        </li>
      ))}
    </ul>
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
                  const v = grid[hi][di];
                  const c = colorFor(v);
                  return (
                    <td key={di}>
                      <div
                        className="h-8 rounded-md flex items-center justify-center font-medium transition-colors cursor-pointer hover:ring-1 hover:ring-slate-300"
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
