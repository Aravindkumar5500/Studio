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
  RotateCcw,
  Smartphone,
  Sparkles,
  Tablet,
  Workflow,
  Zap,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
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
import type { ViewMode, ViewportPreset, WorkflowMode } from "@/types/firestore";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const ViewportIcon = VIEWPORTS[studio.viewport].icon;

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-panel/95 px-4 backdrop-blur-xl">
      {/* Left: Brand + Project + Mode */}
      <div className="flex items-center gap-3">
        {/* Studio Emblem with link back to dashboard */}
        <Link href="/" className="group flex items-center gap-2.5 hover:opacity-90 transition-opacity" title="Back to Studio Dashboard">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 ring-1 ring-white/20 transition-transform group-hover:scale-105">
            <Sparkles className="h-4 w-4 text-white drop-shadow" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-white">Studio</span>
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                PRO
              </span>
            </div>
          </div>
        </Link>

        <div className="h-4 w-px bg-white/[0.08]" />

        {/* Project Dropdown / Checkpoints */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:border-white/[0.16] hover:bg-zinc-800/80 hover:text-white"
            >
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span className="max-w-[140px] truncate">{studio.projectName}</span>
              <ChevronDown className="h-3 w-3 text-zinc-400 transition-transform group-hover:translate-y-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl">
            <DropdownMenuLabel className="text-[11px] font-semibold text-zinc-400">
              Project Snapshots
            </DropdownMenuLabel>
            {studio.versions.slice(0, 6).map((version) => (
              <DropdownMenuItem
                key={version.id}
                onSelect={() => studio.restoreVersion(version.id)}
                className="cursor-pointer gap-2 py-2 text-xs focus:bg-emerald-600/20 focus:text-emerald-200"
              >
                <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-mono text-xs text-zinc-200">{version.label}</span>
                <span className="ml-auto text-[10px] text-zinc-500">
                  {version.manifest.length} files
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/[0.08]" />
            <DropdownMenuItem
              onSelect={() => studio.createCheckpoint()}
              className="cursor-pointer gap-2 text-xs text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Save snapshot checkpoint</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mode Toggle */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-zinc-950/60 p-0.5">
          <button
            type="button"
            onClick={() => studio.dispatch({ type: "setWorkflowMode", workflowMode: "guided" })}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              studio.workflowMode === "guided"
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Compass className="h-3 w-3" />
            Guided
          </button>
          <button
            type="button"
            onClick={() => studio.dispatch({ type: "setWorkflowMode", workflowMode: "autonomous" })}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              studio.workflowMode === "autonomous"
                ? "bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-200 shadow-sm ring-1 ring-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Zap className="h-3 w-3 text-amber-400" />
            Autonomous
          </button>
        </div>

        {/* Status indicator */}
        <SavePill state={studio.saveState} label={studio.latestVersionLabel} />
      </div>

      {/* Center: Viewport presets */}
      <div className="hidden lg:flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900/40 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-white/[0.14] hover:bg-zinc-800/60 hover:text-white"
            >
              <ViewportIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span>{VIEWPORTS[studio.viewport].label}</span>
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl">
            {(Object.keys(VIEWPORTS) as ViewportPreset[]).map((key) => {
              const Icon = VIEWPORTS[key].icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => studio.dispatch({ type: "setViewport", viewport: key })}
                  className="cursor-pointer gap-2 text-xs"
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{VIEWPORTS[key].label}</span>
                  {studio.viewport === key && (
                    <span className="ml-auto text-emerald-400 font-bold">✓</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: View switcher + Export/Deploy actions */}
      <div className="flex items-center gap-2.5">
        {/* Modern Segmented View Tabs */}
        <nav className="flex items-center rounded-lg border border-white/[0.08] bg-zinc-950/60 p-0.5">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = studio.viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => studio.dispatch({ type: "setViewMode", viewMode: tab.id })}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  active
                    ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active ? "text-emerald-400" : "text-zinc-500")} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="h-4 w-px bg-white/[0.08]" />

        {/* Action Buttons */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="gap-1.5 border-white/[0.08] bg-zinc-900/60 text-xs font-medium text-zinc-200 hover:border-white/[0.18] hover:bg-zinc-800/80 hover:text-white"
        >
          <Download className="h-3.5 w-3.5 text-zinc-400" />
          Export
        </Button>

        <Button
          size="sm"
          onClick={onDeploy}
          className="gap-1.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-emerald-500/25 ring-1 ring-white/20 transition-all hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/40"
        >
          <Cloud className="h-3.5 w-3.5" />
          Deploy
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
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Syncing…
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Sync failed
      </span>
    );
  }

  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400/90">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Synced · <span className="font-mono text-[10px] text-emerald-300/80">{label}</span>
    </span>
  );
}
