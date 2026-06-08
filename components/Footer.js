export function Footer() {
  return (
    <footer className="py-10" style={{ borderTop: "1px solid var(--line)", background: "var(--paper)" }}>
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center gap-2 text-[12.5px] text-slate-400">
        <span className="font-hand text-[26px] leading-none" style={{ fontWeight: 700 }}>
          <span style={{ color: "var(--ink-graphite)" }}>match</span>
          <span style={{ color: "var(--accent)" }}>tutor</span>
        </span>
        <span>© 2026 matchtutor. All rights reserved.</span>
      </div>
    </footer>
  );
}
