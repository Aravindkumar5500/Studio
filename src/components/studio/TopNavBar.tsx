"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Cloud,
  Code2,
  Compass,
  Download,
  Eye,
  FileText,
  GitBranch,
  Layers,
  Monitor,
  Moon,
  RotateCcw,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Workflow,
  Zap,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode, ViewportPreset } from "@/types/firestore";

const VIEW_TABS: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "dag", label: "DAG Graph", icon: Workflow },
  { id: "prd", label: "PRD Spec", icon: FileText },
];

export const VIEWPORTS: Record<
  ViewportPreset,
  { label: string; width: number | null; icon: React.ComponentType<{ className?: string }> }
> = {
  desktop: { label: "Desktop", width: null, icon: Monitor },
  tablet: { label: "Tablet (768px)", width: 768, icon: Tablet },
  mobile: { label: "Mobile (375px)", width: 375, icon: Smartphone },
};

export function TopNavBar({
  onExport,
  onDeploy,
}: {
  onExport: () => void;
  onDeploy: () => void;
}) {
  const studio = useStudio();
  const { theme, toggleTheme } = useTheme();
  const ViewportIcon = VIEWPORTS[studio.viewport].icon;

  return (
    <header className="relative z-20 flex h-14 w-full min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border bg-panel/95 px-3 xl:px-4 backdrop-blur-md overflow-x-auto">
      {/* Left: Brand + Project + Mode */}
      <div className="flex min-w-0 shrink-0 items-center gap-2 xl:gap-3">
        {/* Studio Emblem with link back to dashboard */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 hover:opacity-90 transition-opacity"
          title="Back to Studio Dashboard"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              Studio
            </span>
          </div>
        </Link>

        <div className="hidden sm:block h-4 w-px bg-border" />

        {/* Project Dropdown / Checkpoints */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Project snapshots and checkpoints"
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-surface"
            >
              <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="max-w-[96px] xl:max-w-[140px] truncate">{studio.projectName}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Project Snapshots</DropdownMenuLabel>
            {studio.versions.slice(0, 6).map((version) => (
              <DropdownMenuItem
                key={version.id}
                onSelect={() => studio.restoreVersion(version.id)}
                className="gap-2 py-2 text-xs"
              >
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-foreground truncate">{version.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {version.manifest.length} files
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => studio.createCheckpoint()}
              className="gap-2 text-xs text-primary font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Save snapshot checkpoint</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mode Toggle */}
        <div className="hidden md:flex items-center rounded-lg border border-border bg-surface p-0.5">
          <button
            type="button"
            aria-pressed={studio.workflowMode === "guided"}
            onClick={() => studio.dispatch({ type: "setWorkflowMode", workflowMode: "guided" })}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              studio.workflowMode === "guided"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Compass className="h-3 w-3 text-primary" />
            <span>Guided</span>
          </button>
          <button
            type="button"
            aria-pressed={studio.workflowMode === "autonomous"}
            onClick={() => studio.dispatch({ type: "setWorkflowMode", workflowMode: "autonomous" })}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              studio.workflowMode === "autonomous"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="h-3 w-3 text-primary" />
            <span>Autonomous</span>
          </button>
        </div>

        {/* Status indicator */}
        <SavePill state={studio.saveState} label={studio.latestVersionLabel} />
      </div>

      {/* Center: Viewport presets */}
      <div className="hidden 2xl:flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Preview viewport preset"
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-surface"
            >
              <ViewportIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{VIEWPORTS[studio.viewport].label}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {(Object.keys(VIEWPORTS) as ViewportPreset[]).map((key) => {
              const Icon = VIEWPORTS[key].icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => studio.dispatch({ type: "setViewport", viewport: key })}
                  className="gap-2 text-xs"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{VIEWPORTS[key].label}</span>
                  {studio.viewport === key && (
                    <span className="ml-auto text-primary font-bold">✓</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: View switcher + Theme + Export/Deploy actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Segmented View Tabs */}
        <nav
          aria-label="Workspace view mode"
          className="flex shrink-0 items-center rounded-lg border border-border bg-surface p-0.5"
        >
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = studio.viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => studio.dispatch({ type: "setViewMode", viewMode: tab.id })}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 xl:px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-surface"
        >
          {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </button>

        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="shrink-0 gap-1.5 px-2.5 text-xs"
        >
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <Button size="sm" onClick={onDeploy} className="shrink-0 gap-1.5 px-3 text-xs font-semibold">
          <Cloud className="h-3.5 w-3.5" />
          <span>Deploy</span>
        </Button>
      </div>
    </header>
  );
}

function SavePill({
  state,
  label,
}: {
  state: "idle" | "saving" | "saved" | "error";
  label: string;
}) {
  if (state === "saving") {
    return (
      <span className="hidden xl:inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-[11px] font-medium text-warning">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
        Syncing…
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="hidden xl:inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Sync failed
      </span>
    );
  }

  return (
    <span
      title={`Synced · ${label}`}
      className="hidden xl:inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      <span>Synced ·</span>
      <span className="max-w-[110px] truncate font-mono text-[10px] text-foreground">
        {label}
      </span>
    </span>
  );
}
