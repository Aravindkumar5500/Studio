"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import type { CategoryConfig } from "@/config/studio-config";
import { cn } from "@/lib/utils";

const VARIANT_STAGE: Record<string, string> = {
  landing: "bg-violet-100/80 dark:bg-violet-950/35",
  crm: "bg-orange-100/80 dark:bg-orange-950/35",
  ecommerce: "bg-emerald-100/80 dark:bg-emerald-950/35",
  booking: "bg-sky-100/80 dark:bg-sky-950/35",
  dataviz: "bg-rose-100/80 dark:bg-rose-950/35",
  business: "bg-amber-100/80 dark:bg-amber-950/35",
};

function MiniWireframe({ variant }: { variant: string }) {
  return (
    <div className="w-full h-full rounded-lg border border-black/5 dark:border-white/10 bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Tiny browser dots */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/70 bg-surface/60">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
        <span className="ml-auto h-1.5 w-8 rounded-full bg-border" />
      </div>

      {variant === "landing" && (
        <div className="flex-1 p-2.5 flex flex-col justify-between gap-2">
          <div className="space-y-1.5 text-center pt-1">
            <div className="mx-auto h-2 w-16 rounded-full bg-foreground/80" />
            <div className="mx-auto h-1.5 w-24 rounded-full bg-muted-foreground/40" />
            <div className="mx-auto mt-1 h-3 w-12 rounded bg-primary/80" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="h-6 rounded bg-surface border border-border/70" />
            <div className="h-6 rounded bg-surface border border-border/70" />
            <div className="h-6 rounded bg-surface border border-border/70" />
          </div>
        </div>
      )}

      {variant === "crm" && (
        <div className="flex-1 grid grid-cols-12">
          <div className="col-span-3 border-r border-border/70 bg-surface/70 p-1.5 space-y-1">
            <div className="h-1.5 w-full rounded bg-primary/60" />
            <div className="h-1.5 w-4/5 rounded bg-border" />
            <div className="h-1.5 w-3/4 rounded bg-border" />
          </div>
          <div className="col-span-9 p-2 flex flex-col justify-between">
            <div className="grid grid-cols-3 gap-1">
              <div className="h-4 rounded bg-surface border border-border/70" />
              <div className="h-4 rounded bg-surface border border-border/70" />
              <div className="h-4 rounded bg-surface border border-border/70" />
            </div>
            <div className="flex items-end gap-1 h-8 pt-1">
              <div className="flex-1 h-4 rounded-t bg-primary/40" />
              <div className="flex-1 h-6 rounded-t bg-primary/60" />
              <div className="flex-1 h-5 rounded-t bg-primary/50" />
              <div className="flex-1 h-7 rounded-t bg-primary" />
            </div>
          </div>
        </div>
      )}

      {variant === "ecommerce" && (
        <div className="flex-1 p-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="h-2 w-12 rounded bg-foreground/70" />
            <div className="h-2.5 w-6 rounded bg-emerald-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            <div className="rounded border border-border/70 bg-surface/60 p-1.5 flex flex-col justify-between">
              <div className="h-6 rounded bg-emerald-500/20" />
              <div className="h-1.5 w-10 rounded bg-foreground/50" />
            </div>
            <div className="rounded border border-border/70 bg-surface/60 p-1.5 flex flex-col justify-between">
              <div className="h-6 rounded bg-emerald-500/30" />
              <div className="h-1.5 w-10 rounded bg-foreground/50" />
            </div>
          </div>
        </div>
      )}

      {variant === "booking" && (
        <div className="flex-1 p-2 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between">
            <div className="h-2 w-14 rounded bg-foreground/75" />
            <div className="h-3 w-8 rounded bg-sky-500/80" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 14 }).map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-2.5 rounded-sm",
                  idx === 9 ? "bg-sky-500" : "bg-surface border border-border/70",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {(variant === "dataviz" || variant === "business") && (
        <div className="flex-1 p-2 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between">
            <div className="h-2 w-12 rounded bg-foreground/75" />
            <div className="h-2 w-8 rounded bg-rose-400/50" />
          </div>
          <div className="flex items-end gap-1.5 flex-1 pt-1">
            <div className="flex-1 h-5 rounded-t bg-rose-300/60 dark:bg-rose-500/40" />
            <div className="flex-1 h-8 rounded-t bg-rose-400/70 dark:bg-rose-500/60" />
            <div className="flex-1 h-6 rounded-t bg-rose-300/60 dark:bg-rose-500/40" />
            <div className="flex-1 h-10 rounded-t bg-rose-500/80" />
            <div className="flex-1 h-7 rounded-t bg-rose-400/70 dark:bg-rose-500/60" />
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplatePreviewCard({
  category,
  selected,
  onSelect,
}: {
  category: CategoryConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const variant = category.previewVariant || "landing";
  const stageClass = VARIANT_STAGE[variant] ?? VARIANT_STAGE.landing;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40",
      )}
    >
      {/* Visual Mini-Preview Stage */}
      <div className={cn("h-32 w-full p-3.5 transition-colors", stageClass)}>
        <MiniWireframe variant={variant} />
      </div>

      {/* Card Footer */}
      <div className="flex flex-1 items-center justify-between gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {category.label}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {category.subtitle || category.placeholder}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-muted-foreground group-hover:border-primary/40 group-hover:text-primary",
          )}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}
