// Shared column for every auth screen (REDESIGN_DECISIONS.md item 8): a plain
// 400px form on the white page, no card. Phones get the full width with 16px
// gutters.
export default function AuthLayout({ children }) {
  return (
    <div className="bg-surface px-4 pt-12 pb-16">
      <div className="w-full max-w-[400px] mx-auto">{children}</div>
    </div>
  );
}
