export function Footer() {
  return (
    <footer className="py-8" style={{ borderTop: "1px solid #E5E7EB" }}>
      <div className="max-w-[1200px] mx-auto px-6 flex justify-end text-[12.5px] text-slate-400">
        <span>
          © 2026{" "}
          <span style={{ fontWeight: 500 }}>
            <span className="text-slate-500">match</span>
            <span style={{ color: "var(--accent)" }}>tutor</span>
          </span>
          . All rights reserved.
        </span>
      </div>
    </footer>
  );
}
