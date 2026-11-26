import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Studio — AI App Studio",
  description:
    "Plan, design, code, and ship full-stack Next.js applications with a team of specialized AI agents.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("studio_theme");var c=t==="dark"?"dark":"light";var r=document.documentElement;r.classList.remove("light","dark");r.classList.add(c);r.style.colorScheme=c;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased bg-canvas text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
