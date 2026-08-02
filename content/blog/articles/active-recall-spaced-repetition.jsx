import { Callout } from "../prose";

export const meta = {
  slug: "active-recall-spaced-repetition",
  title: "Active recall and spaced repetition: the evidence-based way to study",
  excerpt:
    "Re-reading your notes feels like studying and mostly is not. Two techniques with decades of research behind them do the job better, and they take less time.",
  category: "Study skills",
  status: "published",
  publishedAt: "2026-05-21",
  updatedAt: null,
  author: {
    name: "Eric Chen",
    roleLine: "HSC tutor",
    avatar: null,
    initials: "EC",
    avatarBg: "#DCE9E4",
    tutorSlug: "eric-chen",
  },
  accent: { from: "#F1F0E9", to: "#DBE4D6", angle: 155 },
};

export const sections = [
  {
    id: "why-rereading-fails",
    heading: "Why re-reading feels productive but is not",
    content: (
      <>
        <p>
          Ask a room of Year 12 students how they revise and most will describe some version of
          reading through their notes. It is the intuitive approach, it fills the time, and it feels
          like it is working. That last part is the problem.
        </p>
        <p className="mt-4">
          When you re-read something, it becomes easier to read each time. Your brain interprets that
          growing ease as growing knowledge, which psychologists call the fluency illusion. But
          recognising material on the page is a much lower bar than producing it from an empty page
          in an exam room, and recognition is all that re-reading trains.
        </p>
        <p className="mt-4">
          The uncomfortable finding from the research is consistent: students who re-read rate
          themselves as better prepared than students who test themselves, and then perform worse.
          Confidence and competence come apart, and the method that feels best is the one that
          misleads you most.
        </p>
        <Callout title="The core idea">
          Studying should feel slightly difficult. Effort at the moment of retrieval is what builds a
          memory you can reach under exam conditions.
        </Callout>
      </>
    ),
  },
  {
    id: "active-recall",
    heading: "Active recall in practice",
    content: (
      <>
        <p>
          Active recall means retrieving information from memory rather than reviewing it in front of
          you. Every time you successfully pull something out of your head, the path back to it gets
          stronger. Reading it again does not have the same effect, because nothing was retrieved.
        </p>
        <p className="mt-4">In practice it looks like this:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            <span className="font-medium">Close the book first.</span> Write down everything you can
            remember about a topic on a blank page, then open your notes and mark the gaps in a
            different colour. The gaps are your study list.
          </li>
          <li>
            <span className="font-medium">Turn headings into questions.</span> A heading that reads
            &quot;Causes of the Great Depression&quot; becomes &quot;What were the causes of the
            Great Depression, and which mattered most?&quot; Answer it aloud before checking.
          </li>
          <li>
            <span className="font-medium">Use past paper questions as prompts</span> rather than as
            an end of term test. A question you cannot answer in week four is information, not
            failure.
          </li>
          <li>
            <span className="font-medium">Explain a concept to someone else.</span> Explaining is
            retrieval with an audience, and it exposes the parts you only thought you understood.
          </li>
        </ul>
        <p className="mt-4">
          Note that none of this requires flashcards. Flashcards are one convenient delivery
          mechanism for recall, particularly for definitions and vocabulary, but working a problem
          from scratch or writing a paragraph from memory is the same technique applied to material
          that does not fit on a card.
        </p>
      </>
    ),
  },
  {
    id: "spacing",
    heading: "Spacing your reviews",
    content: (
      <>
        <p>
          The second technique concerns when you study rather than how. Spaced repetition means
          revisiting material at increasing intervals instead of in one long session, and it
          consistently outperforms the same total time spent in a block.
        </p>
        <p className="mt-4">
          The reason is closely related to active recall. Reviewing something you have almost
          forgotten takes effort, and that effort is what strengthens the memory. Reviewing something
          you read an hour ago takes none, so it does very little. Cramming works for tomorrow and
          fails for the exam in eight weeks, which is exactly the wrong way round for Year 12.
        </p>
        <p className="mt-4">A workable schedule for new material:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>Review it the day you learn it, briefly.</li>
          <li>Again two or three days later.</li>
          <li>Again about a week later.</li>
          <li>Again a month later, and thereafter whenever it feels shaky.</li>
        </ul>
        <p className="mt-4">
          The intervals are not sacred. What matters is that they get longer, and that each review is
          a retrieval attempt rather than a re-read. Four short spaced reviews will beat one long
          session every time, and take less total time doing it.
        </p>
      </>
    ),
  },
  {
    id: "tools",
    heading: "Tools that do the scheduling for you",
    content: (
      <>
        <p>
          Tracking intervals by hand across six subjects becomes its own chore, which is why spaced
          repetition software exists. These programs show you a card, ask how difficult it was, and
          schedule the next appearance accordingly. Anki is the best known and is free on desktop;
          Quizlet and several others work on the same principle.
        </p>
        <p className="mt-4">Two cautions, both common failure modes:</p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            Making cards is not studying. An afternoon spent building a beautiful deck can produce
            zero retrievals. Make cards quickly and plainly, then use them.
          </li>
          <li>
            Cards suit facts, definitions, formulas and vocabulary. They do not suit essay structure,
            extended problem solving or source analysis. Those need practice under realistic
            conditions, spaced in the same way but not on cards.
          </li>
        </ul>
        <p className="mt-4">
          A paper system works fine too. A box of index cards sorted into daily, weekly and monthly
          sections does the same job with no screen involved, and some students concentrate better
          for it.
        </p>
      </>
    ),
  },
  {
    id: "routine",
    heading: "Combining both into a routine",
    content: (
      <>
        <p>
          The two techniques are designed to be used together, and the combination fits neatly into a
          normal school week.
        </p>
        <ul className="mt-3 list-disc pl-6 space-y-1.5">
          <li>
            <span className="font-medium">On the day content is taught</span>, spend ten minutes
            closing the book and writing what you remember. This is your first retrieval and it is
            the cheapest one you will ever do.
          </li>
          <li>
            <span className="font-medium">Once a week</span>, revisit the previous two or three weeks
            using questions rather than notes, and log what you could not produce.
          </li>
          <li>
            <span className="font-medium">Once a month</span>, sit a section of a past paper on older
            material under timed conditions, then correct it against the marking guidelines.
          </li>
          <li>
            <span className="font-medium">Always</span>, keep the running list of what you got wrong.
            That list, not the textbook, is what you revise before an assessment.
          </li>
        </ul>
        <p className="mt-4">
          Expect this to feel worse than re-reading for the first fortnight. You will get things
          wrong out loud and repeatedly, which is unpleasant and is also the entire point. The
          students who push through that fortnight generally report the same thing: they study fewer
          hours than they used to and remember considerably more.
        </p>
      </>
    ),
  },
];
