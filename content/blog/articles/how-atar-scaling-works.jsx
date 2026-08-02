import { Callout } from "../prose";

export const meta = {
  slug: "how-atar-scaling-works",
  title: "How ATAR scaling actually works (and what it means for your subject choices)",
  excerpt:
    "Scaling is the most misunderstood part of the HSC. Here is what it really does, why no subject hands out free marks, and how much it should influence what you pick in Year 11.",
  category: "ATAR",
  status: "published",
  publishedAt: "2026-02-10",
  updatedAt: "2026-06-05",
  author: {
    name: "Aarav Bhatt",
    roleLine: "HSC tutor",
    avatar: null,
    initials: "AB",
    avatarBg: "#D7E8E6",
    tutorSlug: "aarav-bhatt",
  },
  accent: { from: "#E7F2F1", to: "#C9E2DF", angle: 150 },
};

export const sections = [
  {
    id: "what-the-atar-measures",
    heading: "What the ATAR actually measures",
    content: (
      <>
        <p>
          The first thing to understand is that the ATAR is not a mark. It is a rank. Your ATAR
          reports where you sit relative to everyone in your age group, including the students who
          left school before Year 12. It is reported on a scale from 0 to 99.95 in steps of 0.05,
          and an ATAR of 85.00 means you performed better than roughly 85 percent of your age
          cohort.
        </p>
        <p className="mt-4">
          This distinction matters more than almost anything else in this article. A mark can be
          improved by everyone at once. A rank cannot. If the whole state gets better at Chemistry
          next year, the marks go up and the ranks stay exactly where they are. When students talk
          about &quot;chasing the ATAR&quot;, what they are really chasing is a position relative to
          other people, which is why the strategy that works is doing well in the subjects you
          actually sit rather than hunting for a shortcut.
        </p>
        <Callout title="In short">
          Marks measure what you know. The ATAR measures where you finished compared with everyone
          else your age. Every rule below follows from that one idea.
        </Callout>
      </>
    ),
  },
  {
    id: "building-your-aggregate",
    heading: "How your aggregate is built",
    content: (
      <>
        <p>
          Before any ranking happens, the University Admissions Centre builds an aggregate out of
          your scaled marks. In New South Wales that aggregate uses your best 10 units, and the
          selection is not entirely free:
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>Two units of English are always included, whether or not they are among your best.</li>
          <li>The remaining eight units are your strongest, measured after scaling.</li>
          <li>At most two units of Category B courses can count towards the aggregate.</li>
          <li>A course only counts if you completed it and sat the examination.</li>
        </ul>
        <p className="mt-4">
          Because English is compulsory in the aggregate, it is the one subject where a weak result
          cannot be quietly dropped. Students who carry a strong Advanced English mark start every
          calculation slightly ahead of students who do not, which is why it is usually the highest
          leverage subject on a Year 12 timetable.
        </p>
        <p className="mt-4">
          The aggregate itself is a number out of 500, and it is never published. What you receive is
          the rank that number produces once every student in the state has been placed in order.
        </p>
      </>
    ),
  },
  {
    id: "scaling-explained",
    heading: "Scaling, explained without the myths",
    content: (
      <>
        <p>
          Scaling exists to solve one problem: different subjects attract different students. If the
          strongest candidates in the state cluster in one course, then a mark of 80 in that course
          represents more academic achievement than a mark of 80 in a course taken mostly by
          students who are struggling elsewhere. Comparing the two raw marks directly would be
          unfair to the first group.
        </p>
        <p className="mt-4">
          To correct for that, each course is scaled according to the measured strength of the people
          who took it, and that strength is estimated from how those same students performed across
          every other course they sat. Nobody at UAC decides that Physics deserves a bonus. The
          candidature decides it, every year, by how it performs everywhere else.
        </p>
        <p className="mt-4">Three consequences fall out of that, and all three are routinely missed:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            Scaling is recalculated annually. A course that scaled generously three years ago is not
            guaranteed to do so when you sit it.
          </li>
          <li>
            Scaling moves the whole course, not you personally. Sitting a strongly scaled subject
            while finishing near the bottom of it does not help you, because you are scaled from
            where you finished.
          </li>
          <li>
            Weakly scaled subjects are not a trap. A student who tops a course with modest scaling
            can finish well ahead of a student who scrapes through a strongly scaled one.
          </li>
        </ul>
        <p className="mt-4">
          The clearest way to think about it: scaling adjusts for the company you keep, and your own
          rank inside that company is still the thing being adjusted.
        </p>
      </>
    ),
  },
  {
    id: "subject-choices",
    heading: "Should scaling change your subject choices?",
    content: (
      <>
        <p>
          A little, and much less than most Year 10 students are told. The honest ordering of what
          matters when choosing subjects looks like this:
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            <span className="font-medium">Prerequisites first.</span> If a degree you are considering
            requires Mathematics Advanced or a science, that requirement is not negotiable and no
            scaling argument outranks it.
          </li>
          <li>
            <span className="font-medium">Then genuine capability.</span> You will do two years of
            work in these courses. The subject you can sustain effort in beats the subject that looks
            good on a scaling table.
          </li>
          <li>
            <span className="font-medium">Then interest.</span> Motivation across an 18 month
            assessment cycle is worth more marks than any structural advantage.
          </li>
          <li>
            <span className="font-medium">Then scaling.</span> Use it to break a tie between two
            courses you would be roughly equally good at, and for nothing else.
          </li>
        </ul>
        <p className="mt-4">
          The failure case is common enough to have a shape. A student picks a demanding, strongly
          scaled subject purely for the scaling, finds the workload heavier than expected, loses
          time from every other course to keep up, and ends with four results that are slightly
          worse instead of one that is slightly better. The aggregate does not forgive that trade.
        </p>
        <p className="mt-4">
          There is one genuine exception. If you are deciding between two levels of the same subject,
          such as Mathematics Advanced and Mathematics Standard, look carefully at how you are
          tracking in Year 10. The higher course rewards students who can hold their position in it,
          and punishes students who cannot, more sharply than most other choices on the list.
        </p>
      </>
    ),
  },
  {
    id: "key-takeaways",
    heading: "Key takeaways",
    content: (
      <>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>The ATAR is a rank against your age cohort, not a mark, and not a score out of 100.</li>
          <li>
            Your aggregate uses your best 10 units, and two units of English are always among them.
          </li>
          <li>
            Scaling reflects the strength of everyone who sat the course, is recalculated every year,
            and never rescues a poor position inside the course.
          </li>
          <li>
            Choose subjects on prerequisites, capability and interest. Let scaling settle a tie and
            nothing more.
          </li>
          <li>
            Finishing near the top of a subject you are good at is the most reliable ATAR strategy
            there is, and it has been for as long as the system has existed.
          </li>
        </ul>
        <p className="mt-4">
          If you want a second opinion on a subject list before you lock it in, a tutor who has
          taught the course recently will usually tell you in one conversation what a scaling table
          cannot.
        </p>
      </>
    ),
  },
];
