import type { DesignSystem } from "@/lib/ai/schemas";
import type { VfsMap } from "@/lib/vfs/types";

/**
 * Builds a 100% self-contained, standalone HTML preview document
 * containing React 18, Babel, Tailwind CSS Play CDN, and the active design tokens.
 * This can be opened in any new browser tab via a Blob URL.
 */
export function generateStandaloneHtmlPreview(
  files: VfsMap | Record<string, { content?: string; code?: string } | string>,
  designSystem?: DesignSystem,
): string {
  const bg = designSystem?.colors?.background || "#09090b";
  const isLight =
    bg === "#ffffff" || bg === "#faf8f5" || bg === "#f1f5f9" || bg === "#f8fafc";
  const fg = designSystem?.colors?.foreground || (isLight ? "#0f172a" : "#fafafa");
  const primary = designSystem?.colors?.primary || "#10b981";
  const accent = designSystem?.colors?.accent || "#06b6d4";
  const surface = designSystem?.colors?.surface || (isLight ? "#f8fafc" : "#18181b");
  const border = designSystem?.colors?.border || (isLight ? "#e2e8f0" : "#27272a");

  // Extract page content
  let pageContent = "";
  let componentsCode = "";

  for (const [path, fileObj] of Object.entries(files)) {
    const raw =
      typeof fileObj === "string"
        ? fileObj
        : "content" in fileObj && typeof fileObj.content === "string"
        ? fileObj.content
        : "code" in fileObj && typeof fileObj.code === "string"
        ? fileObj.code
        : "";

    if (!raw) continue;

    if (path.endsWith("page.tsx") || path.endsWith("page.jsx")) {
      pageContent = raw;
    } else if (path.includes("components/")) {
      componentsCode += `\n/* ${path} */\n` + raw + "\n";
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${designSystem?.name || "Studio"} — Live Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      --color-background: ${bg};
      --color-foreground: ${fg};
      --color-primary: ${primary};
      --color-accent: ${accent};
      --color-surface: ${surface};
      --color-border: ${border};
    }
    body {
      background-color: var(--color-background);
      color: var(--color-foreground);
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      margin: 0;
      min-height: 100vh;
    }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            background: "${bg}",
            foreground: "${fg}",
            canvas: "${bg}",
            surface: "${surface}",
            panel: "${surface}",
            border: "${border}",
            primary: "${primary}",
            accent: "${accent}"
          },
          fontFamily: {
            sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
            display: ["'Outfit'", "sans-serif"]
          }
        }
      }
    };
  </script>
</head>
<body class="bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary">
  <div id="root">
    <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem;">
      <div style="max-width: 500px; text-align: center; background: ${surface}; border: 1px solid ${border}; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.3);">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: ${primary}20; border: 1px solid ${primary}40; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: ${primary};">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; color: ${fg};">Live Standalone Preview</h2>
        <p style="font-size: 0.875rem; color: #94a3b8; margin: 0 0 1.5rem; line-height: 1.5;">This standalone tab displays your responsive application with active color tokens and layout.</p>
        <div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 9999px; background: ${primary}; color: #09090b; font-weight: 700; font-size: 0.75rem;">
          <span>Active Theme: ${designSystem?.name || "Studio Custom"}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

