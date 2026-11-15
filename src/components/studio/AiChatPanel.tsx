"use client";

import * as React from "react";
import {
  ArrowUp,
  Bot,
  Check,
  Code2,
  FileCode2,
  Folder,
  Loader2,
  Play,
  Sparkles,
  User,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const QUICK_PROMPTS = [
  { label: "Add a pricing section with 3 tiers", icon: Sparkles },
  { label: "Make hero headline larger and centered", icon: Wand2 },
  { label: "Switch primary colour to cyber cyan", icon: Zap },
  { label: "Add sticky navigation bar with menu", icon: Bot },
];

export function AiChatPanel({ onSwitchToFiles }: { onSwitchToFiles?: () => void }) {
  const studio = useStudio();
  const [draft, setDraft] = React.useState("");
  const [mode, setMode] = React.useState<"edit" | "plan">("edit");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [studio.messages.length, studio.busy]);

  async function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || studio.busy) return;
    setDraft("");
    if (mode === "plan") {
      await studio.planBuild(trimmed);
      return;
    }
    await studio.sendChatMessage(trimmed);
  }

  const pendingApprovals = studio.approvals.filter((a) => a.status === "pending");
  const runnableTasks = studio.tasks.filter(
    (task) => task.status === "pending" || task.status === "awaiting_approval",
  );
  const totalFiles = Object.keys(studio.files).length;

  return (
    <div className="flex h-full flex-col bg-[#0b0f19]/40 select-none">
      {/* Subheader: Mode Switcher & Quick Files Link */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-3.5 bg-black/20 backdrop-blur-md">
        {/* Left: Quick Files Count Pill */}
        {onSwitchToFiles && (
          <button
            type="button"
            onClick={onSwitchToFiles}
            title="Browse generated workspace files"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-emerald-500/40 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
          >
            <Folder className="h-3 w-3 text-emerald-400" />
            <span>Files</span>
            <span className="rounded bg-zinc-800 px-1 py-0.2 font-mono text-[9px] text-zinc-400">
              {totalFiles}
            </span>
          </button>
        )}

        {/* Right: Mode Toggle (Quick Edit vs Plan & Build) */}
        <div className="flex items-center rounded-lg border border-white/[0.08] bg-zinc-950/80 p-0.5 shadow-inner ml-auto">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              mode === "edit"
                ? "bg-gradient-to-r from-zinc-800 to-zinc-900 text-white shadow-sm ring-1 ring-white/[0.1]"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Wand2 className="h-3 w-3 text-emerald-400" />
            <span>Quick Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("plan")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              mode === "plan"
                ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-200 ring-1 ring-emerald-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Plan & Build</span>
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-3.5">
        {/* Welcome Empty State Card */}
        {studio.messages.length === 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 shadow-md shadow-emerald-500/25">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide">Studio AI Copilot</h4>
                <p className="text-[10px] text-zinc-400">Describe what you want to build or change</p>
              </div>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
              Type in natural language to update copy, layout, theme tokens, or trigger multi-agent planning to build complete apps.
            </p>
            <div className="rounded-xl border border-white/[0.05] bg-black/30 p-2.5 text-[10px] text-zinc-400 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Tip: Toggle <strong>Visual Inspect</strong> in the canvas to click any element and inspect styling.</span>
            </div>
          </div>
        )}

        {/* Existing Chat Messages */}
        {studio.messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn(
                "group relative rounded-2xl border p-3.5 text-xs leading-relaxed transition-all shadow-sm",
                isUser
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 ml-4 ring-1 ring-emerald-500/20"
                  : "border-white/[0.08] bg-zinc-900/70 text-zinc-200 mr-2 backdrop-blur-md",
              )}
            >
              {/* Role Header */}
              <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-zinc-400">
                {isUser ? (
                  <>
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600/40 text-emerald-300">
                      <User className="h-2.5 w-2.5" />
                    </div>
                    <span className="font-semibold text-emerald-300">You</span>
                  </>
                ) : (
                  <>
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 text-zinc-950 font-bold shadow-sm">
                      <Sparkles className="h-2.5 w-2.5" />
                    </div>
                    <span className="font-semibold text-emerald-300">Studio Copilot</span>
                  </>
                )}
              </div>

              {/* Message Content */}
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-100 font-sans">
                {message.content}
              </p>

              {/* Status pills */}
              {message.statusPills.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {message.statusPills.map((pill) => (
                    <StatusPill
                      key={pill}
                      label={pill}
                      tone={pill === "Failed" ? "error" : "success"}
                    />
                  ))}
                </div>
              )}

              {/* Patched files */}
              {message.patchedFiles.length > 0 && (
                <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-zinc-950/80 p-2.5 shadow-inner">
                  <div className="mb-1.5 text-[9px] uppercase tracking-wider text-zinc-400 font-semibold">
                    Updated Components
                  </div>
                  <div className="space-y-1">
                    {message.patchedFiles.map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => studio.openFile(path)}
                        className="flex w-full items-center gap-1.5 font-mono text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline text-left"
                      >
                        <FileCode2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{path}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Multi-Agent Build Pipeline Section */}
        {studio.tasks.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-3.5 backdrop-blur-md shadow-lg">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                Multi-Agent Build Pipeline
              </span>
              {runnableTasks.length > 0 && (
                <Button
                  size="xs"
                  className="gap-1.5 bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 shadow-sm shadow-emerald-500/25"
                  disabled={
                    studio.busy ||
                    (studio.workflowMode === "guided" && pendingApprovals.length > 0)
                  }
                  onClick={() => void studio.runPendingTasks()}
                >
                  <Play className="h-3 w-3 fill-current" />
                  Run {runnableTasks.length} tasks
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {studio.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-zinc-950/60 px-2.5 py-1.5 text-[11px]"
                >
                  <TaskDot status={task.status} />
                  <span className="truncate text-zinc-200 font-medium">{task.title}</span>
                  {task.status === "failed" ? (
                    <button
                      type="button"
                      onClick={() => {
                        studio.dispatch({
                          type: "updateTask",
                          taskId: task.id,
                          patch: { status: "pending", error: null },
                        });
                        studio.dispatch({ type: "setError", error: null });
                        void studio.runPendingTasks();
                      }}
                      className="ml-auto shrink-0 rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[9px] font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                      Retry Task
                    </button>
                  ) : (
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-500 uppercase">
                      {task.provider}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approve All & Build App banner in Guided Mode */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-teal-500/10 p-3.5 shadow-xl shadow-emerald-500/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-1">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span>Architecture Plan & PRD Ready</span>
            </div>
            <p className="text-[11px] text-zinc-300 mb-3 leading-relaxed">
              {pendingApprovals.length} approval item{pendingApprovals.length > 1 ? "s" : ""} pending. Approve all to trigger the multi-agent generation pipeline.
            </p>
            <Button
              size="sm"
              className="w-full gap-2 bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
              disabled={studio.busy}
              onClick={() => {
                pendingApprovals.forEach((a) => {
                  studio.dispatch({ type: "decideApproval", approvalId: a.id, status: "approved" });
                });
                window.setTimeout(() => {
                  void studio.runPendingTasks();
                }, 150);
              }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Approve & Build App ({studio.tasks.length} tasks)</span>
            </Button>
          </div>
        )}

        {/* Approval requests */}
        {pendingApprovals.map((approval) => (
          <div
            key={approval.id}
            className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <Sparkles className="h-3 w-3" />
              <span>Review Required · {approval.stage.replace("_", " ")}</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-200">{approval.summary}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="xs"
                className="bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400"
                onClick={() =>
                  studio.dispatch({
                    type: "decideApproval",
                    approvalId: approval.id,
                    status: "approved",
                  })
                }
              >
                <Check className="h-3 w-3 mr-1" />
                Approve & Apply
              </Button>
              <Button
                size="xs"
                variant="outline"
                className="border-white/[0.1] bg-zinc-900 text-zinc-300"
                onClick={() =>
                  studio.dispatch({
                    type: "decideApproval",
                    approvalId: approval.id,
                    status: "rejected",
                  })
                }
              >
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        ))}

        {/* Loading status */}
        {studio.busy && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300 shadow-sm animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
            <span className="font-medium">AI is generating code and updating preview…</span>
          </div>
        )}
      </div>

      {/* Quick Prompts & High-Contrast Input Box */}
      <div className="shrink-0 border-t border-white/[0.08] p-3.5 bg-black/40 backdrop-blur-xl">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => void submit(item.label)}
                disabled={studio.busy}
                className="group flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-zinc-900/70 px-2.5 py-1 text-[10px] font-medium text-zinc-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-40 shadow-sm"
              >
                <Icon className="h-2.5 w-2.5 text-zinc-400 transition-colors group-hover:text-emerald-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Text Input Container with High Contrast & Sleek Border Glow */}
        <div className="relative rounded-2xl border border-slate-700/80 bg-[#101726] p-2 shadow-inner transition-all focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/20">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(draft);
              }
            }}
            placeholder={
              mode === "plan"
                ? "Describe what to build — e.g. “A modern SaaS landing page with sticky navbar, features, and pricing”"
                : "Ask for any design change — e.g. “Add a testimonial carousel under the hero”"
            }
            className="min-h-[76px] border-0 bg-transparent px-2 py-1 text-xs text-slate-100 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none font-sans"
          />
          <div className="flex items-center justify-between px-2 pt-1 border-t border-white/[0.06]">
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <span>Press</span>
              <kbd className="rounded border border-white/[0.1] bg-zinc-850 px-1 font-mono text-[9px] text-zinc-300">
                ↵
              </kbd>
              <span>to send</span>
            </span>

            <Button
              size="icon"
              className={cn(
                "h-7 w-7 rounded-lg transition-all",
                draft.trim()
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold shadow-md shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400"
                  : "bg-zinc-800 text-zinc-500 hover:bg-zinc-800",
              )}
              disabled={studio.busy || !draft.trim()}
              onClick={() => void submit(draft)}
              aria-label="Send prompt"
            >
              {studio.busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : mode === "plan" ? (
                <Sparkles className="h-3.5 w-3.5 text-zinc-950" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5 text-zinc-950" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({
  label,
  tone = "success",
}: {
  label: string;
  tone?: "success" | "pending" | "error";
}) {
  const tones = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
  } as const;
  return <span className={cn("studio-pill text-[10px]", tones[tone])}>{label}</span>;
}

function TaskDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-emerald-400 ring-4 ring-emerald-500/20",
    running: "bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20",
    failed: "bg-red-400 ring-4 ring-red-500/20",
    awaiting_approval: "bg-amber-400 ring-4 ring-amber-500/20",
  };
  return (
    <span
      className={cn("h-2 w-2 rounded-full", map[status] ?? "bg-zinc-500")}
      aria-hidden="true"
    />
  );
}
