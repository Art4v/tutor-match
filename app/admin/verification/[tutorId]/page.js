import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { lastActionFor } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, DecidedNote, Chip } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { RetryPurgeButton } from "../../_components/RetryPurgeButton";
import { SupportingDocumentsList } from "../../_components/SupportingDocumentsList";
import { formatDate } from "../../_components/format";
import { getVerificationDocsForAdmin } from "@/lib/admin/verificationDocs";

export const metadata = { title: "Review verification" };

// What a non-pending status means. `none` is a request the tutor withdrew (a
// real change to a pending profile withdraws it, 0072) or never made.
const DECIDED = {
  verified: "This tutor is verified. They do not hold the marks verified seal.",
  sealed: "This tutor is verified and holds the marks verified seal.",
  declined: "This tutor is verified. Their last request for the marks verified seal was declined, and they can ask again.",
  rejected: "This request was rejected. The tutor can update their profile and ask again.",
  none: "There is no open request. The tutor withdrew it or never asked.",
};

// The more recent of two History rows (either may be null).
function newest(a, b) {
  if (!a || !b) return a || b;
  return new Date(b.created_at ?? b.at ?? 0) > new Date(a.created_at ?? a.at ?? 0) ? b : a;
}

export default async function VerificationDetailPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const { data: tutor } = await admin
    .from("tutor_profiles")
    .select("id, verification_status, verification_requested_at, marks_status, marks_requested_at, slug, suburb, city, partner_id, profile:profiles!inner ( full_name, status )")
    .eq("id", params.tutorId)
    .maybeSingle();
  if (!tutor) notFound();

  const name = tutor.profile?.full_name || "This tutor";
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(", ");
  const profileHref = tutor.slug ? `/tutor/${tutor.slug}` : null;
  const pending = tutor.verification_status === "pending";
  // A verified tutor asking for the marks verified seal (0083). The two
  // requests are never open together: this one needs verification first.
  const marksPending = !pending && tutor.marks_status === "pending";
  const open = pending || marksPending;
  const decidedKey =
    tutor.verification_status !== "verified"
      ? tutor.verification_status
      : tutor.marks_status === "verified"
        ? "sealed"
        : tutor.marks_status === "declined"
          ? "declined"
          : "verified";
  // The newest decision of either kind: a seal decision postdates the approval.
  const last = open
    ? null
    : newest(
        await lastActionFor(supabase, "tutor", tutor.id, "verification_"),
        await lastActionFor(supabase, "tutor", tutor.id, "marks_")
      );
  const requestedAt = marksPending ? tutor.marks_requested_at : tutor.verification_requested_at;
  const { docs, purgePending } = await getVerificationDocsForAdmin(admin, tutor.id);

  return (
    <>
      <PageHeader
        icon="shield-check"
        title={name}
        lead={marksPending ? "Marks verification request" : "Verification request"}
        back={{ href: "/admin/verification", label: "Verification" }}
      />
      <Panel>
        <div className="pt-5">
          <Inset>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{name}</span>
              {tutor.profile?.status === "disabled" && <Chip tone="bad">Account disabled</Chip>}
            </div>
            {location && <div className="text-slate-500 text-[13px] mt-0.5">{location}</div>}
            {requestedAt && (
              <div className="text-slate-500 text-[13px] mt-0.5">Requested {formatDate(requestedAt)}</div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px]">
              {profileHref && (
                <a href={profileHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                  View public profile <Icon name="external" size={13} />
                </a>
              )}
              <a href={adminPaths.user(tutor.id)} className="inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                Account details <Icon name="arrow-right" size={13} />
              </a>
            </div>
          </Inset>

          {open && (
            <div className="mt-5">
              <h2 className="text-[15px] font-medium text-slate-800">Supporting documents</h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5 mb-2">
                {marksPending
                  ? "Private to admins. Deleted automatically when you grant the seal. Kept for the tutor's next request if you decline."
                  : "Private to admins. Deleted automatically when you approve, with or without the seal. Kept for the tutor's next request if you reject."}
              </p>
              <SupportingDocumentsList docs={docs} />
            </div>
          )}

          {purgePending > 0 && (
            <div className="mt-5">
              <RetryPurgeButton tutorId={tutor.id} count={purgePending} />
            </div>
          )}

          <div className="mt-5">
            {pending ? (
              <>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  Approving lists them with the verified badge. Approve with the marks seal only when you can fully support the marks on their profile, from these documents or because you know them: it adds the marks verified seal and ranks them at the top. Rejecting lets them update their profile and ask again. Whichever you choose they&apos;re emailed, with your note if you add one.
                </p>
                <DecisionPanel
                  endpoint="/api/admin/verification"
                  body={{ tutorId: tutor.id }}
                  reasonHint="Sent to the tutor with the decision."
                  actions={[
                    // A centre's tutor can never hold the seal (0083).
                    ...(tutor.partner_id
                      ? []
                      : [{ key: "approve_marks", label: "Approve with marks seal", busyLabel: "Approving…", tone: "primary", icon: "shield-check", body: { decision: "approve_marks" }, doneText: `${name} is now verified, with the marks verified seal.` }]),
                    { key: "approve", label: tutor.partner_id ? "Approve" : "Approve without seal", busyLabel: "Approving…", tone: tutor.partner_id ? "primary" : "neutral", icon: "check", body: { decision: "approve" }, doneText: `${name} is now verified.` },
                    { key: "reject", label: "Reject", busyLabel: "Rejecting…", tone: "danger-outline", icon: "x", body: { decision: "reject" }, doneText: `${name}'s request was rejected.` },
                  ]}
                />
              </>
            ) : marksPending ? (
              <>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  This tutor is already verified and listed. Grant the seal only when you can fully support the marks on their profile. Declining leaves them verified and lets them ask again. They&apos;re emailed whichever you choose, with your note if you add one.
                </p>
                <DecisionPanel
                  endpoint="/api/admin/marks"
                  body={{ tutorId: tutor.id }}
                  reasonHint="Sent to the tutor with the decision."
                  actions={[
                    { key: "grant", label: "Grant marks seal", busyLabel: "Granting…", tone: "primary", icon: "shield-check", body: { decision: "grant" }, doneText: `${name} now holds the marks verified seal.` },
                    { key: "decline", label: "Decline", busyLabel: "Declining…", tone: "danger-outline", icon: "x", body: { decision: "decline" }, doneText: `${name}'s marks request was declined.` },
                  ]}
                />
              </>
            ) : (
              <DecidedNote text={DECIDED[decidedKey] || DECIDED.none} last={last} />
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
