import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { TopNav } from "@/components/TopNav";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import PolicyConsentGate from "@/components/PolicyConsentGate";

const SITE_URL = "https://www.matchtutor.com.au";
const SITE_DESCRIPTION =
  "A directory for high school students looking for serious, verified tutors across Australia.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "matchtutor — verified tutors across Australia",
    template: "%s · matchtutor",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "matchtutor",
    title: "matchtutor — verified tutors across Australia",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: "matchtutor — verified tutors across Australia",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600&family=Caveat:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SmoothScrollProvider>
          <TopNav />
          {/* The nav is fixed (out of flow), so reserve its height here. The home
              hero cancels this with a negative margin to go full-bleed. */}
          <div style={{ paddingTop: "var(--nav-h)" }}>{children}</div>
          <PolicyConsentGate />
        </SmoothScrollProvider>
        <Analytics />
      </body>
    </html>
  );
}
