import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { subjectLabel } from "@/lib/subjects";
import { SectionReveal } from "@/components/anim/SectionReveal";
import ServiceAreaMap from "./ServiceAreaMap";

// Shared profile card chrome — used by the public profile page (server) and the
// owner inline-editing shell (OwnerProfile, client) so both render identically.

export function formatDelivery(tutor) {
  const parts = [];
  if (tutor.deliversInPerson) parts.push("In-person");
  if (tutor.deliversOnline) parts.push("online");
  if (parts.length === 0) return null;
  return parts.join(" + ");
}

// Build the credential tiles shown in the Credentials card from the stored
// `credentials` array (ATAR is bridged in as icon="atar" upstream).
export function buildCredentialTiles(credentials) {
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
  for (const [i, c] of (credentials ?? []).entries()) {
    const label = typeof c === "string" ? c : c.label;
    if (!label) continue;
    const icon = (typeof c === "string" ? null : c.icon) || "trophy";
    const meta = metaForIcon(icon);
    tiles.push({ key: `cred-${i}`, caption: meta.caption, value: label, icon, kind: meta.kind });
  }
  return tiles;
}

export function Section({ title, subtitle, children, id }) {
  // The whole card fades in together via SectionReveal — no per-element typing.
  return (
    <SectionReveal
      as="section"
      id={id}
      hover
      className="paper-page bg-[color:var(--paper-card)]"
      style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 24, boxShadow: "var(--card-shadow)" }}
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

export function SubjectsCard({ subjects }) {
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22, boxShadow: "var(--card-shadow)" }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">Subjects</div>
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <Chip key={s.slug} tone="cream" icon="graduation">{subjectLabel(s)}</Chip>
        ))}
      </div>
    </SectionReveal>
  );
}

export function RatingsCard() {
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22, boxShadow: "var(--card-shadow)" }}>
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

export function ServiceAreaCard({ tutor }) {
  const sa = tutor.serviceArea;
  const radiusKm = sa?.radiusKm ?? 10;
  const hasCoords = Number.isFinite(sa?.lat) && Number.isFinite(sa?.lng);
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)] overflow-hidden" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", boxShadow: "var(--card-shadow)" }}>
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
