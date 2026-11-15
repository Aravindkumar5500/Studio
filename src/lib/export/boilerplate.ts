/**
 * Runnable Next.js 14 base that every export/deploy is merged with.
 * Project `source_files` always win over these defaults.
 */
export interface BoilerplateOptions {
  projectName: string;
  description?: string;
}

const PACKAGE_JSON = (name: string) =>
  JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "14.2.20",
        react: "18.3.1",
        "react-dom": "18.3.1",
        clsx: "2.1.1",
        "tailwind-merge": "2.6.0",
        "lucide-react": "0.469.0",
        "@tabler/icons-react": "^3.28.1",
        "@phosphor-icons/react": "^2.1.7",
        "framer-motion": "^11.15.0",
      },
      devDependencies: {
        "@types/node": "20.17.10",
        "@types/react": "18.3.17",
        "@types/react-dom": "18.3.5",
        autoprefixer: "10.4.20",
        postcss: "8.4.49",
        tailwindcss: "3.4.17",
        typescript: "5.7.2",
      },
    },
    null,
    2,
  ) + "\n";

const TSCONFIG =
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./src/*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  ) + "\n";

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
`;

const TAILWIND_CONFIG = `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
`;

const POSTCSS_CONFIG = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
`;

const GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light dark; }
body { @apply antialiased; }
`;

const README = (name: string, description: string) => `# ${name}

${description}

Generated with Studio.

## Getting started

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

const GITIGNORE = `node_modules
.next
out
.env*.local
*.tsbuildinfo
next-env.d.ts
`;

/** Base files keyed by path. Merge order: boilerplate first, project last. */
export function buildBoilerplate(options: BoilerplateOptions): Record<string, string> {
  const name = slugifyPackageName(options.projectName);
  return {
    "package.json": PACKAGE_JSON(name),
    "tsconfig.json": TSCONFIG,
    "next.config.mjs": NEXT_CONFIG,
    "tailwind.config.ts": TAILWIND_CONFIG,
    "postcss.config.mjs": POSTCSS_CONFIG,
    "src/app/globals.css": GLOBALS_CSS,
    "README.md": README(options.projectName, options.description ?? "An app built with Studio."),
    ".gitignore": GITIGNORE,
  };
}

export function slugifyPackageName(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "studio-app";
}

/** Merges the VFS over the boilerplate, producing the exportable file map. */
export function mergeWithBoilerplate(
  projectFiles: Record<string, string>,
  options: BoilerplateOptions,
): Record<string, string> {
  return { ...buildBoilerplate(options), ...projectFiles };
}
