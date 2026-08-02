// The article registry. Every article module is imported here exactly once, and
// lib/blog.js is the only consumer: pages never import this file directly.
//
// Order in this array is not meaningful — lib/blog.js sorts by publishedAt — but
// keeping it newest-last makes the list easy to append to.
//
// When the blogger-role slice moves articles into an `articles` table, this file
// and content/blog/articles/ are what get deleted; nothing else changes.

import * as howAtarScalingWorks from "./articles/how-atar-scaling-works";
import * as hscStudyTimetableGuide from "./articles/hsc-study-timetable-guide";
import * as vceSacsExplained from "./articles/vce-sacs-explained";
import * as activeRecallSpacedRepetition from "./articles/active-recall-spaced-repetition";
import * as howToChooseATutor from "./articles/how-to-choose-a-tutor";

export const ARTICLES = [
  howAtarScalingWorks,
  hscStudyTimetableGuide,
  vceSacsExplained,
  activeRecallSpacedRepetition,
  howToChooseATutor,
].map((m) => ({ meta: m.meta, sections: m.sections }));
