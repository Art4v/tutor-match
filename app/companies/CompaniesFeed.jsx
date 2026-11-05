// The /companies results list. Plain rows separated by rules (DESIGN.md): no
// card gaps, no staggered fade-in.
export function CompaniesFeed({ children }) {
  return <ul className="flex flex-col border-t border-rule">{children}</ul>;
}

export function CompaniesFeedItem({ children }) {
  return <li className="border-b border-rule">{children}</li>;
}
