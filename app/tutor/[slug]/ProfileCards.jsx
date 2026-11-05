import { Icon } from "@/components/Icon";
import { subjectLabel } from "@/lib/subjects";
import ServiceAreaMap from "./ServiceAreaMap";

// Shared profile section chrome, used by the public profile page (server) and
// the owner inline-editing shell (OwnerProfile, client) so both render
// identically. DESIGN.md §6 "Section": a 20px/600 heading, the content, then a
// rule before the next section. No cards, no shadows, no icons beside headings.
//
// The export names below (`Section`, `SidebarCard`, `SidebarHeading`,
// `SubjectsCard`, `DocumentationCard`, `ServiceAreaCard`, `cardStyle`, …) are
// kept from the card era because OwnerProfile, OwnerCompany and several other
// screens import them. The "Card" suffix is historical: they are flat sections.

// The style for the few static containers that remain (the contact column, some
// admin and blog panels that import it): a 1px rule and a 4px radius, never a
// shadow (DESIGN.md §4).
export const cardStyle = {
  border: "1px solid var(--rule)",
  borderRadius: "var(--radius)",
};

// The profile's right-hand contact column (rate, packages, Message / Enquire).
// From 1024px up it is the one bordered box on the page and sticks under the
// nav; below that it sits inline under the header as a plain ruled block.
export const contactColumnClass =
  "border-b border-rule pb-6 lg:border lg:rounded lg:p-6";

/** "In person and online" / "In person" / "Online", from the tutor's real modes. */
export function formatDelivery(tutor) {
  const inPerson = !!tutor.deliversInPerson;
  const online = !!tutor.deliversOnline;
  if (inPerson && online) return "In person and online";
  if (inPerson) return "In person";
  if (online) return "Online";
  return null;
}

// Build the credential rows shown in the Credentials section from the stored
// `credentials` array (ATAR is bridged in as icon="atar" upstream). Captions are
// sentence case (DESIGN.md: no uppercase labels).
export function buildCredentialTiles(credentials) {
  const metaForIcon = (icon) => {
    switch (icon) {
      case "atar":        return { caption: "ATAR",       kind: "stat" };
      case "graduation":  return { caption: "Degree",     kind: "credential" };
      case "check-badge": return { caption: "State rank", kind: "credential" };
      case "star":        return { caption: "Highlight",  kind: "credential" };
      case "trophy":      return { caption: "Award",      kind: "credential" };
      default:            return { caption: "Credential", kind: "credential" };
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

/** A profile section: 20px/600 heading, optional one-line subtitle, content, rule. */
export function Section({ title, subtitle, children, id }) {
  return (
    <section id={id} className="border-b border-rule py-6">
      <div className="mb-4">
        <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{title}</h2>
        {subtitle && <p className="text-[14px] leading-5 text-[color:var(--text-2)] mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Kept for the callers that still import it (OwnerCompany, CompanyLocationCard).
 * Same flat section as `Section`; the content follows the subtitle directly.
 */
export function SidebarCard({ title, subtitle, children }) {
  return (
    <section className="border-b border-rule py-6">
      <SidebarHeading>{title}</SidebarHeading>
      {subtitle && <p className="text-[14px] leading-5 text-[color:var(--text-2)] mt-1">{subtitle}</p>}
      {children}
    </section>
  );
}

export function SidebarHeading({ children }) {
  return <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{children}</h2>;
}

/** Subjects as a plain list in up to three columns (DESIGN.md: no chips). */
export function SubjectsCard({ subjects }) {
  return (
    <Section title="Subjects">
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[16px] leading-6 text-[color:var(--text)]">
        {subjects.map((s) => (
          <li key={s.slug} className="break-words">{subjectLabel(s)}</li>
        ))}
      </ul>
    </Section>
  );
}

// Public documents the tutor has shared: rows are [{ id, title, path, url }]
// from listTutorDocs (`tutor_documents`, migration 0034). Each opens the public
// file in a new tab; the tutor-chosen title is the label, never the raw
// filename. A plain ruled list of links.
export function DocumentationCard({ docs }) {
  return (
    <Section title="Documents" subtitle="Shared by the tutor to back up their credentials.">
      <ul className="border-t border-rule">
        {docs.map((doc) => (
          <li key={doc.id} className="border-b border-rule">
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-2 py-3 text-[14px] leading-5 text-accent hover:text-accent-hover"
              style={{ transition: "color 120ms ease-out" }}
            >
              <span className="min-w-0 flex-1 break-words">{doc.title}</span>
              <span className="shrink-0 text-[12px] leading-4 text-[color:var(--muted)]">
                {(doc.path ?? "").toLowerCase().endsWith(".pdf") ? "PDF" : "Image"}
              </span>
              <Icon name="external" size={16} className="shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// Where the tutor teaches in person, with the radius map when the suburb was
// geocoded. A tutor who does not teach in person shows only where they are
// based, with no radius claim and no circle.
export function ServiceAreaCard({ tutor }) {
  const sa = tutor.serviceArea;
  const radiusKm = sa?.radiusKm ?? 10;
  const place = sa?.suburb || tutor.suburb;
  const hasCoords = Number.isFinite(sa?.lat) && Number.isFinite(sa?.lng);
  const inPerson = tutor.deliversInPerson !== false;
  return (
    <Section
      title="Location"
      subtitle={inPerson ? `In person within ${radiusKm} km of ${place}` : `Based in ${place}`}
    >
      {inPerson && hasCoords && <ServiceAreaMap lat={sa.lat} lng={sa.lng} radiusKm={radiusKm} height={280} />}
    </Section>
  );
}
