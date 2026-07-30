import { Icon } from "@/components/Icon";
import { StarRating } from "@/components/StarRating";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/reviewToken";
import { getReviewForModeration } from "@/lib/supabase/reviews";
import { ReviewDecision } from "./ReviewDecision";

export const metadata = { title: "Review a review" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing page for the moderation link in the admin email. The signed token in
// ?token= is the authorization (no login). We validate it, show the review, and
// let the admin confirm with the Approve button — a GET never mutates, so an
// email prefetch can't auto-publish. Mirrors /admin/verify.
const DECIDED = {
  approved: "already approved and is live on the tutor's profile",
  rejected: "already rejected",
  removed: "been removed after a report, which is final",
};

export default async function AdminReviewPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { reviewId, error } = verifyReviewToken(token);

  if (error) {
    return (
      <Shell>
        <StateCard
          tone="error"
          icon="alert-triangle"
          title="Link invalid or expired"
          body="This moderation link can't be used. Review links expire after 30 days; if the student edits their review, a fresh link is sent."
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
          body="Moderating reviews needs SUPABASE_SERVICE_ROLE_KEY set on the server."
        />
      </Shell>
    );
  }

  const found = await getReviewForModeration(admin, reviewId);
  if (!found) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Review not found" body="It may have been deleted by the student who wrote it." />
      </Shell>
    );
  }

  const { review, tutorSlug, tutorName, studentName } = found;
  const profileHref = tutorSlug ? `/tutor/${tutorSlug}` : null;

  if (review.status !== "pending") {
    return (
      <Shell>
        <StateCard
          tone={review.status === "approved" ? "ok" : "neutral"}
          icon={review.status === "approved" ? "check-circle" : "info"}
          title="Already decided"
          body={`This review has ${DECIDED[review.status] || "already been dealt with"}. No further action needed.`}
          profileHref={review.status === "approved" ? profileHref : null}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}>
        <div className="flex items-start gap-3 mb-5">
          <span className="inline-flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}>
            <Icon name="star" size={20} />
          </span>
          <div>
            <h1 className="text-[32px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>Review a review</h1>
            <p className="text-[13.5px] text-slate-500 mt-1">Read it, then publish or reject.</p>
          </div>
        </div>

        <div className="text-[14px]" style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: 16 }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <StarRating value={review.rating} size={16} />
            <span className="font-medium text-slate-900">{review.rating}/5</span>
          </div>
          <div className="text-slate-500 text-[13px] mt-1.5">
            {studentName} on {tutorName}
          </div>
          {review.body ? (
            <p className="text-[14px] leading-[1.6] mt-3 whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
              {review.body}
            </p>
          ) : (
            <p className="text-[13px] mt-3" style={{ color: "var(--sage)" }}>No written review, a rating only.</p>
          )}
          {profileHref && (
            <a href={profileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] mt-3" style={{ color: "var(--accent)" }}>
              View the tutor&apos;s public profile <Icon name="external" size={13} />
            </a>
          )}
        </div>

        <p className="text-[12.5px] text-slate-500 mt-4 mb-5">
          Approving publishes it on the tutor&apos;s profile and updates their average rating. Rejecting keeps it hidden, and the student can edit it to send it back for another look. Either way they&apos;ll be notified by email.
        </p>

        <ReviewDecision token={token} studentName={studentName} tutorName={tutorName} profileHref={profileHref} />
      </section>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className="max-w-[520px] mx-auto px-6 pt-16 pb-24">{children}</div>
    </div>
  );
}

function StateCard({ tone, icon, title, body, profileHref }) {
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
