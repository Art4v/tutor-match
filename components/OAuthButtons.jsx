"use client";

// Social sign-in. Google is wired to Supabase OAuth (PKCE): the button kicks
// off signInWithOAuth, Supabase bounces through Google and back to
// /auth/callback, which exchanges the code for a session. Microsoft is
// still a disabled placeholder ("Soon") until we enable that provider.

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function OAuthButtons({ divider = "bottom", next = "/settings" }) {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser is already navigating to Google; only reset on error.
    if (error) setLoading(false);
  };

  return (
    <div className="space-y-2.5">
      {divider === "top" && <Divider label="or use a social account" />}
      <ProviderButton
        label={loading ? "Redirecting…" : "Continue with Google"}
        glyph={<GoogleGlyph />}
        onClick={signInWithGoogle}
        loading={loading}
      />
      <ProviderButton label="Continue with Microsoft" glyph={<MicrosoftGlyph />} disabled />
      {divider === "bottom" && <Divider label="or continue with email" />}
    </div>
  );
}

function ProviderButton({ label, glyph, onClick, disabled = false, loading = false }) {
  const inactive = disabled || loading;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={inactive}
      className="relative w-full inline-flex items-center justify-center font-medium transition-colors"
      style={{
        height: 42,
        background: "#fff",
        color: disabled ? "#94A3B8" : "#334155",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        fontSize: 14,
        letterSpacing: "-0.005em",
        cursor: inactive ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : loading ? 0.85 : 1,
      }}
      title={disabled ? "Coming soon" : undefined}
      aria-disabled={inactive}
    >
      <span
        style={{
          position: "absolute",
          left: 14,
          display: "inline-flex",
          filter: disabled ? "grayscale(0.35)" : "none",
        }}
      >
        {glyph}
      </span>
      <span>{label}</span>
      {disabled && (
        <span
          style={{
            position: "absolute",
            right: 12,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#94A3B8",
            background: "#F1F5F9",
            border: "1px solid #E2E8F0",
            borderRadius: 999,
            padding: "2px 7px",
            lineHeight: 1.2,
          }}
        >
          Soon
        </span>
      )}
    </button>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-0.5" aria-hidden>
      <div className="h-px flex-1" style={{ background: "#E5E7EB" }} />
      <span className="text-[11.5px] uppercase tracking-wider text-slate-400">{label}</span>
      <div className="h-px flex-1" style={{ background: "#E5E7EB" }} />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.8595-3.0477.8595-2.3441 0-4.3282-1.5832-5.0359-3.7104H.9573v2.3318C2.4382 15.9831 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1731 0 7.5477 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.9641 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="8.5" height="8.5" fill="#F25022" />
      <rect x="9.5" y="0" width="8.5" height="8.5" fill="#7FBA00" />
      <rect x="0" y="9.5" width="8.5" height="8.5" fill="#00A4EF" />
      <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#FFB900" />
    </svg>
  );
}
