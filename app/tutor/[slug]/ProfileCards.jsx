import { Icon } from "@/components/Icon";
import { subjectLabel } from "@/lib/subjects";
import ServiceAreaMap from "./ServiceAreaMap";

// Shared profile chrome, used by the public profile page (server) and the
// owner inline-editing shell (OwnerProfile, client) so both render identically.
//
// The page is SECTIONS, not cards: a heading, the content, and a 1px rule
// before the next section. No box, no shadow. The exported names keep their
// historical "Card" suffix (SubjectsCard, ServiceAreaCard, ...) because the
// owner editor and company pages import them; they are flat sections.
//
// `cardStyle` survives only for the few things that must stand apart (the
// contact column from lg up, and a handful of boxes elsewhere): a 1px rule
// border and 4px corners, never a shadow. Shadows are for things that float.
export const cardStyle = {
  border: "1px solid var(--paper-line)",
  borderRadius: 4,
};

// The profile's contact column (rate, packages, Message or Enquire). Below lg
// it is a section with a bottom rule; from lg it is the one bordered box on the
// page. Literal classes for Tailwind's scanner.
export const contactColumnClass =
  "border-b border-[color:var(--paper-line)] pb-6 lg:border lg:rounded lg:p-6";

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

// The rule under every section, as a class so the few sections that are not
// built from <Section> (AboutCard, ReviewsCard) share it exactly.
export const sectionClass = "border-b border-[color:var(--paper-line)] py-6";

/** Main-column section: 22px light heading, content, then a rule. No icons. */
export function Section({ title, subtitle, children, id }) {
  return (
    <section id={id} className={sectionClass}>
      <div className="mb-4">
        <h2 className="text-[22px] font-light text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <div className="text-[14px] text-slate-500 mt-1">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

/** Sidebar section: same as Section with a smaller heading. */
export function SidebarCard({ title, subtitle, children }) {
  return (
    <section className={sectionClass}>
      <SidebarHeading>{title}</SidebarHeading>
      {subtitle && <div className="text-[14px] mt-1" style={{ color: "var(--sage)" }}>{subtitle}</div>}
      {children}
    </section>
  );
}

export function SidebarHeading({ children }) {
  return <h2 className="text-[19px] font-light text-slate-800 tracking-tight">{children}</h2>;
}

// Text, not chips: a plain comma-separated list.
export function SubjectsCard({ subjects }) {
  return (
    <SidebarCard title="Subjects">
      <p className="text-[14px] leading-6 mt-3 [overflow-wrap:anywhere]" style={{ color: "var(--ink-muted)" }}>
        {subjects.map(subjectLabel).join(", ")}
      </p>
    </SidebarCard>
  );
}

// Public documents the tutor has shared — rows are [{ id, title, path, url }]
// from listTutorDocs (`tutor_documents`, migration 0034). Each opens the
// public file in a new tab; the tutor-chosen title is the label, never the
// raw filename.
export function DocumentationCard({ docs }) {
  return (
    <SidebarCard title="Documentation" subtitle="Documents shared to back up this tutor's credentials.">
      <ul className="space-y-1.5 mt-3">
        {docs.map((doc) => (
          <li key={doc.id}>
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-2.5 py-2 text-[13px] transition-colors hover:bg-slate-100"
              style={{ background: "var(--bg-soft)", borderRadius: 8, color: "var(--ink)" }}
            >
              <Icon name={doc.path.toLowerCase().endsWith(".pdf") ? "file-text" : "image"} size={13} className="shrink-0 text-slate-400" />
              <span className="flex-1 min-w-0 truncate">{doc.title}</span>
              <Icon name="external" size={12} className="shrink-0 text-slate-400" />
            </a>
          </li>
        ))}
      </ul>
    </SidebarCard>
  );
}

// RatingsCard (the "Coming soon" placeholder) was replaced by the real
// ReviewsCard in 0057's slice — see ./ReviewsCard.jsx.

export function ServiceAreaCard({ tutor }) {
  const sa = tutor.serviceArea;
  const radiusKm = sa?.radiusKm ?? 10;
  const hasCoords = Number.isFinite(sa?.lat) && Number.isFinite(sa?.lng);
  return (
    <SidebarCard
      title="Service area"
      subtitle={`In-person within ${radiusKm} km of ${sa?.suburb || tutor.suburb}`}
    >
      {hasCoords && (
        <div
          className="mt-3 overflow-hidden"
          style={{ borderRadius: 11, border: "1px solid var(--line)" }}
        >
          <ServiceAreaMap lat={sa.lat} lng={sa.lng} radiusKm={radiusKm} />
        </div>
      )}
    </SidebarCard>
  );
}
