"use client";

// Social sign-in. Google is wired to Supabase OAuth (PKCE): the button kicks
// off signInWithOAuth and Supabase redirects back to /auth/callback?next=…,
// where exchangeCodeForSession mints the session.

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function OAuthButtons({ divider = "bottom", next = "/profile" }) {
  // Holds the provider currently redirecting ("google"), so only the clicked
  // button shows its loading state.
  const [loadingProvider, setLoadingProvider] = useState(null);

  const signInWithProvider = async (provider) => {
    setLoadingProvider(provider);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser navigates to the provider, so we only land here on error.
    if (error) setLoadingProvider(null);
  };

  return (
    <div className="space-y-2.5">
      {divider === "top" && <Divider label="or use a social account" />}
      <ProviderButton
        label={loadingProvider === "google" ? "Redirecting…" : "Continue with Google"}
        glyph={<GoogleGlyph />}
        onClick={() => signInWithProvider("google")}
        loading={loadingProvider === "google"}
      />
      {divider === "bottom" && <Divider label="or continue with email" />}
    </div>
  );
}

function ProviderButton({ label, glyph, onClick, disabled = false, loading = false }) {
  if (disabled) {
    return (
      <div
        className="relative w-full inline-flex items-center justify-center font-medium"
        style={{
          height: 42,
          background: "var(--paper-card)",
          color: "var(--sage)",
          border: "1px solid var(--paper-line)",
          borderRadius: 8,
          fontSize: 14,
          letterSpacing: "-0.005em",
          cursor: "not-allowed",
          opacity: 0.75,
        }}
        title="Coming soon"
        aria-disabled="true"
      >
        <span style={{ position: "absolute", left: 14, display: "inline-flex", filter: "grayscale(0.35)" }}>
          {glyph}
        </span>
        <span>{label}</span>
        <span
          style={{
            position: "absolute",
            right: 12,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--sage)",
            background: "var(--desk)",
            border: "1px solid var(--paper-line)",
            borderRadius: 999,
            padding: "2px 7px",
            lineHeight: 1.2,
          }}
        >
          Soon
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="relative w-full inline-flex items-center justify-center font-medium transition-colors"
      style={{
        height: 42,
        background: "var(--paper-card)",
        color: "var(--ink-muted)",
        border: "1px solid var(--paper-line)",
        borderRadius: 8,
        fontSize: 14,
        letterSpacing: "-0.005em",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.8 : 1,
      }}
    >
      <span style={{ position: "absolute", left: 14, display: "inline-flex" }}>{glyph}</span>
      <span>{label}</span>
    </button>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-0.5" aria-hidden>
      <div className="h-px flex-1" style={{ background: "var(--paper-line)" }} />
      <span className="text-[11.5px] uppercase tracking-wider text-slate-400">{label}</span>
      <div className="h-px flex-1" style={{ background: "var(--paper-line)" }} />
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
