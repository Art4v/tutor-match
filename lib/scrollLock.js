// Shared scroll lock for full-screen modals. Scrolling is native (no
// smooth-scroll layer), so toggling CSS `overflow: hidden` on the root is
// enough to freeze the page while a modal is open.
//
// REFERENCE COUNTED, because modals stack: the reviews list opens the edit form
// on top of itself, and both lock. Without a count the inner modal's unmount
// would clear the lock while the outer one is still open, letting the page
// scroll behind it. Balanced lock/unlock pairs behave exactly as before.

let depth = 0;

export function lockScroll() {
  if (typeof document === "undefined") return;
  depth += 1;
  if (depth > 1) return; // already locked by an outer modal
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  // Floor at 0 so a stray unlock can't put the count into debt and wedge the
  // page unscrollable on the next lock.
  depth = Math.max(0, depth - 1);
  if (depth > 0) return; // an outer modal still wants it locked
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
