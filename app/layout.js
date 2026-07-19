import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { TopNav } from "@/components/TopNav";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { SiteFooter } from "@/components/SiteFooter";
import PolicyConsentGate from "@/components/PolicyConsentGate";
import VerificationPrompt from "@/components/VerificationPrompt";
import { SavedTutorsProvider } from "@/components/SavedTutorsProvider";

const SITE_URL = "https://www.matchtutor.com.au";
const SITE_DESCRIPTION =
  "A directory for high school students looking for serious, verified tutors across Australia.";

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
        {/* General Sans (body + headings) is Fontshare-only, not on Google
            Fonts, so it needs its own origin. Caveat stays on Google Fonts and
            is used only for small accents (hero subject word, eyebrows, step
            numbers). */}
        {/* The stylesheet is served by api.fontshare.com but the woff2 files it
            points at live on cdn.fontshare.com, so both origins get a
            preconnect (otherwise the fonts stall on a cold connection). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SmoothScrollProvider>
          {/* Saved-tutors state is shared across every TutorCard + the profile
              banner + the /browse "Saved" filter, so load it once here. */}
          <SavedTutorsProvider>
            <TopNav />
            {/* The nav is fixed (out of flow), so reserve its height here. The home
                hero cancels this with a negative margin to go full-bleed. */}
            <div style={{ paddingTop: "var(--nav-h)" }}>{children}</div>
            <SiteFooter />
            <PolicyConsentGate />
            <VerificationPrompt />
          </SavedTutorsProvider>
        </SmoothScrollProvider>
        <Analytics />
      </body>
    </html>
  );
}
