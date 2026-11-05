"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SubjectPicker } from "@/components/SubjectPicker";
import { useRouteLoading } from "@/components/RouteLoadingProvider";
import { AU_STATES } from "@/lib/states";

/**
 * The home search panel (REDESIGN_DECISIONS.md item 3): State, then Subject,
 * each with its label above, then a full-width "Find tutors" button. Submits to
 * the same /browse query the old hero built (`state`, `subject`). State results
 * include online tutors (R3), which is the browse query's job, not this form's.
 *
 * State is a native <select>: eight fixed options need no search panel, and
 * CatalogPicker's single-value "box" trigger reads "1 selected" rather than the
 * chosen name. Subject keeps the shared SubjectPicker (254 subjects, exam tabs).
 */
export function HomeHero({ catalog }) {
  const { navigate } = useRouteLoading();
  // `auState` rather than `state`: a bare `state` reads as React state here.
  const [auState, setAuState] = useState("");
  const [subject, setSubject] = useState(null);

  const goBrowse = (e) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (subject) params.append("subject", subject);
    if (auState) params.append("state", auState);
    const qs = params.toString();
    navigate(`/browse${qs ? `?${qs}` : ""}`);
  };

  return (
    <form onSubmit={goBrowse} className="mt-6 max-w-[680px] border border-rule rounded p-4 sm:p-6" aria-label="Find a tutor">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="home-state" className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">
            State
          </label>
          <div className="relative mt-2">
            <select
              id="home-state"
              value={auState}
              onChange={(e) => setAuState(e.target.value)}
              className="block w-full h-11 pl-3 pr-8 appearance-none rounded border border-input bg-surface text-[14px] leading-5 text-[color:var(--text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--accent)] focus:border-accent"
            >
              <option value="">Any state</option>
              {AU_STATES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-2)]"
            />
          </div>
        </div>
        <div>
          <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">Subject</span>
          <div className="mt-2">
            <SubjectPicker
              catalog={catalog}
              value={subject}
              onChange={(slug) => setSubject(slug || null)}
              mode="single"
              variant="box"
              placeholder="Any subject"
            />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Button type="submit" variant="primary" full>
          Find tutors
        </Button>
      </div>
    </form>
  );
}
