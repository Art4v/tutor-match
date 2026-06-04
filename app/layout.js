import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { TopNav } from "@/components/TopNav";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";

export const metadata = {
  title: "matchtutor",
  description: "A directory for high school students looking for serious, verified tutors across Australia.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,500;1,600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SmoothScrollProvider>
          <TopNav />
          {children}
        </SmoothScrollProvider>
        <Analytics />
      </body>
    </html>
  );
}
