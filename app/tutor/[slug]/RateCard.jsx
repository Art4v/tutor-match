import { MessageTutorButton } from "./MessageTutorButton";
import { contactColumnClass } from "./ProfileCards";

/**
 * The tutor's contact column: hourly rate, packages, Message. Sticky on the
 * right from 1024px (the parent positions it); inline under the header below.
 *
 * Rate rule (R2): a missing or $0 rate reads "Rate not listed". Packages are a
 * plain list: there is no booking or checkout, so nothing is selectable.
 */
export function RateCard({ tutor, showMessage = true }) {
  const packages = (tutor.packages ?? []).filter((p) => p.label || Number(p.price) > 0);
  const rate = Number(tutor.rate);
  const hasRate = Number.isFinite(rate) && rate > 0;

  return (
    <div className={contactColumnClass}>
      {hasRate ? (
        <div className="flex items-baseline gap-1">
          <span className="text-[24px] leading-8 font-semibold tabular-nums text-[color:var(--text)]">${rate}</span>
          <span className="text-[14px] leading-5 text-[color:var(--text-2)]">per hour</span>
        </div>
      ) : (
        <p className="text-[16px] leading-6 text-[color:var(--text-2)]">Rate not listed</p>
      )}

      {packages.length > 0 && <PackageList packages={packages} />}

      {showMessage && (
        <div className="mt-6">
          <MessageTutorButton tutor={tutor} />
        </div>
      )}
    </div>
  );
}

/** Packages as label / price rows divided by rules. Shared with the company column. */
export function PackageList({ packages, title = "Packages", className = "mt-6" }) {
  return (
    <div className={className}>
      {title && <h2 className="mb-2 text-[14px] leading-5 font-semibold text-[color:var(--text)]">{title}</h2>}
      <ul className="border-t border-rule">
        {packages.map((p, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 border-b border-rule py-3 text-[14px] leading-5">
            <span className="min-w-0 break-words text-[color:var(--text)]">{p.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-[color:var(--text)]">${p.price}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
