import Link from "next/link";
import { Avatar, VerifiedTick } from "@/components/ui";
import { stripMarkdown } from "@/lib/richText";

/**
 * Centered mini card for the similar-tutors grid. Fully static: no hover
 * treatment, matching the flat profile page.
 */
export function SimilarTutorMini({ tutor }) {
  return (
    <Link
      href={`/tutor/${tutor.slug}`}
      className="flex flex-col items-center text-center"
      style={{
        background: "var(--desk)",
        border: "1px solid var(--line-soft)",
        borderRadius: 12,
        padding: "16px 14px",
      }}
    >
      <Avatar tutor={tutor} size={48} />
      <div className="flex items-center gap-1 min-w-0 mt-2.5 max-w-full">
        <span className="text-[14px] font-medium truncate" style={{ color: "var(--ink-graphite-deep)" }}>
          {tutor.name}
        </span>
        {tutor.verified && <VerifiedTick size={11} />}
      </div>
      <div className="text-[12px] truncate mt-0.5 max-w-full" style={{ color: "var(--sage)", minHeight: "1.3em" }}>
        {stripMarkdown(tutor.bio) || " "}
      </div>
      <div className="text-[12.5px] font-medium tabular-nums mt-1.5" style={{ color: "var(--pill-ink)" }}>
        ${tutor.rate}/hr
      </div>
    </Link>
  );
}
