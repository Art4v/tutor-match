import "./globals.css";
import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "tutormatch",
  description: "A directory for high school students looking for serious, verified tutors across Australia.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
