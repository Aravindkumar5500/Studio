"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronRight,
  Columns3,
  Copy,
  ExternalLink,
  Eye,
  Info,
  Layers,
  Maximize2,
  MousePointerClick,
  MousePointerSquareDashed,
  Palette,
  Rows3,
  Sliders,
  Sparkles,
  Square,
  Type,
  Wand2,
  X,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getGroupToken, setGroupToken, type ClassGroup } from "@/lib/patch/class-groups";
import type { DesignSystem } from "@/lib/ai/schemas";
import type { VfsMap } from "@/lib/vfs/types";

function broadcastPreviewClassUpdate(studioId: string, nextClassName: string) {
  if (typeof window === "undefined") return;
  const message = {
    source: "studio-shell",
    type: "preview-class-update",
    studioId,
    className: nextClassName,
  };
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((frame) => {
    try {
      frame.contentWindow?.postMessage(message, "*");
    } catch {}
  });
}

function broadcastPreviewTextUpdate(studioId: string, text: string) {
  if (typeof window === "undefined") return;
  const message = {
    source: "studio-shell",
    type: "preview-text-update",
    studioId,
    text,
  };
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach((frame) => {
    try {
      frame.contentWindow?.postMessage(message, "*");
    } catch {}
  });
}

const SPACING_STEPS = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24"];

export interface ColorToken {
  name: string;
  className: string;
  swatch: string;
}

export const PRESET_THEMES: {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  isLight?: boolean;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  previewGradient: string;
}[] = [
  {
    id: "light-studio",
    label: "Clean Light Studio",
    subtitle: "Crisp white, slate surfaces & emerald accent",
    badge: "Light Mode",
    isLight: true,
    primary: "#10b981",
    accent: "#059669",
    background: "#ffffff",
    surface: "#f8fafc",
    border: "#e2e8f0",
    previewGradient: "from-white via-slate-100 to-emerald-200 border border-zinc-300",
  },
  {
    id: "editorial-cream",
    label: "Warm Editorial Cream",
    subtitle: "Warm ivory background & terracotta accent",
    badge: "Light Editorial",
    isLight: true,
    primary: "#d97706",
    accent: "#ea580c",
    background: "#faf8f5",
    surface: "#f3efe6",
    border: "#e7dfd1",
    previewGradient: "from-[#faf8f5] via-[#f3efe6] to-amber-200 border border-amber-300",
  },
  {
    id: "nordic-slate",
    label: "Nordic Clean Slate",
    subtitle: "Cool light gray with royal cobalt accent",
    badge: "Light Mode",
    isLight: true,
    primary: "#2563eb",
    accent: "#3b82f6",
    background: "#f1f5f9",
    surface: "#ffffff",
    border: "#cbd5e1",
    previewGradient: "from-slate-100 via-white to-blue-200 border border-slate-300",
  },
  {
    id: "emerald",
    label: "Emerald Obsidian",
    subtitle: "High-tech, fresh, like Supabase & Stripe",
    badge: "Dark Theme",
    primary: "#10b981",
    accent: "#14b8a6",
    background: "#09090b",
    surface: "#18181b",
    border: "#27272a",
    previewGradient: "from-emerald-400 to-teal-500",
  },
  {
    id: "cyan",
    label: "Cyber Cyan",
    subtitle: "Crisp, ultra-modern, like Linear & Cursor",
    badge: "Dark Theme",
    primary: "#0ea5e9",
    accent: "#38bdf8",
    background: "#080c14",
    surface: "#0f172a",
    border: "#1e293b",
    previewGradient: "from-cyan-400 to-blue-500",
  },
  {
    id: "violet",
    label: "Electric Violet",
    subtitle: "Vibrant & creative, like Raycast & Framer",
    badge: "Dark Theme",
    primary: "#8b5cf6",
    accent: "#d946ef",
    background: "#090714",
    surface: "#181126",
    border: "#291d3f",
    previewGradient: "from-violet-400 to-fuchsia-500",
  },
  {
    id: "amber",
    label: "Sunset Amber",
    subtitle: "Warm, sophisticated, like Claude & Arc",
    badge: "Dark Theme",
    primary: "#f59e0b",
    accent: "#f43f5e",
    background: "#0c0a09",
    surface: "#1c1917",
    border: "#292524",
    previewGradient: "from-amber-400 to-rose-500",
  },
];

const BASE_COLOR_TOKENS: ColorToken[] = [
  { name: "emerald-500", className: "emerald-500", swatch: "#10b981" },
  { name: "teal-500", className: "teal-500", swatch: "#14b8a6" },
  { name: "cyan-500", className: "cyan-500", swatch: "#06b6d4" },
  { name: "sky-500", className: "sky-500", swatch: "#0ea5e9" },
  { name: "violet-600", className: "violet-600", swatch: "#7c3aed" },
  { name: "amber-500", className: "amber-500", swatch: "#f59e0b" },
  { name: "rose-500", className: "rose-500", swatch: "#f43f5e" },
  { name: "zinc-950", className: "zinc-950", swatch: "#09090b" },
  { name: "zinc-900", className: "zinc-900", swatch: "#18181b" },
  { name: "zinc-800", className: "zinc-800", swatch: "#27272a" },
  { name: "zinc-400", className: "zinc-400", swatch: "#a1a1aa" },
  { name: "white", className: "white", swatch: "#ffffff" },
];

export function buildColorTokens(design: Record<string, string>): ColorToken[] {
  const fromDesign = Object.entries(design).map(([name, swatch]) => ({
    name,
    className: name,
    swatch,
  }));
  const taken = new Set(fromDesign.map((token) => token.className));
  return [...fromDesign, ...BASE_COLOR_TOKENS.filter((token) => !taken.has(token.className))];
}

const FONT_SIZES = [
  { label: "XS", value: "text-xs" },
  { label: "SM", value: "text-sm" },
  { label: "Base", value: "text-base" },
  { label: "LG", value: "text-lg" },
  { label: "XL", value: "text-xl" },
  { label: "2XL", value: "text-2xl" },
  { label: "3XL", value: "text-3xl" },
];

const FONT_WEIGHTS = [
  { label: "Light", value: "font-light" },
  { label: "Normal", value: "font-normal" },
  { label: "Medium", value: "font-medium" },
  { label: "Semibold", value: "font-semibold" },
  { label: "Bold", value: "font-bold" },
];

const BREAKPOINTS = [
  { id: "", label: "Base", sub: "All screens" },
  { id: "sm:", label: "sm", sub: "640px" },
  { id: "md:", label: "md", sub: "768px" },
  { id: "lg:", label: "lg", sub: "1024px" },
  { id: "xl:", label: "xl", sub: "1280px" },
];

export function PropertiesInspector() {
  const studio = useStudio();
  const selected = studio.selected;
  const [activeTab, setActiveTab] = React.useState<"element" | "theme">(
    selected ? "element" : "theme",
  );
  const [breakpoint, setBreakpoint] = React.useState("");
  const [textDraft, setTextDraft] = React.useState("");

  React.useEffect(() => {
    setTextDraft(selected?.text ?? "");
  }, [selected?.studioId, selected?.text]);

  // Auto-switch to Element tab whenever an element is selected
  React.useEffect(() => {
    if (selected) {
      setActiveTab("element");
    }
  }, [selected?.studioId]);

  const className = selected?.className ?? "";
  const colorTokens = React.useMemo(
    () => buildColorTokens(studio.designSystem.colors),
    [studio.designSystem.colors],
  );

  const setToken = React.useCallback(
    (group: ClassGroup, rawValue: string) => {
      const value = rawValue ? `${breakpoint}${rawValue}` : "";
      const currentCls = selected?.className ?? "";
      const nextCls = setGroupToken(currentCls, group, value);

      // Instant live preview update (<16ms, zero flicker)
      if (selected?.studioId) {
        broadcastPreviewClassUpdate(selected.studioId, nextCls);
        studio.dispatch({
          type: "select",
          selected: { ...selected, className: nextCls },
        });
      }

      // Persist AST mutation to file
      void studio.applyVisualMutation({ kind: "setClassToken", group, value });
    },
    [breakpoint, studio, selected?.studioId, selected?.className],
  );

  const current = React.useCallback(
    (group: ClassGroup) => {
      const token = getGroupToken(className, group, breakpoint);
      return token ? token.slice(breakpoint.length) : null;
    },
    [className, breakpoint],
  );

  function applyPresetTheme(preset: (typeof PRESET_THEMES)[number]) {
    const isLight =
      preset.background === "#ffffff" ||
      preset.background === "#faf8f5" ||
      preset.background === "#f1f5f9" ||
      preset.background === "#f8fafc";
    const nextDesign: DesignSystem = {
      ...studio.designSystem,
      name: preset.label,
      colors: {
        ...studio.designSystem.colors,
        primary: preset.primary,
        "primary-hover": preset.accent,
        accent: preset.accent,
        background: preset.background,
        surface: preset.surface,
        border: preset.border,
        foreground: isLight ? "#0f172a" : "#fafafa",
      },
    };
    studio.dispatch({ type: "setDesignSystem", designSystem: nextDesign });

    // Modernize any hardcoded classes in studio.files
    const updatedFiles: VfsMap = { ...studio.files };
    let hasChanges = false;
    for (const [filePath, file] of Object.entries(studio.files)) {
      if (/\.(tsx|jsx|css)$/.test(filePath)) {
        let nextContent = file.content;
        if (nextContent.includes("emerald-")) {
          nextContent = nextContent
            .replace(/\bbg-emerald-500\b/g, "bg-primary")
            .replace(/\bhover:bg-emerald-400\b/g, "hover:opacity-90")
            .replace(/\btext-emerald-400\b/g, "text-primary")
            .replace(/\btext-emerald-500\b/g, "text-primary")
            .replace(/\btext-emerald-300\b/g, "text-primary")
            .replace(/\bborder-emerald-500\//g, "border-primary/")
            .replace(/\bbg-emerald-500\//g, "bg-primary/")
            .replace(/\bshadow-emerald-500\//g, "shadow-primary/")
            .replace(/\bshadow-emerald-950\//g, "shadow-primary/")
            .replace(/\bhover:text-emerald-500\b/g, "hover:text-primary")
            .replace(/\bhover:text-emerald-400\b/g, "hover:text-primary")
            .replace(/\bhover:text-emerald-300\b/g, "hover:text-primary");
        }
        if (isLight) {
          nextContent = nextContent
            .replace(/\bbg-zinc-950\b/g, "bg-background")
            .replace(/\bbg-slate-950\b/g, "bg-background")
            .replace(/\bbg-black\b/g, "bg-background")
            .replace(/\btext-white\b/g, "text-foreground")
            .replace(/\btext-zinc-100\b/g, "text-foreground")
            .replace(/\btext-slate-100\b/g, "text-foreground");
        }
        if (nextContent !== file.content) {
          updatedFiles[filePath] = { ...file, content: nextContent, updatedAt: new Date().toISOString() };
          hasChanges = true;
        }
      }
    }
    if (hasChanges) {
      studio.dispatch({ type: "setFiles", files: updatedFiles });
    }
  }

  const paddingX = current("paddingX")?.replace(/^px-/, "") ?? "0";
  const paddingY = current("paddingY")?.replace(/^py-/, "") ?? "0";
  const fileName = selected?.filePath ? selected.filePath.split("/").pop() : "";

  return (
    <aside className="flex h-full w-[310px] shrink-0 flex-col border-l border-white/[0.08] bg-panel/95 backdrop-blur-xl">
      {/* Top Segmented Tab Switcher */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-3 bg-panel/60">
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-zinc-950/80 p-0.5 w-full">
          {/* Element Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("element")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
              activeTab === "element"
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <MousePointerClick
              className={cn("h-3.5 w-3.5", activeTab === "element" ? "text-emerald-400" : "text-zinc-500")}
            />
            <span>Element</span>
            {selected && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Theme Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("theme")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
              activeTab === "theme"
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Palette
              className={cn("h-3.5 w-3.5", activeTab === "theme" ? "text-emerald-400" : "text-zinc-500")}
            />
            <span>Theme</span>
          </button>
        </div>
      </div>

      {activeTab === "theme" ? (
        <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
          {/* Quick Inspect Callout Card */}
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-900/60 to-teal-500/10 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <MousePointerSquareDashed className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span>Interactive Element Inspector</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">
              Toggle <strong className="text-white">Visual Inspect</strong> in the top toolbar to click
              any headline, button, card, or container in the preview canvas and tweak it in real-time.
            </p>
            <Button
              size="xs"
              onClick={() => studio.dispatch({ type: "setInspect", enabled: !studio.inspectEnabled })}
              className={cn(
                "mt-3 w-full gap-1.5 text-xs font-semibold transition-all",
                studio.inspectEnabled
                  ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
                  : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30",
              )}
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              {studio.inspectEnabled ? "Visual Inspect is ON" : "Turn ON Visual Inspect"}
            </Button>
          </div>

          {/* Canvas Stage Background Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Canvas Stage Background
              </span>
              <span className="text-[9px] text-emerald-400 font-medium">Stage Studio</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "light", label: "Light Studio", sub: "Figma/Framer neutral", preview: "bg-[#f1f3f6] border-zinc-300 text-zinc-800" },
                { id: "aurora", label: "Aurora Glow", sub: "Vibrant ambient mesh", preview: "bg-gradient-to-br from-emerald-500/30 via-cyan-500/30 to-violet-500/30 text-white border-emerald-500/40" },
                { id: "sunset", label: "Sunset Dusk", sub: "Warm amber twilight", preview: "bg-gradient-to-br from-amber-500/30 to-rose-500/30 text-white border-amber-500/40" },
                { id: "grid", label: "Blueprint Grid", sub: "Technical CAD lines", preview: "bg-[#0a0f1d] border-cyan-500/30 text-cyan-200" },
                { id: "dots", label: "Dot Matrix", sub: "Architectural dots", preview: "bg-[#0c0d14] border-white/20 text-zinc-300" },
                { id: "minimal", label: "Minimal Dark", sub: "Deep charcoal", preview: "bg-[#111218] border-white/10 text-zinc-400" },
              ].map((item) => {
                const isCurrent = studio.canvasBg === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => studio.dispatch({ type: "setCanvasBg", canvasBg: item.id as any })}
                    className={cn(
                      "flex flex-col items-start rounded-xl border p-2 text-left transition-all",
                      isCurrent
                        ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                        : "border-white/[0.08] bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-800/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-7 w-full rounded-md border flex items-center justify-center font-mono text-[9px] font-bold mb-1.5",
                        item.preview,
                      )}
                    >
                      {item.label}
                    </div>
                    <span className="text-xs font-semibold text-zinc-200">{item.label}</span>
                    <span className="text-[10px] text-zinc-400">{item.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Theme Switcher */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Curated Color Themes
              </span>
              <span className="text-[9px] text-emerald-400 font-medium">1-Click Apply</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_THEMES.map((theme) => {
                const isActive =
                  studio.designSystem.colors.primary?.toLowerCase() === theme.primary.toLowerCase() &&
                  studio.designSystem.colors.background?.toLowerCase() === theme.background.toLowerCase();
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => applyPresetTheme(theme)}
                    className={cn(
                      "group flex items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                      isActive
                        ? "border-emerald-500/60 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30"
                        : "border-white/[0.08] bg-zinc-900/40 hover:border-white/[0.18] hover:bg-zinc-800/60",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-lg bg-gradient-to-br shadow-sm ring-1 ring-white/20 shrink-0",
                          theme.previewGradient,
                        )}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                            {theme.label}
                          </p>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider border",
                              theme.isLight
                                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                                : "border-zinc-700 bg-zinc-800 text-zinc-400",
                            )}
                          >
                            {theme.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">{theme.subtitle}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-bold text-zinc-950">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Palette Tokens */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Active Color Palette
              </span>
              <span className="font-mono text-[10px] text-zinc-500">
                {colorTokens.length} tokens
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-white/[0.08] bg-zinc-950/60 p-2.5">
              {colorTokens.map((token) => (
                <div
                  key={token.name}
                  title={`${token.name} (${token.swatch})`}
                  className="group relative flex h-7 items-center justify-center rounded-lg border border-white/[0.1] shadow-inner transition-transform hover:scale-105"
                  style={{
                    backgroundColor:
                      token.swatch === "transparent" ? "transparent" : token.swatch,
                  }}
                >
                  <span className="pointer-events-none absolute -bottom-6 hidden rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] text-white shadow group-hover:block z-30">
                    {token.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Page Structure Map */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Page Section Architecture
            </span>
            <div className="space-y-1.5">
              {[
                { name: "Navbar.tsx", type: "Sticky Header", line: "src/components/Navbar.tsx" },
                { name: "Hero.tsx", type: "Hero Banner", line: "src/components/Hero.tsx" },
                { name: "FeatureGrid.tsx", type: "Grid Showcase", line: "src/components/FeatureGrid.tsx" },
                { name: "About.tsx", type: "Stats & Story", line: "src/components/About.tsx" },
                { name: "Services.tsx", type: "Offerings Grid", line: "src/components/Services.tsx" },
                { name: "Pricing.tsx", type: "Tier Comparison", line: "src/components/Pricing.tsx" },
                { name: "Footer.tsx", type: "Global Footer", line: "src/components/Footer.tsx" },
              ].map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => studio.openFile(item.line)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-950/40 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-white/[0.14] hover:bg-zinc-900/80"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-mono text-[11px] text-zinc-200">{item.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{item.type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : !selected ? (
        /* Element Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-zinc-900/60 shadow-inner">
            <MousePointerSquareDashed className="h-7 w-7 text-emerald-400 animate-pulse" />
          </div>
          <div className="space-y-1.5 max-w-[240px]">
            <h3 className="text-sm font-bold text-white">Select an Element</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Turn on <strong className="text-zinc-200">Visual Inspect</strong> in the top toolbar or click any headline, button, or container in the live preview to edit its properties.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => studio.dispatch({ type: "setInspect", enabled: !studio.inspectEnabled })}
            className={cn(
              "gap-1.5 text-xs font-semibold transition-all shadow-sm",
              studio.inspectEnabled
                ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-emerald-500/20"
                : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30",
            )}
          >
            <MousePointerClick className="h-4 w-4" />
            {studio.inspectEnabled ? "Visual Inspect is ON" : "Turn ON Visual Inspect"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setActiveTab("theme")}
            className="text-[11px] text-zinc-400 hover:text-white"
          >
            <Palette className="h-3 w-3 mr-1.5 text-emerald-400" />
            <span>Customize Color Themes</span>
          </Button>
        </div>
      ) : (
        /* Element Inspector when selected */
        <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
          {/* Source Coordinates & Clear Selection */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-zinc-950/80 p-2.5">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  &lt;{selected.tagName}&gt;
                </span>
                <span className="font-mono text-[11px] font-semibold text-zinc-200 truncate">
                  {fileName}
                </span>
              </div>
              <span className="font-mono text-[9px] text-zinc-500 mt-0.5 truncate">
                {selected.filePath}:{selected.line}:{selected.col}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="xs"
                variant="outline"
                onClick={() => studio.openFile(selected.filePath)}
                className="h-6 px-2 text-[10px] border-white/[0.08] bg-zinc-900 text-zinc-300 hover:text-white"
              >
                Open File
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => studio.selectElement(null)}
                className="h-6 px-2 text-[10px] text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                title="Clear selection"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Responsive Breakpoints */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">
              Breakpoint Target
            </Label>
            <div className="flex rounded-lg border border-white/[0.08] bg-zinc-950/80 p-0.5">
              {BREAKPOINTS.map((bp) => (
                <button
                  key={bp.id || "base"}
                  type="button"
                  onClick={() => setBreakpoint(bp.id)}
                  className={cn(
                    "flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-all",
                    breakpoint === bp.id
                      ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {bp.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Text Content Editor */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Content</Label>
            {selected.canEditText ? (
              <div className="space-y-1">
                <Input
                  value={textDraft}
                  onChange={(event) => {
                    const nextVal = event.target.value;
                    setTextDraft(nextVal);
                    if (selected.studioId) {
                      broadcastPreviewTextUpdate(selected.studioId, nextVal);
                    }
                  }}
                  onBlur={() => {
                    if (textDraft !== (selected.text ?? "")) {
                      void studio.applyVisualMutation({ kind: "setText", value: textDraft });
                    }
                  }}
                  onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                  className="text-xs border-white/[0.1] bg-zinc-950/80 text-white focus-visible:ring-emerald-500"
                  placeholder="Enter text..."
                />
                <p className="text-[9px] text-zinc-500">Press Enter or click away to apply change.</p>
              </div>
            ) : (
              <p className="rounded-md border border-white/[0.04] bg-zinc-950/40 p-2 text-[10px] text-zinc-500">
                Container node with nested elements. Select an inner leaf element to edit text directly.
              </p>
            )}
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Layout & Display Mode */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Layout</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "flex", label: "Flex", icon: Columns3 },
                { value: "grid", label: "Grid", icon: Rows3 },
                { value: "block", label: "Block", icon: Square },
              ].map((option) => {
                const Icon = option.icon;
                const active = current("display") === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setToken("display", active ? "" : option.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[10px] font-medium transition-all",
                      active
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
                        : "border-white/[0.08] bg-zinc-950/60 text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>

            {current("display") === "flex" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <TokenSelect
                  label="Direction"
                  value={current("flexDirection") ?? "flex-row"}
                  options={["flex-row", "flex-col"]}
                  onChange={(value) => setToken("flexDirection", value)}
                />
                <TokenSelect
                  label="Justify"
                  value={current("justify") ?? "justify-start"}
                  options={["justify-start", "justify-center", "justify-between", "justify-end"]}
                  onChange={(value) => setToken("justify", value)}
                />
              </div>
            )}
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Box Model visualizer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-400">
                Box Model & Padding
              </Label>
              <span className="font-mono text-[9px] text-emerald-400">
                px-{paddingX} py-{paddingY}
              </span>
            </div>
            <BoxModel paddingX={paddingX} paddingY={paddingY} />
            <SpacingSlider
              label="Horizontal padding"
              token={paddingX}
              onChange={(value) => setToken("paddingX", value === "0" ? "px-0" : `px-${value}`)}
            />
            <SpacingSlider
              label="Vertical padding"
              token={paddingY}
              onChange={(value) => setToken("paddingY", value === "0" ? "py-0" : `py-${value}`)}
            />
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Typography */}
          <div className="space-y-2.5">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Typography</Label>
            <div className="grid grid-cols-2 gap-2">
              <TokenSelect
                label="Font"
                value={current("fontFamily") ?? "font-sans"}
                options={["font-sans", "font-display", "font-serif", "font-mono"]}
                onChange={(value) => setToken("fontFamily", value)}
              />
              <TokenSelect
                label="Size"
                value={current("fontSize") ?? "text-base"}
                options={FONT_SIZES.map((s) => s.value)}
                onChange={(value) => setToken("fontSize", value)}
              />
              <TokenSelect
                label="Weight"
                value={current("fontWeight") ?? "font-normal"}
                options={FONT_WEIGHTS.map((w) => w.value)}
                onChange={(value) => setToken("fontWeight", value)}
              />
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400">Alignment</span>
                <div className="flex rounded-lg border border-white/[0.08] bg-zinc-950/80 p-0.5">
                  {[
                    { value: "text-left", icon: AlignLeft },
                    { value: "text-center", icon: AlignCenter },
                    { value: "text-right", icon: AlignRight },
                    { value: "text-justify", icon: AlignJustify },
                  ].map((option) => {
                    const Icon = option.icon;
                    const active = current("textAlign") === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setToken("textAlign", option.value)}
                        className={cn(
                          "flex-1 rounded p-1 transition-all",
                          active ? "bg-zinc-800 text-white shadow" : "text-zinc-400 hover:text-zinc-200",
                        )}
                      >
                        <Icon className="mx-auto h-3 w-3" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Background Colors */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Background Color</Label>
            <Swatches
              tokens={colorTokens}
              active={current("bg")?.replace(/^bg-/, "") ?? null}
              onPick={(token) => setToken("bg", `bg-${token}`)}
            />
          </div>

          {/* Text Colors */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Text Color</Label>
            <Swatches
              tokens={colorTokens}
              active={current("textColor")?.replace(/^text-/, "") ?? null}
              onPick={(token) => setToken("textColor", `text-${token}`)}
            />
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* Border Radius */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Corner Radius</Label>
            <TokenSelect
              value={current("rounded") ?? "rounded"}
              options={[
                "rounded-none",
                "rounded-sm",
                "rounded",
                "rounded-md",
                "rounded-lg",
                "rounded-xl",
                "rounded-2xl",
                "rounded-full",
              ]}
              onChange={(value) => setToken("rounded", value)}
            />
          </div>

          {/* Applied Classes List */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-zinc-400">
              Active Tailwind Classes
            </Label>
            <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 p-2.5">
              {className.trim() ? (
                className
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((cls) => (
                    <span
                      key={cls}
                      className="rounded-md border border-white/[0.08] bg-zinc-900/90 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300"
                    >
                      {cls}
                    </span>
                  ))
              ) : (
                <span className="font-mono text-[10px] text-zinc-500">— No custom classes —</span>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function TokenSelect({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      {label && <span className="text-[10px] text-zinc-400">{label}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-lg border border-white/[0.1] bg-zinc-950/80 px-2 font-mono text-[11px] text-zinc-200 transition-colors focus:border-emerald-500 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-zinc-900 text-white">
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Swatches({
  tokens,
  active,
  onPick,
}: {
  tokens: ColorToken[];
  active: string | null;
  onPick: (token: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-950/50 p-2">
      {tokens.map((token) => (
        <button
          key={token.name}
          type="button"
          title={`${token.name} (${token.swatch})`}
          onClick={() => onPick(token.className)}
          className={cn(
            "h-7 rounded-md border transition-all hover:scale-105",
            active === token.className
              ? "border-emerald-400 ring-2 ring-emerald-500/70 scale-105 shadow-sm"
              : "border-white/[0.1] hover:border-white/[0.3]",
          )}
          style={{
            background:
              token.swatch === "transparent"
                ? "repeating-conic-gradient(#3f3f46 0% 25%, #18181b 0% 50%) 50%/8px 8px"
                : token.swatch,
          }}
        />
      ))}
    </div>
  );
}

function SpacingSlider({
  label,
  token,
  onChange,
}: {
  label: string;
  token: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, SPACING_STEPS.indexOf(token));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">{label}</span>
        <span className="font-mono text-[10px] font-semibold text-emerald-300">
          {SPACING_STEPS[index]} ({parseInt(SPACING_STEPS[index] || "0", 10) * 4}px)
        </span>
      </div>
      <Slider
        min={0}
        max={SPACING_STEPS.length - 1}
        step={1}
        value={[index]}
        onValueChange={([next]) => onChange(SPACING_STEPS[next])}
        className="cursor-pointer"
      />
    </div>
  );
}

function BoxModel({ paddingX, paddingY }: { paddingX: string; paddingY: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.1] bg-zinc-950/80 p-3">
      <div className="relative flex h-24 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/5">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-emerald-300">
          {paddingX}
        </span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-emerald-300">
          {paddingX}
        </span>
        <span className="absolute left-1/2 top-1.5 -translate-x-1/2 font-mono text-[10px] font-bold text-emerald-300">
          {paddingY}
        </span>
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-emerald-300">
          {paddingY}
        </span>
        <div className="rounded-md border border-white/[0.1] bg-zinc-900/90 px-4 py-2 text-[10px] font-medium text-zinc-300 shadow-sm">
          Content
        </div>
      </div>
    </div>
  );
}
