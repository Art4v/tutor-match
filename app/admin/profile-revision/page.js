import { Icon } from "@/components/Icon";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRevisionToken } from "@/lib/revisionToken";
import { getRevisionForModeration } from "@/lib/supabase/profileRevisions";
import { diffProfiles } from "@/lib/profileDiff";
import { RevisionDiff } from "./RevisionDiff";
import { RevisionDecision } from "./RevisionDecision";
import { Shell, StateCard, tokenErrorCard } from "./AdminShell";

export const metadata = { title: "Review profile changes", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing page for the link in the admin's "profile changes to review" email.
// The signed token in ?token= is the authorization (no login) and names ONE
// revision, so an old link reports what happened to that submission. A GET
// never mutates, so an email prefetch can't approve anything.
const DECIDED = {
  approved: { tone: "ok", icon: "check-circle", title: "Already approved", body: "These changes were approved and are live on the tutor's profile." },
  rejected: { icon: "info", title: "Already rejected", body: "These changes were rejected. The tutor can edit and resubmit, which sends a new link." },
  withdrawn: { icon: "info", title: "Withdrawn", body: "The tutor kept editing after submitting, so this version was withdrawn. You'll get a new link when they resubmit." },
  discarded: { icon: "info", title: "Discarded", body: "The tutor discarded these changes, so there is nothing to review." },
  cancelled: { icon: "info", title: "Cancelled", body: "The tutor is no longer verified, so these changes were cancelled. They now edit their profile directly." },
};

export default async function AdminProfileRevisionPage({ searchParams }) {
  const token = searchParams?.token ?? "";
  const { revisionId, error } = verifyRevisionToken(token);

  if (error) {
    const card = tokenErrorCard(error);
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title={card.title} body={card.body} />
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Server not configured" body="Reviewing profile changes needs SUPABASE_SERVICE_ROLE_KEY set on the server." />
      </Shell>
    );
  }

  const found = await getRevisionForModeration(admin, revisionId);
  if (!found) {
    return (
      <Shell>
        <StateCard tone="error" icon="alert-triangle" title="Not found" body="These changes no longer exist. The tutor's account may have been deleted." />
      </Shell>
    );
  }

  const { revision, tutorName, slug } = found;
  const profileHref = slug ? `/tutor/${slug}` : null;

  if (revision.status !== "pending") {
    const d = DECIDED[revision.status] || { icon: "info", title: "Nothing to review", body: "This version was never submitted." };
    return (
      <Shell>
        <StateCard tone={d.tone} icon={d.icon} title={d.title} body={d.body} profileHref={profileHref} />
      </Shell>
    );
  }

  const diff = diffProfiles({
    live: found.live,
    draft: found.draft,
    liveDocs: found.liveDocs,
    draftDocs: found.draftDocs,
    subjectCatalog: found.subjectCatalog,
  });
  const blocked = !found.gated || found.accountStatus === "disabled";
  const previewHref = `/admin/profile-revision/preview?token=${encodeURIComponent(token)}`;

  return (
    <Shell wide>
      <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 28 }}>
        <div className="flex items-start gap-3 mb-5">
          <span className="inline-flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}>
            <Icon name="shield-check" size={20} />
          </span>
          <div>
            <h1 className="text-[32px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>Review profile changes</h1>
            <p className="text-[13.5px] text-slate-500 mt-1">
              {tutorName} is verified and wants to update their profile. Students see the current version until you approve.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] mb-5">
          <a href={previewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
            Preview the updated profile <Icon name="external" size={13} />
          </a>
          {profileHref && (
            <a href={profileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
              Current public profile <Icon name="external" size={13} />
            </a>
          )}
          {revision.submittedAt && (
            <span className="text-slate-400">Submitted {new Date(revision.submittedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}</span>
          )}
        </div>

        <RevisionDiff diff={diff} signed={found.signed} />

        {blocked ? (
          <p className="text-[13px] mt-5" style={{ color: "#B45309" }}>
            This tutor is no longer verified or their account is disabled, so these changes can't be applied.
          </p>
        ) : (
          <>
            <p className="text-[12.5px] text-slate-500 mt-5 mb-4">
              Approving publishes every change above, including new photos and documents. Rejecting keeps the current profile; the tutor stays verified and gets your note. Either way they&apos;re notified by email.
            </p>
            <RevisionDecision token={token} tutorName={tutorName} />
          </>
        )}
      </section>
    </Shell>
  );
}
