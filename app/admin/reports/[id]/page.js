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
        <div className="pt-5 space-y-5">
          <Inset>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Party label="Reporter" person={reporter} />
              <Party label="Reported" person={reported} />
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--paper-line)" }}>
              <div className="text-slate-900">
                <span className="font-medium">Reason:</span> {REPORT_CATEGORY_LABELS[report.category] || "Other"}
              </div>
              {report.details && <div className="text-slate-600 text-[13.5px] mt-1.5 whitespace-pre-wrap">{report.details}</div>}
            </div>
          </Inset>

          {aboutAReview ? (
            <div>
              <h2 className="text-[13px] font-light text-slate-500 uppercase tracking-wide mb-2">The review</h2>
              <Inset>
                {!reviewed ? (
                  <p className="text-[13.5px] text-slate-500">
                    The author deleted this review, so there is nothing left to remove. You can still disable the account or dismiss.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <StarRating value={reviewed.review.rating} size={16} />
                      <span className="font-medium text-slate-900">{reviewed.review.rating}/5</span>
                      {reviewed.review.status !== "approved" && <Chip>{reviewed.review.status}</Chip>}
                    </div>
                    <div className="text-slate-500 text-[13px] mt-1.5">
                      {reviewed.studentName} on {reviewed.subjectName}
                    </div>
                    {reviewed.review.body ? (
                      <p className="text-[14px] leading-[1.6] mt-3 whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{reviewed.review.body}</p>
                    ) : (
                      <p className="text-[13px] mt-3" style={{ color: "var(--sage)" }}>No written review, a rating only.</p>
                    )}
                    {reviewed.subjectHref && (
                      <a href={reviewed.subjectHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] mt-3" style={{ color: "var(--accent)" }}>
                        View {reviewed.subjectName}&apos;s page <Icon name="external" size={13} />
                      </a>
                    )}
                  </>
                )}
              </Inset>
            </div>
          ) : (
            <div>
              <h2 className="text-[13px] font-light text-slate-500 uppercase tracking-wide mb-2">Conversation</h2>
              <div className="space-y-2" style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: 16, maxHeight: 420, overflowY: "auto" }}>
                {messages.length === 0 ? (
                  <p className="text-[13.5px] text-slate-500">No messages were exchanged.</p>
                ) : (
                  messages.map((m) => {
                    const fromReporter = m.sender_id === report.reporter_id;
                    return (
                      <div key={m.id} className="text-[13.5px]">
                        <span className="font-medium" style={{ color: fromReporter ? "var(--accent)" : "#DC2626" }}>
                          {fromReporter ? reporter.name : reported.name}:
                        </span>{" "}
                        <span className="text-slate-700 whitespace-pre-wrap">{m.body}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {pending ? (
            <div>
              <p className="text-[12.5px] text-slate-500 mb-4">
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
  return (
    <div>
      <div className="text-[11.5px] font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <Link href={adminPaths.user(person.id)} className="font-medium text-slate-900 hover:underline">
        {person.name}
      </Link>
      <div className="text-slate-500 text-[12.5px] capitalize">
        {[person.role, person.status === "disabled" ? "disabled" : null, person.isAdmin ? "admin" : null].filter(Boolean).join(" · ")}
      </div>
      {person.email && <div className="text-slate-500 text-[12.5px]">{person.email}</div>}
    </div>
  );
}
