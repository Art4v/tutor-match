// Shared scroll lock for full-screen modals. The app runs an inertial Lenis
// smooth-scroll layer (components/SmoothScrollProvider) that intercepts wheel
// events, so toggling CSS `overflow: hidden` alone doesn't stop scrolling on
// desktop — Lenis must be paused too. SmoothScrollProvider registers its Lenis
// instance here (or null when disabled on mobile / reduced-motion), and modals
// call lock()/unlock() while open.

let lenis = null;

export function registerLenis(instance) {
  lenis = instance;
}

export function lockScroll() {
  if (typeof document === "undefined") return;
  lenis?.stop();
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  lenis?.start();
}
