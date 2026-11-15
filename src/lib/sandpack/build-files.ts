import { INSPECTOR_RUNTIME } from "./runtime";
import { stampStudioIds } from "@/lib/patch/studio-id";
import { repairSourceCode } from "@/modules/code-integrity";

/**
 * Converts the Next.js App Router VFS into a bundle the Sandpack react-ts
 * runtime can execute: `@/` aliases become absolute paths, the App Router page
 * becomes the root component, and the Visual Inspect bridge is injected.
 */
export function buildSandpackFiles(
  files: Record<string, string>,
  theme?: SandpackTheme,
): Record<string, { code: string; hidden?: boolean; active?: boolean }> {
  const out: Record<string, { code: string; hidden?: boolean }> = {};

  for (const [path, content] of Object.entries(files)) {
    if (path === "package.json" || path.endsWith(".config.ts") || path.endsWith(".config.mjs")) {
      continue;
    }
    let processed = content;
    if (/\.(tsx|jsx)$/.test(path)) {
      const integrity = repairSourceCode(path, content);
      processed = stampStudioIds(path, integrity.content);
    }
    out[`/${path}`] = { code: rewriteAliases(processed, path) };
  }

  for (const [path, code] of Object.entries(SANDPACK_SHIMS)) {
    out[path] = { code, hidden: true };
  }

  const entryPath = pickEntryPath(files);
  const bodyClassName = extractBodyClassName(files);

  out["/App.tsx"] = {
    code: entryPath
      ? `import Page from "${toModulePath(entryPath)}";

export default function App() {
  return <Page />;
}
`
      : `export default function App() {
  return (
    <div style={{ padding: 32, fontFamily: "Inter, system-ui, sans-serif", color: "#94a3b8" }}>
      No page found. Create <code>src/app/page.tsx</code> to see a preview.
    </div>
  );
}
`,
  };

  out["/index.tsx"] = {
    hidden: true,
    code: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./studio-theme";
import "./studio-inspector";

// The App Router <body> never mounts in the sandbox, so its classes are
// applied to the preview document directly.
document.body.className = ${JSON.stringify(bodyClassName)};

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
`,
  };

  out["/studio-theme.ts"] = { hidden: true, code: buildThemeModule(theme) };
  out["/studio-inspector.ts"] = { hidden: true, code: INSPECTOR_RUNTIME };

  const bgColor = theme?.colors?.background || "#09090b";
  const isLight =
    bgColor === "#ffffff" ||
    bgColor === "#faf8f5" ||
    bgColor === "#f1f5f9" ||
    bgColor === "#f8fafc";
  const textColor = isLight ? "#0f172a" : "#fafafa";

  const tailwindColors = {
    canvas: bgColor,
    panel: theme?.colors?.surface || (isLight ? "#f8fafc" : "#18181b"),
    background: bgColor,
    surface: theme?.colors?.surface || (isLight ? "#f8fafc" : "#18181b"),
    border: theme?.colors?.border || (isLight ? "#e2e8f0" : "#27272a"),
    primary: theme?.colors?.primary || "#10b981",
    "primary-hover": theme?.colors?.["primary-hover"] || theme?.colors?.accent || "#059669",
    accent: theme?.colors?.accent || "#06b6d4",
    ...(theme?.colors ?? {}),
  };

  out["/public/index.html"] = {
    hidden: true,
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Studio Preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --color-primary: ${tailwindColors.primary};
        --color-primary-hover: ${tailwindColors["primary-hover"]};
        --color-accent: ${tailwindColors.accent};
        --color-surface: ${tailwindColors.surface};
        --color-background: ${tailwindColors.background};
        --color-border: ${tailwindColors.border};
      }
      html, body, #root { min-height: 100%; }
      body { margin: 0; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; background-color: var(--color-background, ${bgColor}); color: ${textColor}; }
      h1, h2, h3, .font-display { font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.025em; }
    </style>
    <script>
      // Configure Tailwind with active theme colors before Play CDN loads
      window.tailwind = {
        theme: {
          extend: {
            colors: ${JSON.stringify(tailwindColors)},
            fontFamily: {
              sans: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
              display: ["'Outfit'", "'Plus Jakarta Sans'", "sans-serif"],
              mono: ["'JetBrains Mono'", "ui-monospace", "monospace"]
            }
          }
        }
      };
    </script>
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
  };

  out["/package.json"] = {
    hidden: true,
    code: JSON.stringify(
      {
        name: "studio-preview",
        main: "/index.tsx",
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
          "lucide-react": "^0.469.0",
          "@tabler/icons-react": "^3.28.1",
          "@phosphor-icons/react": "^2.1.7",
          "framer-motion": "^11.15.0",
          clsx: "^2.1.1",
          "tailwind-merge": "^2.6.0",
        },
      },
      null,
      2,
    ),
  };

  return out;
}

/** The project design tokens handed to the preview's Tailwind runtime. */
export interface SandpackTheme {
  colors: Record<string, string>;
  fontSans?: string;
  fontMono?: string;
  radius?: Record<string, string>;
}

/**
 * Publishes the design system as a Tailwind config the preview picks up, so
 * token classes like `bg-primary` or `text-muted` actually resolve.
 */
export function buildThemeModule(theme?: SandpackTheme): string {
  const primary = theme?.colors?.primary || "#10b981";
  const primaryHover = theme?.colors?.["primary-hover"] || theme?.colors?.accent || "#059669";
  const accent = theme?.colors?.accent || "#06b6d4";
  const surface = theme?.colors?.surface || "#18181b";
  const background = theme?.colors?.background || "#09090b";
  const border = theme?.colors?.border || "#27272a";
  const isLight =
    background === "#ffffff" ||
    background === "#faf8f5" ||
    background === "#f1f5f9" ||
    background === "#f8fafc";
  const foreground = theme?.colors?.foreground || (isLight ? "#0f172a" : "#fafafa");

  const config = {
    theme: {
      extend: {
        colors: {
          primary,
          "primary-hover": primaryHover,
          accent,
          surface,
          canvas: background,
          background,
          border,
          foreground,
          ...(theme?.colors ?? {}),
        },
        borderRadius: theme?.radius ?? {},
        fontFamily: {
          sans: splitFontStack(theme?.fontSans) ?? ["Plus Jakarta Sans", "system-ui", "-apple-system", "sans-serif"],
          display: ["Outfit", "Plus Jakarta Sans", "sans-serif"],
          mono: splitFontStack(theme?.fontMono) ?? ["JetBrains Mono", "ui-monospace", "monospace"],
        },
      },
    },
  };
  return `// Generated from the project design system.
declare global {
  interface Window {
    __studioTheme?: unknown;
  }
}

window.__studioTheme = ${JSON.stringify(config, null, 2)};

if (typeof document !== "undefined") {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", "${primary}");
  root.style.setProperty("--color-primary-hover", "${primaryHover}");
  root.style.setProperty("--color-accent", "${accent}");
  root.style.setProperty("--color-surface", "${surface}");
  root.style.setProperty("--color-background", "${background}");
  root.style.setProperty("--color-border", "${border}");
  root.style.setProperty("--color-foreground", "${foreground}");
  if (document.body) {
    document.body.style.backgroundColor = "${background}";
    document.body.style.color = "${foreground}";
  }
}

export {};
`;
}

function splitFontStack(value?: string): string[] | null {
  if (!value) return null;
  return value
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** `@/components/Hero` → `/src/components/Hero`; `next/link` → a local shim. */
export function rewriteAliases(content: string, filePath?: string): string {
  let rewritten = content
    // Map "@/..." to "/src/..."
    .replace(/(["'])@\/([^"']+)\1/g, '"/src/$2"')
    // Map bare "src/..." to "/src/..."
    .replace(/(["'])src\/([^"']+)\1/g, '"/src/$2"')
    // Map "./src/..." to "/src/..."
    .replace(/(["'])\.\/src\/([^"']+)\1/g, '"/src/$2"')
    // Map bare root-level aliases "components/...", "data/...", "lib/...", "theme/..." to "/src/..."
    .replace(/(["'])(components|data|lib|theme)\/([^"']+)\1/g, '"/src/$1/$2"')
    // If inside src/app/page.tsx, map "./components/..." to "/src/components/..."
    .replace(/(["'])\.\/components\/([^"']+)\1/g, '"/src/components/$2"')
    // Strip trailing .tsx / .jsx / .ts / .js from ANY local import (/src/..., ./..., ../...)
    .replace(/(["'])((?:\/src\/|\.\.?\/)[^"']+?)\.(tsx|jsx|ts|js)\1/g, '"$2"')
    .replace(/from\s+["']next\/link["']/g, 'from "/src/__studio/next-link"')
    .replace(/from\s+["']next\/image["']/g, 'from "/src/__studio/next-image"')
    .replace(/^\s*import\s+type\s+\{[^}]*\}\s+from\s+["']next["'];?\s*$/gm, "")
    .replace(/^\s*export\s+const\s+metadata[\s\S]*?;\s*$/gm, "");

  return rewritten;
}

/** Reads the `<body className="…">` of the App Router root layout. */
export function extractBodyClassName(files: Record<string, string>): string {
  const layout =
    files["src/app/layout.tsx"] ?? files["app/layout.tsx"] ?? files["src/app/layout.jsx"];
  if (!layout) return "";
  const match = /<body[^>]*\sclassName=\{?["`]([^"`]*)["`]\}?/.exec(layout);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function pickEntryPath(files: Record<string, string>): string | null {
  const candidates = ["src/app/page.tsx", "src/app/page.jsx", "app/page.tsx", "pages/index.tsx"];
  for (const candidate of candidates) if (files[candidate]) return candidate;
  return Object.keys(files).find((p) => /page\.(tsx|jsx)$/.test(p)) ?? null;
}

function toModulePath(filePath: string): string {
  return `/${filePath.replace(/\.(tsx|jsx|ts|js)$/, "")}`;
}

/** Shims so App Router imports resolve inside the preview sandbox. */
export const SANDPACK_SHIMS: Record<string, string> = {
  "/src/__studio/next-link.tsx": `import * as React from "react";

export default function Link({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
`,
  "/src/__studio/next-image.tsx": `import * as React from "react";

export default function Image({
  src,
  alt = "",
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} {...rest} />;
}
`,
};
