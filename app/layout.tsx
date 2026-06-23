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
      <body>{children}</body>
    </html>
  );
}
