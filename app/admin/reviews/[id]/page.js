import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { StarRating } from "@/components/StarRating";
import { getReviewForModeration } from "@/lib/supabase/reviews";
import { lastActionFor } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "../../guard";
import { PageHeader, Panel, Inset, DecidedNote } from "../../_components/ui";
import { DecisionPanel } from "../../_components/DecisionPanel";
import { formatDate } from "../../_components/format";

export const metadata = { title: "Moderate a review" };

const DECIDED = {
  approved: "This review is published.",
  rejected: "This review was rejected. The student can edit it, which sends it back here.",
  removed: "This review was removed after a report. That is final.",
};

export default async function ReviewDetailPage({ params }) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) notFound();

  const found = await getReviewForModeration(admin, params.id);
  if (!found) notFound();

  // subjectName / subjectHref resolve to the tutor OR the company (0067).
  const { review, subjectName, subjectHref, studentName, kind } = found;
  const pending = review.status === "pending";
  const last = pending ? null : await lastActionFor(supabase, "review", review.id);
  const whose = kind === "company" ? "company's" : "tutor's";

  return (
    <>
      <PageHeader icon="star" title={`${studentName} on ${subjectName}`} lead="Student review" back={{ href: "/admin/reviews", label: "Reviews" }} />
      <Panel>
        <div className="pt-5">
          <Inset>
            <div className="flex items-center gap-2.5 flex-wrap">
              <StarRating value={review.rating} size={16} />
              <span className="font-medium text-slate-900">{review.rating}/5</span>
              <span className="text-slate-400 text-[13px]">{formatDate(review.created_at)}</span>
            </div>
            {review.body ? (
              <p className="text-[14px] leading-[1.6] mt-3 whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
                {review.body}
              </p>
            ) : (
              <p className="text-[13px] mt-3" style={{ color: "var(--sage)" }}>No written review, a rating only.</p>
            )}
            {subjectHref && (
              <a href={subjectHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] mt-3" style={{ color: "var(--accent)" }}>
                View the {whose} public page <Icon name="external" size={13} />
              </a>
            )}
          </Inset>

          <div className="mt-5">
            {pending ? (
              <>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  Publishing shows it on the {whose} page and updates their average rating. Rejecting keeps it hidden, and the student can edit it to send it back. Either way the student is emailed, with your note on a rejection.
                </p>
                <DecisionPanel
                  endpoint="/api/admin/reviews"
                  body={{ reviewId: review.id }}
                  reasonHint="Sent to the student if you reject."
                  actions={[
                    { key: "approve", label: "Publish", busyLabel: "Publishing…", tone: "primary", icon: "check", body: { decision: "approve" }, doneText: "The review is live." },
                    { key: "reject", label: "Reject", busyLabel: "Rejecting…", tone: "danger-outline", icon: "x", body: { decision: "reject" }, doneText: "The review was rejected." },
                  ]}
                />
              </>
            ) : (
              <DecidedNote text={DECIDED[review.status] || "Already decided."} last={last} />
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
