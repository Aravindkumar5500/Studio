import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio — Full-Stack AI Creation Platform",
  description:
    "Design, plan, visually inspect, and deploy Next.js applications with AI and direct-manipulation precision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-canvas text-foreground">{children}</body>
    </html>
  );
}
