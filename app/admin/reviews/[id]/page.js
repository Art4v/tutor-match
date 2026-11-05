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
        <Inset>
          <div className="flex items-center gap-2 flex-wrap">
            <StarRating value={review.rating} size={16} />
            <span className="font-semibold">{review.rating}/5</span>
            <span className="text-[12px] leading-4 text-muted">{formatDate(review.created_at)}</span>
          </div>
          {review.body ? (
            <p className="mt-3 text-[16px] leading-6 whitespace-pre-wrap">{review.body}</p>
          ) : (
            <p className="mt-3 text-[color:var(--text-2)]">No written review, a rating only.</p>
          )}
          {subjectHref && (
            <a href={subjectHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-h-6 mt-3 text-accent hover:text-accent-hover">
              View the {whose} public page <Icon name="external" size={16} />
            </a>
          )}
        </Inset>

        <div className="mt-6">
          {pending ? (
            <>
              <p className="mb-4 text-[14px] leading-5 text-[color:var(--text-2)]">
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
      </Panel>
    </>
  );
}
