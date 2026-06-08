import { Icon } from "@/components/Icon";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyApproveToken } from "@/lib/verifyToken";
import { ApproveButton } from "./ApproveButton";

export const metadata = { title: "Approve verification — matchtutor" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing page for the approve link in the admin email. The signed token in
// ?token= is the authorization (no login). We validate it, show the tutor, and
// let the admin confirm with the Approve button — a GET never mutates, so an
// email prefetch can't auto-approve.
export default async function AdminVerifyPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { tutorId, error } = verifyApproveToken(token);

  if (error) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Link invalid or expired"
          body="This approval link can't be used. Ask the tutor to resubmit their verification request for a fresh link."
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
          body="Approvals need SUPABASE_SERVICE_ROLE_KEY set on the server."
        />
      </Shell>
    );
  }

  const { data: tutor } = await admin
    .from("tutor_profiles")
    .select("verified, slug, suburb, city, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();

  if (!tutor) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Tutor not found" body="This account may have been deleted." />
      </Shell>
    );
  }

  const name = tutor.profile?.full_name || "This tutor";
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(", ");

  if (tutor.verified) {
    return (
      <Shell>
        <StateCard
          tone="ok"
          icon="shield-check"
          title={`${name} is already verified`}
          body="No further action needed — their profile already shows the verified badge."
          profileHref={tutor.slug ? `/tutor/${tutor.slug}` : null}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 28 }}>
        <div className="flex items-start gap-3 mb-5">
          <span className="inline-flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}>
            <Icon name="shield-check" size={20} />
          </span>
          <div>
            <h1 className="font-hand text-[32px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>Approve verification</h1>
            <p className="text-[13.5px] text-slate-500 mt-1">Confirm you've reviewed this tutor's profile.</p>
          </div>
        </div>

        <div className="text-[14px]" style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 }}>
          <div className="font-semibold text-slate-900">{name}</div>
          {location && <div className="text-slate-500 text-[13px] mt-0.5">{location}</div>}
          {tutor.slug && (
            <a href={`/tutor/${tutor.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] mt-3" style={{ color: "var(--accent)" }}>
              View public profile <Icon name="external" size={13} />
            </a>
          )}
        </div>

        <p className="text-[12.5px] text-slate-500 mt-4 mb-5">
          Approving turns on their verified badge and ranks them above unverified tutors. They'll be notified by email.
        </p>

        <ApproveButton token={token} tutorName={name} profileHref={tutor.slug ? `/tutor/${tutor.slug}` : null} />
      </section>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-[520px] mx-auto px-6 pt-16 pb-24">{children}</div>
    </div>
  );
}

function StateCard({ tone, icon, title, body, profileHref }) {
  const colors = {
    ok: { bg: "var(--accent-softer)", fg: "var(--accent)" },
    error: { bg: "#FEF2F2", fg: "#DC2626" },
  }[tone] || { bg: "#F3F4F6", fg: "#64748B" };
  return (
    <section className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 28 }}>
      <span className="inline-flex items-center justify-center mb-4" style={{ width: 44, height: 44, borderRadius: 999, background: colors.bg, color: colors.fg }}>
        <Icon name={icon} size={22} />
      </span>
      <h1 className="font-hand text-[30px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>{title}</h1>
      <p className="text-[14px] text-slate-500 mt-1.5 leading-[1.55]">{body}</p>
      {profileHref && (
        <a href={profileHref} className="inline-flex items-center gap-1.5 text-[13.5px] mt-4" style={{ color: "var(--accent)" }}>
          View profile <Icon name="arrow-right" size={14} />
        </a>
      )}
    </section>
  );
}
