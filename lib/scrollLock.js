// Shared scroll lock for full-screen modals. Scrolling is native (no
// smooth-scroll layer), so toggling CSS `overflow: hidden` on the root is
// enough to freeze the page while a modal is open.

export function lockScroll() {
  if (typeof document === "undefined") return;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}
