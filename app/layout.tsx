import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoSEO — Advance SEO aur Marketing, Ek Jagah",
  description:
    "Website, YouTube, aur Facebook ke liye AI-powered SEO aur marketing content — sirf woh cheez connect karein jo aapke pass hai.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
