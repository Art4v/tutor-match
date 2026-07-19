import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { subjectLabel } from "@/lib/subjects";
import ServiceAreaMap from "./ServiceAreaMap";

// Shared profile card chrome — used by the public profile page (server) and the
// owner inline-editing shell (OwnerProfile, client) so both render identically.
// Cards are flat: a 1px hairline border does the separating, no shadow.

// Card shells. Main-column and sidebar cards differ only in padding and in the
// size of their heading, so both live here and every card picks one.
export const cardStyle = {
  border: "1px solid var(--paper-line)",
  borderRadius: "var(--radius-card)",
};

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

/** Main-column section card: 20px/24px padding, 22px heading. */
export function Section({ title, subtitle, children, id }) {
  return (
    <section
      id={id}
      className="bg-[color:var(--paper-card)]"
      style={{ ...cardStyle, padding: "20px 24px" }}
    >
      <div className="mb-4">
        <h2 className="text-[22px] font-light text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <div className="text-[13px] text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

/** Sidebar card: 18px/20px padding, 19px heading. */
export function SidebarCard({ title, subtitle, children }) {
  return (
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      <SidebarHeading>{title}</SidebarHeading>
      {subtitle && <div className="text-[13.5px] mt-0.5" style={{ color: "var(--sage)" }}>{subtitle}</div>}
      {children}
    </div>
  );
}

export function SidebarHeading({ children }) {
  return <h2 className="text-[19px] font-light text-slate-800 tracking-tight">{children}</h2>;
}

export function SubjectsCard({ subjects }) {
  return (
    <SidebarCard title="Subjects">
      <div className="flex flex-wrap gap-1.5 mt-3">
        {subjects.map((s) => (
          <Chip key={s.slug} tone="pill" size="sm" icon="graduation">{subjectLabel(s)}</Chip>
        ))}
      </div>
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

export function RatingsCard() {
  return (
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      <div className="flex items-center justify-between gap-3">
        <SidebarHeading>Ratings &amp; reviews</SidebarHeading>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider shrink-0"
          style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 999, color: "var(--ink-muted)" }}
        >
          Coming soon
        </span>
      </div>
      <div className="flex flex-col items-center text-center py-6">
        <div className="flex items-center gap-1.5 mb-3" style={{ color: "var(--accent-line)" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Icon key={i} name="star" size={20} />
          ))}
        </div>
        <div className="text-[13.5px] leading-[1.55] max-w-[260px]" style={{ color: "var(--sage)" }}>
          Ratings and reviews are coming soon, we&apos;re working on a way for verified students to leave them.
        </div>
      </div>
    </div>
  );
}

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
