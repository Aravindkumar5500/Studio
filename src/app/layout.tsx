import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio — Build with intention",
  description: "Plan, generate, refine, and ship real applications in one thoughtful workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try { const theme = localStorage.getItem("studio_theme") || "light"; document.documentElement.classList.remove("light","dark"); document.documentElement.classList.add(theme === "dark" ? "dark" : "light"); } catch (_) {}` }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
