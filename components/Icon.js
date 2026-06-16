export function Icon({ name, size = 16, className = "", strokeWidth = 1.75 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };
  switch (name) {
    case "tree": return <svg {...props}><path d="M12 3.2C13.6 3.2 14.8 4.3 14.9 5.7 16.7 5.4 18.3 6.7 18 8.5 19.4 9.3 19.5 11.3 18.1 12.3 18.4 13.9 16.9 15.1 15.3 14.6 14.6 15.6 13 15.8 12 15.1 11 15.8 9.4 15.6 8.7 14.6 7.1 15.1 5.6 13.9 5.9 12.3 4.5 11.3 4.6 9.3 6 8.5 5.7 6.7 7.3 5.4 9.1 5.7 9.2 4.3 10.4 3.2 12 3.2Z"/><path d="M12 21V8"/><path d="M12 12 9.2 9.8"/><path d="m12 10.8 2.6-2"/></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "check": return <svg {...props}><path d="M20 6 9 17l-5-5"/></svg>;
    case "check-circle": return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>;
    case "check-badge": return <svg {...props}><path d="M12 2 14.6 4.4 17.9 3.7 18.9 6.9 22 8.2 20.9 11.4 22 14.6 18.9 16 17.9 19.2 14.6 18.5 12 21 9.4 18.5 6.1 19.2 5.1 16 2 14.6 3.1 11.4 2 8.2 5.1 6.9 6.1 3.7 9.4 4.4Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "chevron-right": return <svg {...props}><path d="m9 18 6-6-6-6"/></svg>;
    case "chevron-down": return <svg {...props}><path d="m6 9 6 6 6-6"/></svg>;
    case "chevron-left": return <svg {...props}><path d="m15 18-6-6 6-6"/></svg>;
    case "map-pin": return <svg {...props}><path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
    case "globe": return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>;
    case "message": return <svg {...props}><path d="M21 12c0 4.4-4 8-9 8a10 10 0 0 1-4-.8L3 21l1.3-4A7.5 7.5 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8Z"/></svg>;
    case "bell": return <svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
    case "send": return <svg {...props}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>;
    case "bookmark": return <svg {...props}><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-4 7 4Z"/></svg>;
    case "bookmark-fill": return <svg {...props} fill="currentColor"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-4 7 4Z"/></svg>;
    case "star": return <svg {...props} fill="currentColor" stroke="none"><path d="M12 2.5l2.9 6.3 6.6.6-5 4.5 1.5 6.6L12 17l-6 3.5 1.5-6.6-5-4.5 6.6-.6Z"/></svg>;
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
    case "user": return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "users": return <svg {...props}><path d="M16 21a6 6 0 0 0-12 0"/><circle cx="10" cy="7" r="4"/><path d="M22 21a6 6 0 0 0-4.5-5.8"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>;
    case "phone": return <svg {...props}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3 19.4 19.4 0 0 1-6-6 19.7 19.7 0 0 1-3-8.6A2 2 0 0 1 4.1 2H7a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.9 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2-.5 13 13 0 0 0 2.7.6 2 2 0 0 1 1.7 2Z"/></svg>;
    case "alert-triangle": return <svg {...props}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
    case "shield": return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>;
    case "shield-check": return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case "id-card": return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M13 10h5M13 14h5M5 17a4 4 0 0 1 8 0"/></svg>;
    case "graduation":
    case "atar": return <svg {...props}><path d="m22 10-10-5L2 10l10 5 10-5Z"/><path d="M6 12v5a6 6 0 0 0 12 0v-5"/></svg>;
    case "briefcase": return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></svg>;
    case "trending-up": return <svg {...props}><path d="m22 7-9 9-4-4-7 7"/><path d="M16 7h6v6"/></svg>;
    case "sparkle": return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case "x": return <svg {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case "sliders": return <svg {...props}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/></svg>;
    case "external": return <svg {...props}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>;
    case "language": return <svg {...props}><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>;
    case "trophy": return <svg {...props}><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 5V3h12v2"/><path d="M6 5v6a6 6 0 0 0 12 0V5"/><path d="M10 17h4v4h-4z"/></svg>;
    case "dot": return <svg {...props} fill="currentColor" stroke="none"><circle cx="12" cy="12" r="4"/></svg>;
    case "filter": return <svg {...props}><path d="M3 5h18l-7 9v6l-4-2v-4Z"/></svg>;
    case "more": return <svg {...props}><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>;
    case "arrow-right": return <svg {...props}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
    case "arrow-up-right": return <svg {...props}><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>;
    case "plus": return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "chevron-up": return <svg {...props}><path d="m6 15 6-6 6 6"/></svg>;
    case "trash": return <svg {...props}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m5 6 1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/><path d="M10 11v6M14 11v6"/></svg>;
    case "grip": return <svg {...props} fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>;
    case "lock": return <svg {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case "eye": return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "upload": return <svg {...props}><path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/></svg>;
    case "image": return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>;
    case "bold": return <svg {...props}><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>;
    case "italic": return <svg {...props}><path d="M19 4h-9M14 20H5M15 4 9 20"/></svg>;
    case "list": return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case "list-ordered": return <svg {...props}><path d="M10 6h11M10 12h11M10 18h11M4 6V4l-1 .5M4 10H3h2M6 18H4c0-1 2-1.5 2-2.5S5 14 4 14.5"/></svg>;
    case "smile": return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>;
    // Stationery accents (study-desk theme). Faint floating motifs on the
    // desk backdrop — hand-authored to match the 24×24 stroke set.
    case "pencil": return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
    case "eraser": return <svg {...props}><path d="m7 21-4.3-4.3a1.6 1.6 0 0 1 0-2.3l9.7-9.7a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3L13 21"/><path d="M22 21H7"/><path d="m5 13 6 6"/></svg>;
    case "ruler": return <svg {...props}><path d="M21.3 15.3a1.7 1.7 0 0 1 0 2.4l-3.6 3.6a1.7 1.7 0 0 1-2.4 0L2.7 8.7a1.7 1.7 0 0 1 0-2.4l3.6-3.6a1.7 1.7 0 0 1 2.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>;
    case "paperclip": return <svg {...props}><path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6A4 4 0 0 1 18 8.8l-8.6 8.6a2 2 0 0 1-2.8-2.9l8.5-8.4"/></svg>;
    case "scissors": return <svg {...props}><circle cx="6" cy="6" r="3"/><path d="M8.1 8.1 12 12"/><path d="M20 4 8.1 15.9"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>;
    case "set-square": return <svg {...props}><path d="M5 4v16h16Z"/><path d="M9 16h2"/><path d="M9 13h5"/><path d="M9 10h8"/></svg>;
    case "notebook": return <svg {...props}><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M16 3v18"/><path d="M2 7h3"/><path d="M2 12h3"/><path d="M2 17h3"/></svg>;
    // Botanical accents (study-journal theme). A leafy sprig — a curved stem
    // with a few paired leaves — used as the faint corner mark on cards/hero.
    case "leaf": return <svg {...props}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2.5 1.5 5.5 1.5 8.5A8.5 8.5 0 0 1 11 20Z"/><path d="M2 21c0-3 1.85-6.36 5.5-8.5"/></svg>;
    case "sprig": return <svg {...props}><path d="M12 22V8"/><path d="M12 13c0-2.5 2-4.5 5-5 0 2.8-2 5-5 5Z"/><path d="M12 9C12 6.8 10.2 5 7.5 4.5 7.5 7 9.4 9 12 9Z"/><path d="M12 16c0-2.2 1.8-4 4.3-4.4 0 2.4-1.9 4.4-4.3 4.4Z"/></svg>;
    default: return null;
  }
}
