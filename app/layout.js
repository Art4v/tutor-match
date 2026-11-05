import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import PolicyConsentGate from "@/components/PolicyConsentGate";
import VerificationPrompt from "@/components/VerificationPrompt";
import { SavedTutorsProvider } from "@/components/SavedTutorsProvider";
import { RouteLoadingProvider } from "@/components/RouteLoadingProvider";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MatchTutor",
    template: "MatchTutor · %s",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "MatchTutor",
    title: "MatchTutor · verified tutors across Australia",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: "MatchTutor · verified tutors across Australia",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* DESIGN.md: Source Sans 3 is the only web font, at 400 and 600. The
            logo wordmark is an SVG (components/Logo.jsx), so it needs no font. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* Saved-tutors state is shared across every TutorCard + the profile
            banner + the /browse "Saved" filter, so load it once here. */}
        <SavedTutorsProvider>
          {/* Route-loading overlay: intercepts internal link clicks and hosts
              the blur + spinner shown while slow navigations resolve. */}
          <RouteLoadingProvider>
            <TopNav />
            {/* The nav is fixed (out of flow), so reserve its height here. The home
                hero cancels this with a negative margin to go full-bleed. */}
            <div style={{ paddingTop: "var(--nav-h)" }}>{children}</div>
            <SiteFooter />
            <PolicyConsentGate />
            <VerificationPrompt />
          </RouteLoadingProvider>
        </SavedTutorsProvider>
        <Analytics />
      </body>
    </html>
  );
}
