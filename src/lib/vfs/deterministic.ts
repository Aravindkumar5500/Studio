import type { DesignSystem } from "@/lib/ai/schemas";

export function buildDeterministicTokens(designSystem: DesignSystem): string {
  return `// Design system tokens generated deterministically from project theme.
export const tokens = ${JSON.stringify(designSystem, null, 2)} as const;

export const colors = tokens.colors;
export const typography = tokens.typography;
export const radius = tokens.radius;
export const shadows = tokens.shadows;
`;
}

export function buildDeterministicGlobalsCss(designSystem?: DesignSystem): string {
  const bg = designSystem?.colors?.background || "#09090b";
  const fg = designSystem?.colors?.foreground || "#f8fafc";
  const primary = designSystem?.colors?.primary || "#10b981";
  const surface = designSystem?.colors?.surface || "#18181b";
  const border = designSystem?.colors?.border || "#27272a";

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-background: ${bg};
    --color-foreground: ${fg};
    --color-surface: ${surface};
    --color-primary: ${primary};
    --color-border: ${border};
  }
  html, body, #root {
    min-height: 100%;
  }
  body {
    margin: 0;
    font-family: 'Geist', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    background-color: var(--color-background, ${bg});
    color: var(--color-foreground, ${fg});
    -webkit-font-smoothing: antialiased;
  }
}
`;
}

export function buildDeterministicLayout(productName = "Studio App"): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${productName}",
  description: "Built with Studio AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
`;
}

export function getDeterministicSetupFiles(
  productName: string,
  designSystem: DesignSystem,
): { filePath: string; content: string }[] {
  return [
    {
      filePath: "src/theme/tokens.ts",
      content: buildDeterministicTokens(designSystem),
    },
    {
      filePath: "src/app/globals.css",
      content: buildDeterministicGlobalsCss(designSystem),
    },
    {
      filePath: "src/app/layout.tsx",
      content: buildDeterministicLayout(productName),
    },
  ];
}

