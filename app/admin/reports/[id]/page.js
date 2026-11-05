import { notFound } from "next/navigation";
import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import { Icon } from "@/components/Icon";
import { getReviewForModeration } from "@/lib/supabase/reviews";
import { lastActionFor } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, DecidedNote, Chip } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { formatDateTime, REPORT_CATEGORY_LABELS } from "../../_components/format";

export const metadata = { title: "Review report" };

const ROLE_LABELS = { tutor: "Tutor", student: "Student", partner: "Company owner" };
const STATUS_LABELS = { pending: "Pending", rejected: "Rejected", removed: "Removed" };

const RESOLUTION_LABELS = {
  disabled_reported: "Resolved: the reported account was disabled.",
  disabled_reporter: "Resolved: the reporter's account was disabled.",
  dismissed: "Resolved: the report was dismissed.",
  removed_review: "Resolved: the review was removed.",
};

// Both parties, the reason, and the reported content: the full conversation
// (every message ever sent, unsent ones included) or the review.
export default async function ReportDetailPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const { data: report } = await admin
    .from("reports")
    .select("id, reporter_id, reported_id, conversation_id, review_id, category, details, status, resolution, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!report) notFound();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, status, is_admin")
    .in("id", [report.reporter_id, report.reported_id]);
  const emailFor = async (id) => {
    const { data } = await admin.auth.admin.getUserById(id);
    return data?.user?.email || null;
  };
  const [reporterEmail, reportedEmail] = await Promise.all([emailFor(report.reporter_id), emailFor(report.reported_id)]);
  const person = (id, fallback, email) => {
    const p = profiles?.find((row) => row.id === id);
    return { id, name: p?.full_name || fallback, role: p?.role, status: p?.status, isAdmin: !!p?.is_admin, email };
  };
  const reporter = person(report.reporter_id, "Reporter", reporterEmail);
  const reported = person(report.reported_id, "Reported user", reportedEmail);

  const aboutAReview = !!report.review_id || report.category === "inappropriate_review";

  let messages = [];
  if (report.conversation_id) {
    const { data } = await admin
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", report.conversation_id)
      .order("created_at", { ascending: true });
    messages = data || [];
  }
  // review_id is ON DELETE SET NULL, so the author may have deleted it.
  const reviewed = report.review_id ? await getReviewForModeration(admin, report.review_id) : null;

  const pending = report.status === "pending";
  const last = pending ? null : await lastActionFor(supabase, "report", report.id);

  // Admins can't be disabled from the dashboard (0074), so don't offer it.
  const actions = [];
  if (aboutAReview && reviewed) {
    actions.push({ key: "remove_review", label: "Remove the review", busyLabel: "Removing…", tone: "danger", icon: "trash", body: { action: "remove_review" }, doneText: "The review was removed and the rating updated." });
  }
  if (!reported.isAdmin) {
    actions.push({ key: "disable_reported", label: `Disable ${reported.name} (reported)`, busyLabel: "Disabling…", tone: "danger", icon: "ban", body: { action: "disable_reported" }, doneText: `${reported.name}'s account was disabled.` });
  }
  if (!reporter.isAdmin) {
    actions.push({ key: "disable_reporter", label: `Disable ${reporter.name} (reporter)`, busyLabel: "Disabling…", tone: "danger", icon: "ban", body: { action: "disable_reporter" }, doneText: `${reporter.name}'s account was disabled.` });
  }
  actions.push({ key: "dismiss", label: "Dismiss report", busyLabel: "Dismissing…", tone: "neutral", body: { action: "dismiss" }, doneText: "The report was dismissed. No accounts were changed." });

  return (
    <>
      <PageHeader
        icon="flag"
        title={`${reporter.name} reported ${reported.name}`}
        lead={`${aboutAReview ? "Review" : "Conversation"} report, filed ${formatDateTime(report.created_at)}`}
        back={{ href: "/admin/reports", label: "Reports" }}
      />
      <Panel>
        <Inset>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Party label="Reporter" person={reporter} />
            <Party label="Reported" person={reported} />
          </div>
          <div className="mt-4 pt-4 border-t border-rule">
            <div>
              <span className="font-semibold">Reason:</span> {REPORT_CATEGORY_LABELS[report.category] || "Other"}
            </div>
            {report.details && <div className="mt-1 whitespace-pre-wrap text-[color:var(--text-2)]">{report.details}</div>}
          </div>
        </Inset>

        {aboutAReview ? (
          <div className="mt-6">
            <h2 className="mb-2 text-[16px] leading-6 font-semibold text-[color:var(--text)]">The review</h2>
            <Inset>
              {!reviewed ? (
                <p className="text-[color:var(--text-2)]">
                  The author deleted this review, so there is nothing left to remove. You can still disable the account or dismiss.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRating value={reviewed.review.rating} size={16} />
                    <span className="font-semibold">{reviewed.review.rating}/5</span>
                    {reviewed.review.status !== "approved" && <Chip>{STATUS_LABELS[reviewed.review.status] || reviewed.review.status}</Chip>}
                  </div>
                  <div className="mt-1 text-[color:var(--text-2)]">
                    {reviewed.studentName} on {reviewed.subjectName}
                  </div>
                  {reviewed.review.body ? (
                    <p className="mt-3 text-[16px] leading-6 whitespace-pre-wrap">{reviewed.review.body}</p>
                  ) : (
                    <p className="mt-3 text-[color:var(--text-2)]">No written review, a rating only.</p>
                  )}
                  {reviewed.subjectHref && (
                    <a href={reviewed.subjectHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-h-6 mt-3 text-accent hover:text-accent-hover">
                      View {reviewed.subjectName}&apos;s page <Icon name="external" size={16} />
                    </a>
                  )}
                </>
              )}
            </Inset>
          </div>
        ) : (
          <div className="mt-6">
            <h2 className="mb-2 text-[16px] leading-6 font-semibold text-[color:var(--text)]">Conversation</h2>
            <div className="bg-surface-2 rounded p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 420 }}>
              {messages.length === 0 ? (
                <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No messages were exchanged.</p>
              ) : (
                messages.map((m) => {
                  const fromReporter = m.sender_id === report.reporter_id;
                  return (
                    <div key={m.id} className="text-[14px] leading-5">
                      <span className="font-semibold text-[color:var(--text)]">
                        {fromReporter ? `${reporter.name} (reporter)` : `${reported.name} (reported)`}:
                      </span>{" "}
                      <span className="whitespace-pre-wrap text-[color:var(--text)]">{m.body}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="mt-6">
          {pending ? (
            <div>
              <p className="mb-4 text-[14px] leading-5 text-[color:var(--text-2)]">
                {aboutAReview && "Removing the review hides it everywhere and updates the rating; it can't be edited back. "}
                Disabling an account parks that user on the disabled screen and hides them from search, along with every review they&apos;ve written. You can re-enable it from Users. Nobody is emailed about the outcome.
              </p>
              <DecisionPanel endpoint="/api/admin/reports" body={{ reportId: report.id }} actions={actions} layout="column" reasonHint="For History only." />
            </div>
          ) : (
            <DecidedNote text={RESOLUTION_LABELS[report.resolution] || "Resolved."} last={last} />
          )}
        </div>
      </Panel>
    </>
  );
}

function Party({ label, person }) {
  const meta = [
    person.role ? ROLE_LABELS[person.role] || person.role : null,
    person.status === "disabled" ? "Disabled" : null,
    person.isAdmin ? "Admin" : null,
  ].filter(Boolean).join(" · ");
  return (
    <div>
      <div className="text-[12px] leading-4 text-muted">{label}</div>
      <Link href={adminPaths.user(person.id)} className="inline-flex min-h-6 items-center font-semibold text-accent hover:text-accent-hover">
        {person.name}
      </Link>
      {meta && <div className="text-[color:var(--text-2)]">{meta}</div>}
      {person.email && <div className="text-[color:var(--text-2)] break-all">{person.email}</div>}
    </div>
  );
}
