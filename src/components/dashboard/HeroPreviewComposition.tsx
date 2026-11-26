"use client";

import * as React from "react";
import {
  Code2,
  Layers,
  Palette,
  Play,
  Rocket,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowStage {
  id: string;
  label: string;
  agents: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: "plan",
    label: "Plan & Architect",
    agents: "Product + Architect",
    detail: "Builds PRD specs, route map, and topologically sorted build DAG.",
    icon: Sparkles,
  },
  {
    id: "design",
    label: "Design UI / UX",
    agents: "UI/UX Agent",
    detail: "Generates semantic color tokens, typography scale, and layout theme.",
    icon: Palette,
  },
  {
    id: "code",
    label: "Generate Code",
    agents: "Frontend + Backend",
    detail: "Streams typed Next.js App Router components and validated API routes.",
    icon: Code2,
  },
  {
    id: "verify",
    label: "Test & Debug",
    agents: "Code Integrity + QA",
    detail: "Repairs imports via TypeScript AST and heals Sandpack runtime errors.",
    icon: Play,
  },
  {
    id: "deploy",
    label: "Deploy",
    agents: "ZIP / GitHub / Vercel",
    detail: "Bundles complete Next.js project or deploys directly to Vercel.",
    icon: Rocket,
  },
];

export function HeroPreviewComposition({
  projectCount,
  templateCount,
  selectedCategory,
  mode,
  includeBackend,
}: {
  projectCount: number;
  templateCount: number;
  selectedCategory: string;
  mode: "guided" | "autonomous";
  includeBackend: boolean;
}) {
  const [activeStageId, setActiveStageId] = React.useState<string>("plan");
  const activeStage =
    WORKFLOW_STAGES.find((stage) => stage.id === activeStageId) ?? WORKFLOW_STAGES[0];

  return (
    <div className="relative mx-auto w-full max-w-[560px] py-4 lg:py-2">
      {/* Subtle warm radial ambient tint matching reference (no glowing orbs) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-3xl studio-hero-wash"
      />

      <div className="relative flex flex-col gap-4 sm:block">
        {/* Main layered Studio interface window */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated sm:mr-14">
          {/* Window chrome */}
          <div className="flex h-9 items-center justify-between border-b border-border bg-surface/80 px-3.5">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              studio · {selectedCategory || "Workspace"}
            </span>
            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-foreground">
              {mode}
            </span>
          </div>

          <div className="grid grid-cols-12 min-h-[250px]">
            {/* Dark mini sidebar matching reference frame */}
            <div className="col-span-4 flex flex-col justify-between bg-[#181614] p-3 text-[#f5f2ed]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  <span className="text-xs font-semibold tracking-tight">Studio</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="rounded-md bg-white/10 px-2 py-1 font-medium text-white">
                    Pipeline
                  </div>
                  <div className="px-2 py-1 text-stone-400">Preview</div>
                  <div className="px-2 py-1 text-stone-400">Code AST</div>
                  <div className="px-2 py-1 text-stone-400">
                    {includeBackend ? "API + DB" : "Components"}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-stone-300">
                <span className="block font-medium text-white">Live Sync</span>
                <span className="text-stone-400">Sandpack + Monaco</span>
              </div>
            </div>

            {/* Inner crisp light/card workspace preview */}
            <div className="col-span-8 flex flex-col justify-between bg-card p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Workspace Telemetry
                    </p>
                    <h3 className="text-sm font-bold text-foreground">
                      {activeStage.label}
                    </h3>
                  </div>
                  <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                    {activeStage.agents}
                  </span>
                </div>

                {/* Live metrics from real Studio state */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-surface/70 p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Workspaces</span>
                    <span className="mt-0.5 block font-display text-base font-bold text-foreground tabular-nums">
                      {projectCount}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/70 p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Templates</span>
                    <span className="mt-0.5 block font-display text-base font-bold text-foreground tabular-nums">
                      {templateCount}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/70 p-2.5">
                    <span className="block text-[10px] text-muted-foreground">Stages</span>
                    <span className="mt-0.5 block font-display text-base font-bold text-primary tabular-nums">
                      {WORKFLOW_STAGES.length}
                    </span>
                  </div>
                </div>

                <p className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {activeStage.detail}
                </p>
              </div>

              {/* Clean architectural stage bars */}
              <div className="mt-4 flex items-end gap-2 pt-2 border-t border-border/70">
                {WORKFLOW_STAGES.map((stage, index) => {
                  const isActive = stage.id === activeStageId;
                  const heights = ["h-7", "h-10", "h-12", "h-9", "h-11"];
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setActiveStageId(stage.id)}
                      aria-label={`Inspect ${stage.label} stage`}
                      className="group flex flex-1 flex-col items-center gap-1"
                    >
                      <span
                        className={cn(
                          "w-full rounded-t-md transition-all",
                          heights[index],
                          isActive
                            ? "bg-primary shadow-sm"
                            : "bg-primary/25 group-hover:bg-primary/50",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Floating AI workflow stages card matching reference right overlay */}
        <div className="sm:absolute sm:-right-2 sm:top-8 sm:w-[215px] rounded-xl border border-border bg-card/95 p-2 shadow-elevated backdrop-blur-sm">
          <div className="mb-1.5 flex items-center justify-between px-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agent Pipeline
            </span>
            <Layers className="h-3 w-3 text-primary" />
          </div>
          <div className="space-y-1">
            {WORKFLOW_STAGES.map((stage) => {
              const Icon = stage.icon;
              const isActive = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isActive
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-border bg-surface text-primary",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
