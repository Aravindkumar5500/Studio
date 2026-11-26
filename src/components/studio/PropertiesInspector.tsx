"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Columns3,
  Layers,
  MousePointerClick,
  MousePointerSquareDashed,
  Palette,
  Rows3,
  Square,
  X,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn, isLightHexColor } from "@/lib/utils";
import type { ColorTokenConfig, PresetThemeConfig } from "@/config/studio-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { getGroupToken, setGroupToken, type ClassGroup } from "@/lib/patch/class-groups";
import type { DesignSystem } from "@/lib/ai/schemas";
import type { VfsMap } from "@/lib/vfs/types";
import { makeVfsFile } from "@/lib/vfs/store";
import { buildDeterministicGlobalsCss, buildDeterministicTokens } from "@/lib/vfs/deterministic";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { doc, setDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/types/firestore";

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

export type ColorToken = ColorTokenConfig;

export function buildColorTokens(
  design: Record<string, string>,
  baseTokens: ColorTokenConfig[] = [],
): ColorToken[] {
  const fromDesign = Object.entries(design).map(([name, swatch]) => ({
    name,
    className: name,
    swatch,
  }));
  const taken = new Set(fromDesign.map((token) => token.className));
  return [...fromDesign, ...baseTokens.filter((token) => !taken.has(token.className))];
}

function modernizeThemeClasses(content: string, isLight: boolean): string {
  let next = content
    .replace(
      /\b(bg|text|border|shadow|ring)-(?:emerald|teal|cyan|sky|indigo|violet|purple|amber|rose)-(?:300|400|500|600|950)(\/\d+)?\b/g,
      "$1-primary$2",
    )
    .replace(
      /\bhover:(bg|text)-(?:emerald|teal|cyan|sky|indigo|violet|purple|amber|rose)-(?:300|400|500)\b/g,
      "hover:$1-primary",
    );

  if (isLight) {
    next = next
      .replace(/\bbg-(?:zinc|slate|neutral)-950\b/g, "bg-background")
      .replace(/\bbg-black\b/g, "bg-background")
      .replace(/\btext-(?:white|(?:zinc|slate|neutral)-100)\b/g, "text-foreground");
  }
  return next;
}

export function PropertiesInspector() {
  const studio = useStudio();
  const selected = studio.selected;
  const [activeTab, setActiveTab] = React.useState<"element" | "theme">(
    selected ? "element" : "theme",
  );
  const [breakpoint, setBreakpoint] = React.useState("");
  const [textDraft, setTextDraft] = React.useState("");

  const presetThemes = studio.studioConfig?.themes ?? [];
  const spacingSteps = studio.studioConfig?.inspector.spacingSteps ?? [];
  const fontSizes = studio.studioConfig?.inspector.fontSizes ?? [];
  const fontWeights = studio.studioConfig?.inspector.fontWeights ?? [];
  const breakpoints = studio.studioConfig?.inspector.breakpoints ?? [];
  const baseColorTokens = studio.studioConfig?.inspector.baseColorTokens ?? [];
  const stageBackgrounds = studio.studioConfig?.stageBackgrounds ?? [];

  React.useEffect(() => {
    setTextDraft(selected?.text ?? "");
  }, [selected?.studioId, selected?.text]);

  React.useEffect(() => {
    if (selected) {
      setActiveTab("element");
    }
  }, [selected?.studioId]);

  const className = selected?.className ?? "";
  const colorTokens = React.useMemo(
    () => buildColorTokens(studio.designSystem.colors, baseColorTokens),
    [studio.designSystem.colors, baseColorTokens],
  );

  const setToken = React.useCallback(
    (group: ClassGroup, rawValue: string) => {
      const value = rawValue ? `${breakpoint}${rawValue}` : "";
      const currentCls = selected?.className ?? "";
      const nextCls = setGroupToken(currentCls, group, value);

      if (selected?.studioId) {
        broadcastPreviewClassUpdate(selected.studioId, nextCls);
        studio.dispatch({
          type: "select",
          selected: { ...selected, className: nextCls },
        });
      }

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

  function applyPresetTheme(preset: PresetThemeConfig) {
    const isLight = preset.isLight ?? isLightHexColor(preset.background);
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

    const updatedFiles: VfsMap = { ...studio.files };
    let hasChanges = false;
    for (const [filePath, file] of Object.entries(studio.files)) {
      if (/\.(tsx|jsx|css)$/.test(filePath)) {
        const nextContent = modernizeThemeClasses(file.content, isLight);
        if (nextContent !== file.content) {
          updatedFiles[filePath] = { ...makeVfsFile(filePath, nextContent), dirty: true };
          hasChanges = true;
        }
      }
    }

    const tokensContent = buildDeterministicTokens(nextDesign);
    const globalsContent = buildDeterministicGlobalsCss(nextDesign);
    updatedFiles["src/theme/tokens.ts"] = {
      ...makeVfsFile("src/theme/tokens.ts", tokensContent),
      dirty: true,
    };
    updatedFiles["src/app/globals.css"] = {
      ...makeVfsFile("src/app/globals.css", globalsContent),
      dirty: true,
    };
    hasChanges = true;

    if (hasChanges) {
      studio.dispatch({ type: "setFiles", files: updatedFiles });
    }

    const db = getDb();
    const auth = getFirebaseAuth();
    if (db && isFirebaseConfigured && auth?.currentUser) {
      setDoc(
        doc(db, COLLECTIONS.designSystems, studio.projectId),
        {
          id: studio.projectId,
          projectId: studio.projectId,
          ...nextDesign,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ).catch(() => {});
    }
  }

  const paddingX = current("paddingX")?.replace(/^px-/, "") ?? "0";
  const paddingY = current("paddingY")?.replace(/^py-/, "") ?? "0";
  const fileName = selected?.filePath ? selected.filePath.split("/").pop() : "";

  const sectionFiles = React.useMemo(
    () =>
      Object.keys(studio.files)
        .filter((p) => /\.(tsx|jsx)$/.test(p) && !p.endsWith("layout.tsx"))
        .sort((a, b) => {
          if (a === "src/app/page.tsx") return 1;
          if (b === "src/app/page.tsx") return -1;
          return a.localeCompare(b);
        }),
    [studio.files],
  );

  return (
    <aside className="flex h-full w-full lg:w-[272px] xl:w-[300px] shrink-0 min-w-0 flex-col border-l border-border bg-panel overflow-hidden">
      {/* Top Segmented Tab Switcher */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 bg-surface/60">
        <div
          role="tablist"
          aria-label="Inspector panels"
          className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 w-full"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "element"}
            onClick={() => setActiveTab("element")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              activeTab === "element"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MousePointerClick
              className={cn("h-3.5 w-3.5", activeTab === "element" ? "text-primary" : "text-muted-foreground")}
            />
            <span>Element</span>
            {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "theme"}
            onClick={() => setActiveTab("theme")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              activeTab === "theme"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Palette
              className={cn("h-3.5 w-3.5", activeTab === "theme" ? "text-primary" : "text-muted-foreground")}
            />
            <span>Theme</span>
          </button>
        </div>
      </div>

      {activeTab === "theme" ? (
        <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
          {/* Quick Inspect Callout Card */}
          <div className="rounded-xl border border-primary/25 bg-accent/60 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <MousePointerSquareDashed className="h-4 w-4 text-primary" />
              <span>Interactive Element Inspector</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Toggle <strong className="text-foreground">Visual Inspect</strong> in the toolbar to
              click any element in the preview canvas and edit it directly.
            </p>
            <Button
              size="xs"
              variant={studio.inspectEnabled ? "default" : "outline"}
              onClick={() => studio.dispatch({ type: "setInspect", enabled: !studio.inspectEnabled })}
              className="mt-3 w-full gap-1.5 text-xs font-semibold"
            >
              <MousePointerClick className="h-3.5 w-3.5" />
              {studio.inspectEnabled ? "Visual Inspect is ON" : "Turn ON Visual Inspect"}
            </Button>
          </div>

          {/* Canvas Stage Background Section */}
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Canvas Stage Background
              </span>
              <span className="shrink-0 text-[9px] text-primary font-semibold">Stage</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stageBackgrounds.map((item) => {
                const isCurrent = studio.canvasBg === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isCurrent}
                    onClick={() => studio.dispatch({ type: "setCanvasBg", canvasBg: item.id as any })}
                    className={cn(
                      "flex min-w-0 flex-col items-start rounded-xl border p-2 text-left transition-colors",
                      isCurrent
                        ? "border-primary bg-accent/60 ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-surface",
                    )}
                  >
                    <div
                      className={cn(
                        "h-7 w-full rounded-md border flex items-center justify-center font-mono text-[9px] font-bold mb-1.5",
                        item.id === "light"
                          ? "bg-[#f4efe8] border-border text-[#1c1917]"
                          : "bg-[#181614] border-border text-[#f5f2ed]",
                      )}
                    >
                      {item.label}
                    </div>
                    <span className="w-full truncate text-xs font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="w-full truncate text-[10px] text-muted-foreground">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Theme Switcher */}
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Curated Color Themes
              </span>
              <span className="shrink-0 text-[9px] text-primary font-semibold">1-Click Apply</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {presetThemes.map((theme) => {
                const isActive =
                  studio.designSystem.colors.primary?.toLowerCase() === theme.primary.toLowerCase() &&
                  studio.designSystem.colors.background?.toLowerCase() ===
                    theme.background.toLowerCase();
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => applyPresetTheme(theme)}
                    className={cn(
                      "group flex min-w-0 items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-colors",
                      isActive
                        ? "border-primary bg-accent/60 ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-surface",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-lg bg-gradient-to-br shadow-sm shrink-0",
                          theme.previewGradient,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="min-w-0 truncate text-xs font-semibold text-foreground">
                            {theme.label}
                          </p>
                          <span className="shrink-0 rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider border border-border bg-surface text-muted-foreground">
                            {theme.badge}
                          </span>
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">{theme.subtitle}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-bold text-primary-foreground">
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
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active Color Palette
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {colorTokens.length} tokens
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 rounded-xl border border-border bg-surface/60 p-2.5">
              {colorTokens.map((token) => (
                <div
                  key={token.name}
                  title={`${token.name} (${token.swatch})`}
                  className="group relative flex h-7 items-center justify-center rounded-lg border border-border shadow-inner transition-transform hover:scale-105"
                  style={{
                    backgroundColor:
                      token.swatch === "transparent" ? "transparent" : token.swatch,
                  }}
                >
                  <span className="pointer-events-none absolute -bottom-6 hidden rounded bg-popover border border-border px-1.5 py-0.5 text-[9px] text-popover-foreground shadow group-hover:block z-30 whitespace-nowrap">
                    {token.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Page Structure Map */}
          <div className="space-y-2.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Page Section Architecture
            </span>
            {sectionFiles.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface/50 px-2.5 py-2 text-[11px] text-muted-foreground">
                No component files in workspace yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {sectionFiles.map((filePath) => {
                  const shortName = filePath.split("/").pop() ?? filePath;
                  const parentDir = filePath.split("/").slice(-2, -1)[0] ?? "src";
                  return (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => studio.openFile(filePath)}
                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate font-mono text-[11px] text-foreground">
                          {shortName}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {parentDir}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : !selected ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
            <MousePointerSquareDashed className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1.5 max-w-[230px]">
            <h3 className="text-sm font-bold text-foreground">Select an Element</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Turn on <strong className="text-foreground">Visual Inspect</strong> or click any
              element in the live preview to edit its properties.
            </p>
          </div>
          <Button
            size="sm"
            variant={studio.inspectEnabled ? "default" : "outline"}
            onClick={() => studio.dispatch({ type: "setInspect", enabled: !studio.inspectEnabled })}
            className="gap-1.5 text-xs font-semibold"
          >
            <MousePointerClick className="h-4 w-4" />
            {studio.inspectEnabled ? "Visual Inspect is ON" : "Turn ON Visual Inspect"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setActiveTab("theme")}
            className="text-[11px]"
          >
            <Palette className="h-3 w-3 mr-1.5 text-primary" />
            <span>Customize Color Themes</span>
          </Button>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
          {/* Source Coordinates & Clear Selection */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-foreground border border-primary/25">
                  &lt;{selected.tagName}&gt;
                </span>
                <span className="font-mono text-[11px] font-semibold text-foreground truncate">
                  {fileName}
                </span>
              </div>
              <span className="font-mono text-[9px] text-muted-foreground mt-0.5 truncate">
                {selected.filePath}:{selected.line}:{selected.col}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="xs"
                variant="outline"
                onClick={() => studio.openFile(selected.filePath)}
                className="h-6 px-2 text-[10px]"
              >
                Open
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => studio.selectElement(null)}
                className="h-6 px-1.5 text-[10px] hover:text-destructive"
                title="Clear selection"
                aria-label="Clear selected element"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Responsive Breakpoints */}
          <div className="space-y-1.5">
            <Label className="text-[10px]">Breakpoint Target</Label>
            <div className="flex rounded-lg border border-border bg-surface p-0.5">
              {breakpoints.map((bp) => (
                <button
                  key={bp.id || "base"}
                  type="button"
                  onClick={() => setBreakpoint(bp.id)}
                  className={cn(
                    "flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                    breakpoint === bp.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {bp.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Text Content Editor */}
          <div className="space-y-1.5">
            <Label className="text-[10px]">Content</Label>
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
                  className="text-xs"
                  placeholder="Enter text..."
                />
                <p className="text-[9px] text-muted-foreground">
                  Press Enter or click away to apply change.
                </p>
              </div>
            ) : (
              <p className="rounded-md border border-border bg-surface/50 p-2 text-[10px] text-muted-foreground">
                Container node with nested elements. Select an inner leaf element to edit text
                directly.
              </p>
            )}
          </div>

          <Separator />

          {/* Layout & Display Mode */}
          <div className="space-y-2">
            <Label className="text-[10px]">Layout</Label>
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
                      "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[10px] font-medium transition-colors",
                      active
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
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

          <Separator />

          {/* Box Model visualizer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Box Model &amp; Padding</Label>
              <span className="font-mono text-[9px] text-primary font-semibold">
                px-{paddingX} py-{paddingY}
              </span>
            </div>
            <BoxModel paddingX={paddingX} paddingY={paddingY} />
            <SpacingSlider
              label="Horizontal padding"
              token={paddingX}
              steps={spacingSteps}
              onChange={(value) => setToken("paddingX", value === "0" ? "px-0" : `px-${value}`)}
            />
            <SpacingSlider
              label="Vertical padding"
              token={paddingY}
              steps={spacingSteps}
              onChange={(value) => setToken("paddingY", value === "0" ? "py-0" : `py-${value}`)}
            />
          </div>

          <Separator />

          {/* Typography */}
          <div className="space-y-2.5">
            <Label className="text-[10px]">Typography</Label>
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
                options={fontSizes.map((s) => s.value)}
                onChange={(value) => setToken("fontSize", value)}
              />
              <TokenSelect
                label="Weight"
                value={current("fontWeight") ?? "font-normal"}
                options={fontWeights.map((w) => w.value)}
                onChange={(value) => setToken("fontWeight", value)}
              />
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Alignment</span>
                <div className="flex rounded-lg border border-border bg-surface p-0.5">
                  {[
                    { value: "text-left", icon: AlignLeft, label: "Align left" },
                    { value: "text-center", icon: AlignCenter, label: "Align center" },
                    { value: "text-right", icon: AlignRight, label: "Align right" },
                    { value: "text-justify", icon: AlignJustify, label: "Justify" },
                  ].map((option) => {
                    const Icon = option.icon;
                    const active = current("textAlign") === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-label={option.label}
                        onClick={() => setToken("textAlign", option.value)}
                        className={cn(
                          "flex-1 rounded p-1 transition-colors",
                          active
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
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

          <Separator />

          {/* Background Colors */}
          <div className="space-y-2">
            <Label className="text-[10px]">Background Color</Label>
            <Swatches
              tokens={colorTokens}
              active={current("bg")?.replace(/^bg-/, "") ?? null}
              onPick={(token) => setToken("bg", `bg-${token}`)}
            />
          </div>

          {/* Text Colors */}
          <div className="space-y-2">
            <Label className="text-[10px]">Text Color</Label>
            <Swatches
              tokens={colorTokens}
              active={current("textColor")?.replace(/^text-/, "") ?? null}
              onPick={(token) => setToken("textColor", `text-${token}`)}
            />
          </div>

          <Separator />

          {/* Border Radius */}
          <div className="space-y-2">
            <Label className="text-[10px]">Corner Radius</Label>
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
            <Label className="text-[10px]">Active Tailwind Classes</Label>
            <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-2.5">
              {className.trim() ? (
                className
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((cls) => (
                    <span
                      key={cls}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] text-primary"
                    >
                      {cls}
                    </span>
                  ))
              ) : (
                <span className="font-mono text-[10px] text-muted-foreground">
                  — No custom classes —
                </span>
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
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-lg border border-input bg-card px-2 font-mono text-[11px] text-foreground transition-colors focus:border-primary focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
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
    <div className="grid grid-cols-6 gap-1.5 rounded-lg border border-border bg-surface/60 p-2">
      {tokens.map((token) => (
        <button
          key={token.name}
          type="button"
          aria-label={`Pick color ${token.name}`}
          title={`${token.name} (${token.swatch})`}
          onClick={() => onPick(token.className)}
          className={cn(
            "h-7 rounded-md border transition-transform hover:scale-105",
            active === token.className
              ? "border-primary ring-2 ring-primary/50 scale-105 shadow-sm"
              : "border-border hover:border-primary/50",
          )}
          style={{
            background:
              token.swatch === "transparent"
                ? "repeating-conic-gradient(#78716c 0% 25%, #292524 0% 50%) 50%/8px 8px"
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
  steps,
  onChange,
}: {
  label: string;
  token: string;
  steps: string[];
  onChange: (value: string) => void;
}) {
  const safeSteps = steps.length ? steps : ["0"];
  const index = Math.max(0, safeSteps.indexOf(token));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] font-semibold text-primary">
          {safeSteps[index]} ({parseInt(safeSteps[index] || "0", 10) * 4}px)
        </span>
      </div>
      <Slider
        min={0}
        max={safeSteps.length - 1}
        step={1}
        value={[index]}
        onValueChange={([next]) => onChange(safeSteps[next])}
        className="cursor-pointer"
      />
    </div>
  );
}

function BoxModel({ paddingX, paddingY }: { paddingX: string; paddingY: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/60 p-3">
      <div className="relative flex h-24 items-center justify-center rounded-lg border border-primary/35 bg-accent/40">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-primary">
          {paddingX}
        </span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-primary">
          {paddingX}
        </span>
        <span className="absolute left-1/2 top-1.5 -translate-x-1/2 font-mono text-[10px] font-bold text-primary">
          {paddingY}
        </span>
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold text-primary">
          {paddingY}
        </span>
        <div className="rounded-md border border-border bg-card px-4 py-2 text-[10px] font-medium text-foreground shadow-sm">
          Content
        </div>
      </div>
    </div>
  );
}
