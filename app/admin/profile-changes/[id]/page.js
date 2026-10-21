import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getRevisionForModeration } from "@/lib/supabase/profileRevisions";
import { lastActionFor } from "@/lib/supabase/adminDashboard";
import { diffProfiles } from "@/lib/profileDiff";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, DecidedNote } from "../../_components/ui";
import { formatDate } from "../../_components/format";
import { RevisionDiff } from "../RevisionDiff";
import { RevisionDecision } from "./RevisionDecision";

export const metadata = { title: "Review profile changes" };

const DECIDED = {
  approved: "These changes were approved and are live.",
  rejected: "These changes were rejected. The tutor can edit and resubmit.",
  withdrawn: "The tutor kept editing after submitting, so this version was withdrawn.",
  discarded: "The tutor discarded these changes.",
  cancelled: "The tutor is no longer verified, so these changes were cancelled.",
  draft: "This version hasn't been submitted.",
};

export default async function RevisionDetailPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const found = await getRevisionForModeration(admin, params.id);
  if (!found) notFound();

  const { revision, tutorName, slug } = found;
  const profileHref = slug ? `/tutor/${slug}` : null;
  const pending = revision.status === "pending";
  const last = pending ? null : await lastActionFor(supabase, "revision", revision.id);

  const diff = diffProfiles({
    live: found.live,
    draft: found.draft,
    liveDocs: found.liveDocs,
    draftDocs: found.draftDocs,
    subjectCatalog: found.subjectCatalog,
  });
  const blocked = !found.gated || found.accountStatus === "disabled";

  return (
    <>
      <PageHeader
        icon="pencil"
        title={tutorName}
        lead={`Profile changes${revision.submittedAt ? `, submitted ${formatDate(revision.submittedAt)}` : ""}`}
        back={{ href: "/admin/profile-changes", label: "Profile changes" }}
      />
      <Panel>
        <div className="pt-5">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] mb-5">
            <a href={adminPaths.revisionPreview(revision.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
              Preview the updated profile <Icon name="external" size={13} />
            </a>
            {profileHref && (
              <a href={profileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                Current public profile <Icon name="external" size={13} />
              </a>
            )}
          </div>

          <RevisionDiff diff={diff} signed={found.signed} />

          <div className="mt-5">
            {!pending ? (
              <DecidedNote text={DECIDED[revision.status] || "Already decided."} last={last} />
            ) : blocked ? (
              <p className="text-[13px]" style={{ color: "#B45309" }}>
                This tutor is no longer verified or their account is disabled, so these changes can&apos;t be applied.
              </p>
            ) : (
              <>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  Approving publishes every change above, including new photos and documents. Rejecting keeps the current profile; the tutor stays verified and gets your note. Either way they&apos;re emailed.
                </p>
                <RevisionDecision revisionId={revision.id} tutorName={tutorName} />
              </>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
