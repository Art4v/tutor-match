// The seed set, in no meaningful order (the site sorts by publishedAt). Adding
// an article here is all it takes for the seed script to pick it up.
//
// This is seed data, not the store: once an article exists in the `articles`
// table it is edited there, and re-running the seed will overwrite it from this
// file. Treat these as the initial content drop, not as a source of truth.

import howAtarScalingWorks from "./how-atar-scaling-works.mjs";
import hscStudyTimetableGuide from "./hsc-study-timetable-guide.mjs";
import vceSacsExplained from "./vce-sacs-explained.mjs";
import activeRecallSpacedRepetition from "./active-recall-spaced-repetition.mjs";
import howToChooseATutor from "./how-to-choose-a-tutor.mjs";

export const SEED_ARTICLES = [
  howAtarScalingWorks,
  hscStudyTimetableGuide,
  vceSacsExplained,
  activeRecallSpacedRepetition,
  howToChooseATutor,
];

// Byline name -> the tutor_profiles.slug that name must resolve to. The script
// refuses to seed anything if one of these does not exist, rather than quietly
// writing an article with no author.
export const AUTHOR_SLUG_BY_NAME = {
  "Aarav Bhatt": "aarav-bhatt",
  "Eric Chen": "eric-chen",
};

// Cover art, by slug. picsum.photos is deterministic per seed string, always
// resolves, and is unambiguously placeholder art rather than something with a
// licence to keep track of. Swap in real images (any direct image URL works)
// and re-run with --force-covers when you have them.
export const COVER_URL_BY_SLUG = {
  "how-atar-scaling-works": "https://picsum.photos/seed/how-atar-scaling-works/1600/800",
  "hsc-study-timetable-guide": "https://picsum.photos/seed/hsc-study-timetable-guide/1600/800",
  "vce-sacs-explained": "https://picsum.photos/seed/vce-sacs-explained/1600/800",
  "active-recall-spaced-repetition":
    "https://picsum.photos/seed/active-recall-spaced-repetition/1600/800",
  "how-to-choose-a-tutor": "https://picsum.photos/seed/how-to-choose-a-tutor/1600/800",
};
