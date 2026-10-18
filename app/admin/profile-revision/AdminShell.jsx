import { Icon } from "@/components/Icon";

// Page chrome shared by /admin/profile-revision and its preview's error states.
// Same look as the /admin/review and /admin/verify cards.
export function Shell({ children, wide = false }) {
  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className={`${wide ? "max-w-[760px]" : "max-w-[520px]"} mx-auto px-6 pt-16 pb-24`}>{children}</div>
    </div>
  );
}

export function StateCard({ tone, icon, title, body, profileHref }) {
  const colors = {
    ok: { bg: "var(--accent-softer)", fg: "var(--accent)" },
    error: { bg: "#FEF2F2", fg: "#DC2626" },
  }[tone] || { bg: "var(--desk)", fg: "var(--ink-muted)" };
  return (
    <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}>
      <span className="inline-flex items-center justify-center mb-4" style={{ width: 44, height: 44, borderRadius: 999, background: colors.bg, color: colors.fg }}>
        <Icon name={icon} size={22} />
      </span>
      <h1 className="text-[30px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>{title}</h1>
      <p className="text-[14px] text-slate-500 mt-1.5 leading-[1.55]">{body}</p>
      {profileHref && (
        <a href={profileHref} className="inline-flex items-center gap-1.5 text-[13.5px] mt-4" style={{ color: "var(--accent)" }}>
          View profile <Icon name="arrow-right" size={14} />
        </a>
      )}
    </section>
  );
}

// Why a token didn't resolve, in words the admin can act on.
export function tokenErrorCard(error) {
  return error === "expired"
    ? { title: "Link expired", body: "This link has expired. Ask the tutor to resend it from their profile." }
    : { title: "Link invalid", body: "This review link can't be used. Ask the tutor to resend it from their profile." };
}
