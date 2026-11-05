// A plain column wrapper. It used to stagger a fade-in across the profile's
// cards; DESIGN.md allows no entrance animation, so it now only renders its
// children inside the requested element. Kept (rather than inlined) so the
// profile and owner views keep one call shape. `delayChildren` is accepted and
// ignored for the same reason.
export function RevealStack({ children, className, as = "div" }) {
  const Comp = as;
  return <Comp className={className}>{children}</Comp>;
}
