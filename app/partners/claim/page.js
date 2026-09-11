import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyPartnerInviteToken } from "@/lib/partnerToken";
import { getPartnerForClaim } from "@/lib/supabase/partners";
import { ClaimPanel } from "./ClaimPanel";

export const metadata = { title: "Claim your centre" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing page for the partner invite link. The signed token in ?token= is the
// authorization, so this page is deliberately login-unguarded, exactly like
// /admin/verify. A GET never mutates: the claim is a POST behind a button, so
// an email client prefetching the link cannot silently bind the partner to
// whoever happens to be signed in.
export default async function ClaimPartnerPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { partnerId, error } = verifyPartnerInviteToken(token);

  if (error) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Link invalid or expired"
          body="This invite link can't be used. Get in touch and we'll send you a fresh one."
        />
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Server not configured"
          body="Claiming needs SUPABASE_SERVICE_ROLE_KEY set on the server."
        />
      </Shell>
    );
  }

  // Read through the service role: the visitor is usually logged out or brand
  // new, and a hidden partner still needs its claim page to work.
  const partner = await getPartnerForClaim(admin, partnerId);
  if (!partner) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Centre not found"
          body="This listing may have been removed. Get in touch if you think that's a mistake."
        />
      </Shell>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already claimed. If it's the caller's own, just take them to it — a partner
  // re-opening their original email should land somewhere useful, not on an
  // error.
  if (partner.claimed) {
    const { data: mine } = await supabase
      .from("partners")
      .select("slug")
      .eq("id", partner.id)
      .maybeSingle();
    if (mine?.slug) redirect(`/partners/${mine.slug}`);
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title={`${partner.name} has already been claimed`}
          body="Someone at your centre has already set this page up. Ask them to add you, or get in touch if you think this is wrong."
        />
      </Shell>
    );
  }

  const next = `/partners/claim?token=${encodeURIComponent(token)}`;

  // Logged out: send them through signup or login, carrying the claim URL so
  // they come straight back here afterwards.
  if (!user) {
    return (
      <Shell>
        <Card partnerName={partner.name}>
          <p className="text-[13.5px] text-slate-500 mt-4 mb-5 leading-[1.55]">
            Create an account (or sign in) and this page becomes yours to edit. It's already
            live, so nothing goes dark while you set up.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="inline-flex items-center justify-center text-[14px] font-medium"
              style={{ background: "var(--accent)", color: "#fff", borderRadius: 999, padding: "11px 22px" }}
            >
              Create an account
            </a>
            <a
              href={`/login?next=${encodeURIComponent(next)}`}
              className="inline-flex items-center justify-center text-[14px] font-medium"
              style={{ border: "1px solid var(--paper-line)", color: "var(--ink-graphite)", borderRadius: 999, padding: "11px 22px" }}
            >
              I already have one
            </a>
          </div>
        </Card>
      </Shell>
    );
  }

  // Signed in, but as a tutor or a student. Those accounts already have an
  // extension row and a public identity built on it, so they can't also be a
  // centre — claim_partner() raises on this too, but saying so here is kinder
  // than letting them press the button and read an exception.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? null;

  if (role && role !== "partner") {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="You're signed in as a different kind of account"
          body={`This is a ${role} account, which can't also manage a centre. Log out and create a separate account for ${partner.name}.`}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Card partnerName={partner.name}>
        <p className="text-[13.5px] text-slate-500 mt-4 mb-5 leading-[1.55]">
          Claiming links {partner.name} to this account. You'll be able to edit the page,
          set your rates and add your tutors straight away.
        </p>
        <ClaimPanel token={token} partnerName={partner.name} />
      </Card>
    </Shell>
  );
}

function Card({ partnerName, children }) {
  return (
    <section
      className="bg-[color:var(--paper-card)]"
      style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}
    >
      <span
        className="inline-flex items-center justify-center mb-4"
        style={{ width: 44, height: 44, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}
      >
        <Icon name="building" size={22} />
      </span>
      <h1
        className="text-[30px] leading-none"
        style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
      >
        Claim {partnerName}
      </h1>
      <p className="text-[14px] text-slate-500 mt-1.5">Your page on MatchTutor is ready.</p>
      {children}
    </section>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className="max-w-[520px] mx-auto px-6 pt-16 pb-24">{children}</div>
    </div>
  );
}

function StateCard({ tone, icon, title, body }) {
  const colors =
    { ok: { bg: "var(--accent-softer)", fg: "var(--accent)" }, error: { bg: "#FEF2F2", fg: "#DC2626" } }[tone] ||
    { bg: "var(--desk)", fg: "var(--ink-muted)" };
  return (
    <section
      className="bg-[color:var(--paper-card)]"
      style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}
    >
      <span
        className="inline-flex items-center justify-center mb-4"
        style={{ width: 44, height: 44, borderRadius: 999, background: colors.bg, color: colors.fg }}
      >
        <Icon name={icon} size={22} />
      </span>
      <h1
        className="text-[30px] leading-none"
        style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
      >
        {title}
      </h1>
      <p className="text-[14px] text-slate-500 mt-1.5 leading-[1.55]">{body}</p>
    </section>
  );
}
