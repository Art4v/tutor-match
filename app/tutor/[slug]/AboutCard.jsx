import { parseRichTextBlocks, RichTextBlock } from "@/components/RichText";
import { Section } from "./ProfileCards";

// The tutor's long bio as a flat section, in the reading width (DESIGN.md §3).
export function AboutCard({ text }) {
  const blocks = parseRichTextBlocks(text);
  return (
    <Section id="about" title="About">
      <div className="max-w-[65ch] text-[16px] leading-6 text-[color:var(--text)]">
        {blocks.map((b, idx) => (
          <div key={idx} className="mb-4 last:mb-0">
            <RichTextBlock block={b} idx={idx} />
          </div>
        ))}
      </div>
    </Section>
  );
}
