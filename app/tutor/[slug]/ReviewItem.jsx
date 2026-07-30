"use client";
import { Avatar } from "@/components/ui";
import { StarRating } from "@/components/StarRating";

// One review row. Shared by the sidebar card and the "all reviews" modal so the
// two can never drift; the only difference is that the card clamps long text and
// the modal shows it in full.
//
// `actions` is a slot for the per-review kebab menu (owner edit/delete, everyone
// else report) — unused until that slice, so nothing is rendered when it's null.

// Reviews are long-lived, so an absolute date reads better than "62d ago" (and
// doesn't churn).
//
// Locale AND time zone are pinned rather than left to the runtime, because this
// component is server-rendered and then hydrated, so both sides have to produce
// byte-identical text. Left to the runtime it doesn't:
//   * locale   — Node resolves `undefined` to en-US ("Jul 26, 2026") while an
//                Australian browser resolves it to en-AU ("26 Jul 2026").
//   * timeZone — the server runs in UTC and the reader is on UTC+10/+11, so a
//                review timestamped late in the day lands on a different date
//                on each side.
// Either one alone is a hydration error. AEST covers Sydney and Melbourne, the
// two seeded school markets.
//
// Intl is used ONLY to resolve the calendar day/month/year in that zone, as
// NUMBERS; the month name comes from the table below. Letting Intl name the
// month reintroduces the same class of bug one level down — ICU picks a pattern
// per locale, and `month: "short"` under en-AU renders "July" on Node while a
// browser on different ICU data can render "Jul". Numeric parts don't drift.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SYDNEY_PARTS = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Australia/Sydney",
});

function formatReviewDate(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const p = Object.fromEntries(SYDNEY_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

export function ReviewItem({ review, clamp = false, actions = null }) {
  const name = review.authorName?.trim() || "A student";
  // Avatar reads { avatarImg, avatarBg } off a tutor object; a reviewer isn't
  // one, so hand it the same shape. Students have no avatar_bg column of their
  // own, so every reviewer gets the same soft teal behind the fallback cap.
  const author = { avatarImg: review.authorAvatarUrl || null, avatarBg: "var(--accent-softer)" };

  return (
    <article className="flex items-start gap-2.5">
      <div className="shrink-0 mt-0.5">
        <Avatar tutor={author} size={32} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
              {name}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating value={review.rating} size={12} />
              <span className="text-[11.5px]" style={{ color: "var(--sage)" }}>
                {formatReviewDate(review.createdAt)}
              </span>
            </div>
          </div>
          {actions}
        </div>

        {review.body && (
          <p
            className={`text-[13px] leading-[1.6] mt-1.5 whitespace-pre-wrap ${clamp ? "line-clamp-4" : ""}`}
            style={{ color: "var(--ink-muted)" }}
          >
            {review.body}
          </p>
        )}
      </div>
    </article>
  );
}
