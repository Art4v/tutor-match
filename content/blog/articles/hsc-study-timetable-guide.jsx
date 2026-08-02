import { Callout, Table } from "../prose";

export const meta = {
  slug: "hsc-study-timetable-guide",
  title: "The complete HSC study timetable guide for Year 12",
  excerpt:
    "Most study timetables are abandoned within a fortnight. This one is built around the two things that actually break them: an honest time audit and room for the weeks that go wrong.",
  category: "HSC",
  status: "published",
  publishedAt: "2026-03-03",
  updatedAt: null,
  author: {
    name: "Eric Chen",
    roleLine: "HSC tutor",
    avatar: null,
    initials: "EC",
    avatarBg: "#DCE9E4",
    tutorSlug: "eric-chen",
  },
  accent: { from: "#EAF3F1", to: "#CFE3DA", angle: 160 },
};

export const sections = [
  {
    id: "why-timetables-fail",
    heading: "Why most study timetables fail",
    content: (
      <>
        <p>
          Almost every Year 12 student builds a timetable in the first week of term, and most have
          quietly stopped using it by the third. The reason is rarely discipline. It is that the
          timetable was written for an imaginary week: one with no sport, no shift at work, no
          family dinner, and no evening where you are simply too tired to open a textbook.
        </p>
        <p className="mt-4">
          A schedule that assumes a perfect week fails on the first imperfect one, and once you have
          fallen two days behind a plan that has no slack in it, the rational move is to abandon the
          plan. So students do. The fix is not more willpower. It is a plan that was realistic on the
          day it was written.
        </p>
        <Callout title="The test of a good timetable">
          You should be able to lose an entire evening to something unexpected and still be on track
          by Sunday. If one bad night wrecks the week, the plan is too tight.
        </Callout>
      </>
    ),
  },
  {
    id: "time-audit",
    heading: "Auditing where your time actually goes",
    content: (
      <>
        <p>
          Before you allocate a single hour, spend one ordinary week recording where the hours
          currently go. Not what you intended to do, what you did. Most students discover two things
          they did not expect: they have less genuinely free time than they assumed, and a
          surprising amount of what they had counted as study was not study at all.
        </p>
        <p className="mt-4">Block out the fixed commitments first:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>School hours, including travel at both ends.</li>
          <li>Sport, music, part time work, and anything else with a fixed start time.</li>
          <li>Sleep, at the amount you actually need rather than the amount you can survive on.</li>
          <li>Meals and one genuine rest block per day.</li>
        </ul>
        <p className="mt-4">
          Whatever remains is your real study budget. For most Year 12 students in a normal term
          that lands somewhere between 12 and 20 hours a week, which is far less than the numbers
          traded around at school and entirely sufficient if the hours are used well. A timetable
          built on 30 hours you do not have is a plan to feel guilty, not a plan to study.
        </p>
      </>
    ),
  },
  {
    id: "weekly-template",
    heading: "Building a weekly template",
    content: (
      <>
        <p>
          Build one template and reuse it every week, rather than replanning from scratch each
          Sunday. Replanning is itself a form of procrastination, and a stable template means the
          decision of what to do at 4pm on a Tuesday has already been made.
        </p>
        <p className="mt-4">Four rules make a template hold up:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            <span className="font-medium">Work in blocks of 45 to 60 minutes</span>, with a real
            break between them. Blocks longer than that quietly turn into re-reading.
          </li>
          <li>
            <span className="font-medium">One subject per block.</span> Switching subjects inside a
            block costs you the first ten minutes twice.
          </li>
          <li>
            <span className="font-medium">Touch every subject weekly.</span> A subject you have not
            opened in three weeks takes far longer to restart than it would have taken to maintain.
          </li>
          <li>
            <span className="font-medium">Leave two blocks empty.</span> These are catch up blocks
            for the week that went wrong. In a week that went right, use them for past papers.
          </li>
        </ul>
        <Table
          head={["Slot", "Weeknight", "Saturday", "Sunday"]}
          rows={[
            ["Block 1", "Hardest subject, while you are freshest", "Past paper under timed conditions", "Review the week's notes"],
            ["Block 2", "Second subject, different from block 1", "Mark the paper honestly", "Weakest subject"],
            ["Block 3", "Homework and assessment work", "Catch up or rest", "Empty by design"],
          ]}
          caption="A template, not a prescription. Two blocks on a school night is a sustainable target."
        />
      </>
    ),
  },
  {
    id: "assessment-blocks",
    heading: "Planning around assessment blocks",
    content: (
      <>
        <p>
          Your school publishes an assessment schedule at the start of the year, and it is the single
          most useful document you will be given. Put every task on one calendar in week one, and
          look for the collisions: the fortnight with three tasks in it, the assignment that lands
          the week before a trial, the major work with a deadline you cannot move.
        </p>
        <p className="mt-4">
          Those collisions are where marks are lost, and they are visible months in advance. Working
          backwards from each one gives you a start date rather than a due date, and starting a task
          in the week it appears on the calendar rather than the week it is due is worth more than
          any amount of late night effort.
        </p>
        <p className="mt-4">
          In the two weeks before a heavy assessment block, shift the template deliberately. Reduce
          the number of subjects you touch, drop the general revision blocks, and put the hours where
          the marks are. The rest of the timetable can absorb that for a fortnight. It cannot absorb
          it for a term.
        </p>
      </>
    ),
  },
  {
    id: "exam-term",
    heading: "Adjusting in exam term",
    content: (
      <>
        <p>
          Once trials are behind you and content delivery has stopped, the timetable should change
          shape entirely. The daily rhythm of new material and homework is gone, and what replaces it
          is a cycle of practice and correction.
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            Sit past papers in the same time slot as the real exam where you can. Performing at 9am
            is a trainable skill.
          </li>
          <li>
            Mark everything against the marking guidelines, not against your memory of what you
            meant. The gap between the two is where the marks live.
          </li>
          <li>
            Keep a running list of every mistake, sorted by topic. After four papers, the list has
            become your study plan.
          </li>
          <li>
            Protect sleep harder than you protect study hours. Recall degrades faster from sleep loss
            than from one skipped block.
          </li>
        </ul>
        <p className="mt-4">
          Students often ask how many past papers is enough. A better question is how many you have
          properly corrected, because an uncorrected paper teaches you almost nothing. Three papers
          worked through carefully beats ten sat and filed away.
        </p>
        <p className="mt-4">
          If your marks are not moving despite the hours going in, that is usually a signal about
          method rather than effort, and it is worth a conversation with a teacher or tutor before
          you spend another month on the same approach.
        </p>
      </>
    ),
  },
];
