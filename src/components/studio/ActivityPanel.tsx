"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ActivityPanel() {
  const studio = useStudio();
  const runnableTasks = studio.tasks.filter(
    (task) => task.status === "pending" || task.status === "awaiting_approval",
  );

  const pendingApprovals = studio.approvals.filter((a) => a.status === "pending");

  return (
    <div className="flex h-full flex-col bg-panel select-none overflow-y-auto p-3.5 space-y-4">
      {/* Build & Preview Health Status Card */}
      <div className="rounded-xl border border-border bg-card p-3.5 shadow-card">
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-4 w-4 shrink-0 text-primary" />
            <h4 className="truncate text-xs font-bold text-foreground tracking-wide">
              Application Runtime Health
            </h4>
          </div>
          <span
            className={cn(
              "shrink-0 font-mono text-[9px] font-bold px-2 py-0.5 rounded border",
              studio.previewStatus === "ready"
                ? "bg-success/10 text-success border-success/25"
                : studio.previewStatus === "starting"
                ? "bg-warning/10 text-warning border-warning/25"
                : "bg-destructive/10 text-destructive border-destructive/25",
            )}
          >
            {studio.previewStatus.toUpperCase()}
          </span>
        </div>

        {studio.activeDiagnostics.length > 0 ? (
          <div className="space-y-2 mt-2">
            {studio.activeDiagnostics.map((diag) => {
              const displayPath = diag.filePath ? diag.filePath.replace(/^\//, "") : "Preview";
              const displayLine = diag.line && diag.line > 0 ? `:${diag.line}` : "";
              return (
                <div
                  key={diag.id}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-foreground min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="min-w-0 truncate font-mono text-[10px] text-muted-foreground"
                      title={`${displayPath}${displayLine}`}
                    >
                      {displayPath}
                      {displayLine}
                    </span>
                    <button
                      type="button"
                      onClick={() => studio.triggerQaRepair(diag)}
                      disabled={studio.busy}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Auto-Heal</span>
                    </button>
                  </div>
                  <p className="mt-1 break-words font-mono text-[11px] text-destructive">
                    {diag.message}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Preview is running cleanly with zero detected runtime exceptions.
          </p>
        )}
      </div>

      {/* Generation Pipeline Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground tracking-wide">
              Multi-Agent Task Pipeline
            </h4>
          </div>
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {studio.tasks.filter((t) => t.status === "succeeded").length}/{studio.tasks.length} Done
          </span>
        </div>

        {/* Guided Mode Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            <span className="font-semibold block mb-1 text-warning">
              Architecture Approvals Required
            </span>
            <div className="space-y-2">
              {pendingApprovals.map((appr) => (
                <div key={appr.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{appr.summary}</span>
                  <button
                    type="button"
                    onClick={() =>
                      studio.dispatch({
                        type: "decideApproval",
                        approvalId: appr.id,
                        status: "approved",
                      })
                    }
                    className="shrink-0 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary-hover"
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks List */}
        {studio.tasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/50 p-4 text-center text-xs text-muted-foreground">
            No active tasks. Use the prompt box to plan an application.
          </div>
        ) : (
          <div className="space-y-1.5">
            {studio.tasks.map((task) => {
              const statusColor =
                task.status === "succeeded"
                  ? "border-success/30 bg-success/5 text-foreground"
                  : task.status === "running"
                  ? "border-primary/40 bg-accent text-foreground"
                  : task.status === "failed"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground";

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors text-xs",
                    statusColor,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {task.status === "succeeded" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    ) : task.status === "running" ? (
                      <Clock className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                    ) : task.status === "failed" ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />
                    )}
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">
                        {task.title}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {task.targetFilePath}
                      </span>
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border border-border bg-surface text-muted-foreground">
                    {task.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Run Pending Button */}
        {runnableTasks.length > 0 && (
          <Button
            type="button"
            onClick={() => studio.runPendingTasks()}
            disabled={studio.busy}
            className="w-full mt-2 text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            <span>Run Remaining {runnableTasks.length} Tasks</span>
          </Button>
        )}
      </div>

      {/* Version Checkpoints History */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground tracking-wide">Version Snapshots</h4>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {studio.versions.length} Revisions
          </span>
        </div>

        <div className="space-y-1.5">
          {studio.versions.map((ver) => (
            <div
              key={ver.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-xs"
            >
              <div className="min-w-0">
                <span className="block truncate font-semibold text-foreground">{ver.label}</span>
                <span className="block font-mono text-[9px] text-muted-foreground">
                  {new Date(ver.createdAt).toLocaleTimeString()} · {ver.manifest.length} files
                </span>
              </div>
              <button
                type="button"
                onClick={() => studio.restoreVersion(ver.id)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Restore</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
