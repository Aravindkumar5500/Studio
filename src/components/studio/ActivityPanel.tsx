"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  FileCode2,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
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
    <div className="flex h-full flex-col bg-[#0b0f19]/40 select-none overflow-y-auto p-3.5 space-y-4">
      {/* Build & Preview Health Status Card */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-950/80 p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white tracking-wide">Application Runtime Health</h4>
          </div>
          <span
            className={cn(
              "font-mono text-[9px] font-bold px-2 py-0.5 rounded border",
              studio.previewStatus === "ready"
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                : studio.previewStatus === "starting"
                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                : "bg-red-500/10 text-red-300 border-red-500/20",
            )}
          >
            {studio.previewStatus.toUpperCase()}
          </span>
        </div>

        {studio.activeDiagnostics.length > 0 ? (
          <div className="space-y-2 mt-2">
            {studio.activeDiagnostics.map((diag) => (
              <div
                key={diag.id}
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-400">
                    {diag.filePath}:{diag.line ?? 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => studio.triggerQaRepair(diag)}
                    disabled={studio.busy}
                    className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-500"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Auto-Heal</span>
                  </button>
                </div>
                <p className="mt-1 font-mono text-[11px] text-red-300">{diag.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-400">
            Preview is running cleanly with zero detected runtime exceptions.
          </p>
        )}
      </div>

      {/* Generation Pipeline Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white tracking-wide">Multi-Agent Task Pipeline</h4>
          </div>
          <span className="rounded-md border border-white/[0.08] bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
            {studio.tasks.filter((t) => t.status === "succeeded").length}/{studio.tasks.length} Done
          </span>
        </div>

        {/* Guided Mode Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <span className="font-semibold block mb-1">Architecture Approvals Required</span>
            <div className="space-y-2">
              {pendingApprovals.map((appr) => (
                <div key={appr.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-300">{appr.summary}</span>
                  <button
                    type="button"
                    onClick={() => studio.dispatch({ type: "decideApproval", approvalId: appr.id, status: "approved" })}
                    className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-black hover:bg-amber-400"
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
          <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4 text-center text-xs text-zinc-500">
            No active tasks. Use the prompt box to plan an application.
          </div>
        ) : (
          <div className="space-y-1.5">
            {studio.tasks.map((task) => {
              const statusColor =
                task.status === "succeeded"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : task.status === "running"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : task.status === "failed"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-white/[0.06] bg-zinc-900/40 text-zinc-400";

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-2.5 transition-all text-xs",
                    statusColor,
                  )}
                >
                  <div className="flex items-center gap-2">
                    {task.status === "succeeded" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : task.status === "running" ? (
                      <Clock className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    ) : task.status === "failed" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-zinc-600" />
                    )}
                    <div>
                      <span className="font-semibold text-zinc-200">{task.title}</span>
                      <span className="block font-mono text-[10px] text-zinc-500">
                        {task.targetFilePath}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded border border-white/[0.08] bg-zinc-950/60 text-zinc-400">
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
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            <span>Run Remaining {runnableTasks.length} Tasks</span>
          </Button>
        )}
      </div>

      {/* Version Checkpoints History */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white tracking-wide">Version Snapshots</h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{studio.versions.length} Revisions</span>
        </div>

        <div className="space-y-1">
          {studio.versions.map((ver) => (
            <div
              key={ver.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-950/60 p-2 text-xs"
            >
              <div>
                <span className="font-semibold text-zinc-300">{ver.label}</span>
                <span className="block font-mono text-[9px] text-zinc-500">
                  {new Date(ver.createdAt).toLocaleTimeString()} · {ver.manifest.length} files
                </span>
              </div>
              <button
                type="button"
                onClick={() => studio.restoreVersion(ver.id)}
                className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700 hover:text-white"
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

