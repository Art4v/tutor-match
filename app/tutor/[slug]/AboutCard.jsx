import { parseRichTextBlocks, RichTextBlock } from "@/components/RichText";
import { cardStyle } from "./ProfileCards";

export function AboutCard({ text }) {
  const blocks = parseRichTextBlocks(text);
  return (
    <section
      id="about"
      className="bg-[color:var(--paper-card)]"
      style={{ ...cardStyle, padding: "20px 24px" }}
    >
      <h2 className="text-[22px] font-light text-slate-800 tracking-tight mb-4">About</h2>
      <div className="text-[15.5px] leading-[1.72] max-w-[70ch]" style={{ color: "var(--ink)" }}>
        {blocks.map((b, idx) => (
          <div key={idx} className="mb-3 last:mb-0">
            <RichTextBlock block={b} idx={idx} />
          </div>
        ))}
      </div>
    </section>
  );
}
