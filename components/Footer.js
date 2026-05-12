export function Footer() {
  const cols = [
    { h: "For students", items: ["Browse tutors", "How it works", "Subjects", "Pricing"] },
    { h: "For tutors", items: ["Become a tutor", "Tutor handbook", "Set your rate", "Get verified"] },
    { h: "Company", items: ["About", "Trust & safety", "Contact", "Press"] },
  ];
  return (
    <footer className="mt-24 py-12" style={{ borderTop: "1px solid #E5E7EB" }}>
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-8 text-[13.5px]">
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-[12px]" style={{ background: "#0F172A" }}>tm</div>
            <span className="text-[14px] font-semibold text-slate-900">tutormatch</span>
          </div>
          <p className="text-slate-500 mt-3 max-w-xs leading-relaxed">
            A directory for high school students looking for serious, verified tutors across Australia.
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.h}>
            <div className="text-slate-900 font-semibold mb-3">{col.h}</div>
            <ul className="space-y-2 text-slate-500">
              {col.items.map((i) => <li key={i} className="hover:text-slate-900 cursor-pointer">{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-[1200px] mx-auto px-6 mt-12 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[12.5px] text-slate-400" style={{ borderTop: "1px solid #F1F5F9" }}>
        <span>© 2026 tutormatch. All rights reserved.</span>
        <div className="flex gap-5">
          <span className="hover:text-slate-900 cursor-pointer">Terms</span>
          <span className="hover:text-slate-900 cursor-pointer">Privacy</span>
          <span className="hover:text-slate-900 cursor-pointer">Cookies</span>
        </div>
      </div>
    </footer>
  );
}
