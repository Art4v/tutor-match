"use client";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { StaggerChildren, RevealItem } from "@/components/anim/CardReveal";
import { parseRichTextBlocks, RichTextBlock } from "@/components/RichText";

export function AboutCard({ text }) {
  const blocks = parseRichTextBlocks(text);
  return (
    <SectionReveal
      as="section"
      id="about"
      hover
      className="bg-[color:var(--paper-card)]"
      style={{ border: "1px solid var(--paper-line)", borderRadius: 16, padding: 24 }}
    >
      <StaggerChildren delay={0.2} step={0.1} className="text-[15px] text-slate-600 leading-[1.6]">
        <RevealItem className="mb-5">
          <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight">About</h2>
        </RevealItem>
        {blocks.map((b, idx) => (
          <RevealItem key={idx} className="mb-3 last:mb-0">
            <RichTextBlock block={b} idx={idx} />
          </RevealItem>
        ))}
      </StaggerChildren>
    </SectionReveal>
  );
}
