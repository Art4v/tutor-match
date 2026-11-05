"use client";
import { TutorCard } from "@/components/TutorCard";
import { useSavedTutors } from "@/components/SavedTutorsProvider";

// The /browse results: tutor rows separated by 1px rules (DESIGN.md), no
// entrance animation.
export function BrowseResultsGrid({ tutors, savedOnly = false }) {
  const { ready, isSaved } = useSavedTutors();

  // On the saved filter, the list is server-rendered from the saved set at load
  // time. Unsaving a tutor only flips client state, so without this the row
  // would linger until a refresh. Once the saved set is loaded, drop any row
  // that's no longer saved so an unsave removes it immediately. Before `ready`
  // we show the server list untouched (it already equals the saved set), so
  // there's no empty flash on load.
  const visible = savedOnly && ready ? tutors.filter((t) => isSaved(t.id)) : tutors;

  return (
    <ul className="border-t border-rule">
      {visible.map((t) => (
        <li key={t.id} className="border-b border-rule">
          <TutorCard tutor={t} />
        </li>
      ))}
    </ul>
  );
}
