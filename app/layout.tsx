import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transcript GPA Calculator",
  description: "Upload a transcript, get per-term and cumulative GPA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: some browser extensions inject attributes
          (e.g. cz-shortcut-listen) onto <body> before React hydrates. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
