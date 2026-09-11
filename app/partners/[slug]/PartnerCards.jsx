import { Icon } from "@/components/Icon";
import { parseRichTextBlocks, RichTextBlock } from "@/components/RichText";
import { cardStyle, SidebarCard } from "@/app/tutor/[slug]/ProfileCards";

// Shared partner card chrome, used by BOTH the public page (server) and the
// owner inline-editing shell (OwnerPartner, client) so the two cannot drift.
// Same arrangement, and same reason, as app/tutor/[slug]/ProfileCards.jsx.
//
// These are all server-safe (no hooks, no event handlers) so the public page
// stays a server component.

/**
 * The one contact route a partner has. Centres cannot be messaged on
 * MatchTutor: `start_conversation()` only accepts a student caller and a
 * tutor_profiles target, so a partner is structurally unmessageable and this
 * button is the deliberate replacement, not a fallback.
 *
 * Renders nothing without a website — better no button than a dead one.
 */
export function EnquireButton({ partner, full = true }) {
  if (!partner.websiteUrl) return null;
  return (
    <a
      href={partner.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-center justify-center gap-1.5 text-[14px] font-medium transition-opacity hover:opacity-90 " +
        (full ? "w-full" : "")
      }
      style={{ background: "var(--accent)", color: "#fff", borderRadius: 999, padding: "12px 22px" }}
    >
      Enquire at {partner.name}
      <Icon name="external" size={14} />
    </a>
  );
}

export function PartnerHeaderCard({ partner }) {
  const location = [partner.suburb, partner.city].filter(Boolean).join(", ");
  return (
    <div className="relative bg-[color:var(--paper-card)] overflow-hidden" style={cardStyle}>
      <div
        style={{
          height: 150,
          background: partner.bannerImg
            ? `url(${partner.bannerImg}) center / cover no-repeat`
            : `linear-gradient(135deg, ${partner.bannerBg ?? partner.avatarBg ?? "var(--accent-softer)"}, oklch(0.96 0.01 250))`,
        }}
      />
      <div className="px-7 pb-[22px]" style={{ marginTop: -54 }}>
        <PartnerLogo partner={partner} size={108} ring />
        <h1
          className="text-[34px] leading-none mt-4"
          style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
        >
          {partner.name}
        </h1>
        {partner.bio && (
          <p className="text-[15px] mt-2 max-w-[60ch]" style={{ color: "var(--sage)" }}>
            {partner.bio}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="building" size={14} /> Tutoring centre
          </span>
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="map-pin" size={14} /> {location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Logo with the same fallback ladder as components/ui.js Avatar (image →
 * colour + initial), but standalone: Avatar reads tutor-shaped keys.
 */
export function PartnerLogo({ partner, size = 108, ring = false }) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: partner.logoImg
          ? `url(${partner.logoImg}) center / cover no-repeat`
          : partner.avatarBg ?? "var(--accent-softer)",
        border: ring ? "4px solid var(--paper-card)" : undefined,
        color: "var(--accent)",
        fontSize: size * 0.38,
        fontWeight: 300,
      }}
      aria-hidden={!!partner.logoImg}
    >
      {!partner.logoImg && (partner.initial ?? "?")}
    </span>
  );
}

export function PartnerAboutCard({ partner }) {
  const blocks = parseRichTextBlocks(partner.bioLong ?? "");
  return (
    <section id="about" className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "20px 24px" }}>
      <h2 className="text-[22px] font-light text-slate-800 tracking-tight mb-4">About</h2>
      <div className="text-[15.5px] leading-[1.72] max-w-[70ch]" style={{ color: "var(--ink)" }}>
        {blocks.map((b, idx) => (
          <div key={idx} className="mb-3 last:mb-0">
            <RichTextBlock block={b} idx={idx} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The centre's one rate card. Deliberately NOT interactive the way the tutor
 * RateCard is (which tracks a selected package): there is nothing to select
 * here, since every price applies to every tutor the centre lists.
 */
export function PartnerRateCard({ partner, showEnquire = true }) {
  const packages = partner.packages ?? [];
  return (
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      {partner.fromPrice != null ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[16px]" style={{ color: "var(--sage)" }}>from</span>
            <span
              className="text-[40px] font-light tabular-nums"
              style={{ color: "var(--ink-graphite-deep)", letterSpacing: "-0.02em" }}
            >
              ${partner.fromPrice}
            </span>
          </div>
          <div className="text-[13.5px] mt-1" style={{ color: "var(--sage)" }}>
            Set by the centre, the same for every tutor here.
          </div>
        </>
      ) : (
        <div className="text-[13.5px]" style={{ color: "var(--sage)" }}>
          Contact the centre for current pricing.
        </div>
      )}

      {packages.length > 0 && (
        <div className="flex flex-col gap-[10px] mt-5">
          {packages.map((p, i) => (
            <div
              key={i}
              className="w-full flex items-center justify-between px-4 py-3.5"
              style={{
                border: "1px solid var(--accent-line)",
                borderRadius: 11,
                background: "var(--accent-softer)",
                color: "var(--ink-graphite)",
              }}
            >
              <span className="text-[14px] font-medium">{p.label}</span>
              <span className="text-[14px] font-medium tabular-nums">${p.price}</span>
            </div>
          ))}
        </div>
      )}

      {showEnquire && partner.websiteUrl && (
        <div className="mt-5">
          <EnquireButton partner={partner} />
        </div>
      )}
    </div>
  );
}

export function PartnerLocationCard({ partner }) {
  const location = [partner.suburb, partner.city].filter(Boolean).join(", ");
  return (
    <SidebarCard title="Where we are" subtitle={location || "Location not set yet."}>
      {partner.websiteUrl && (
        <a
          href={partner.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] mt-3"
          style={{ color: "var(--accent)" }}
        >
          Visit website <Icon name="external" size={13} />
        </a>
      )}
    </SidebarCard>
  );
}
