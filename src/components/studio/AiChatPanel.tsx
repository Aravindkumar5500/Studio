"use client";

import * as React from "react";
import {
  ArrowUp,
  Check,
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

export function AiChatPanel({ onSwitchToFiles }: { onSwitchToFiles?: () => void }) {
  const studio = useStudio();
  const [draft, setDraft] = React.useState("");
  const [mode, setMode] = React.useState<"edit" | "plan">("edit");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Derive contextual prompt suggestions from the project's live PRD features or backend config
  const suggestedPrompts = React.useMemo(() => {
    const featurePrompts =
      studio.requirements?.features
        .slice(0, 3)
        .map((f) => `Enhance "${f.title}" section in ${studio.requirements?.productName ?? "the app"}`) ?? [];
    if (featurePrompts.length > 0) return featurePrompts;
    return studio.studioConfig?.defaultChatPrompts ?? [];
  }, [studio.requirements, studio.studioConfig?.defaultChatPrompts]);

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
    <div className="flex h-full flex-col bg-panel select-none">
      {/* Subheader: Mode Switcher & Quick Files Link */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-surface/50">
        {onSwitchToFiles && (
          <button
            type="button"
            onClick={onSwitchToFiles}
            title="Browse generated workspace files"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:bg-surface transition-colors shadow-sm"
          >
            <Folder className="h-3 w-3 text-primary" />
            <span>Files</span>
            <span className="rounded bg-surface px-1 py-0.2 font-mono text-[9px] text-muted-foreground border border-border">
              {totalFiles}
            </span>
          </button>
        )}

        <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 ml-auto">
          <button
            type="button"
            aria-pressed={mode === "edit"}
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
              mode === "edit"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Wand2 className="h-3 w-3 text-primary" />
            <span>Quick Edit</span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "plan"}
            onClick={() => setMode("plan")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
              mode === "plan"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Plan &amp; Build</span>
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3.5">
        {studio.messages.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground tracking-wide">Studio AI Copilot</h4>
                <p className="text-[11px] text-muted-foreground">
                  Describe what you want to build or change
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Type in natural language to update copy, layout, theme tokens, or trigger multi-agent
              planning to build complete apps.
            </p>
            <div className="rounded-lg border border-border bg-surface p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                Tip: Toggle <strong className="text-foreground">Visual Inspect</strong> in the canvas
                to click any element and edit styling directly.
              </span>
            </div>
          </div>
        )}

        {studio.messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn(
                "group relative rounded-xl border p-3.5 text-xs leading-relaxed shadow-sm",
                isUser
                  ? "border-primary/25 bg-accent/60 text-foreground ml-4"
                  : "border-border bg-card text-foreground mr-2",
              )}
            >
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                {isUser ? (
                  <>
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <User className="h-2.5 w-2.5" />
                    </div>
                    <span className="font-semibold text-primary">You</span>
                  </>
                ) : (
                  <>
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Sparkles className="h-2.5 w-2.5" />
                    </div>
                    <span className="font-semibold text-foreground">Studio Copilot</span>
                  </>
                )}
              </div>

              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground font-sans">
                {message.content}
              </p>

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

              {message.patchedFiles.length > 0 && (
                <div className="mt-2.5 rounded-lg border border-border bg-surface p-2.5">
                  <div className="mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Updated Components
                  </div>
                  <div className="space-y-1">
                    {message.patchedFiles.map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => studio.openFile(path)}
                        className="flex w-full items-center gap-1.5 font-mono text-[10px] text-primary hover:underline text-left"
                      >
                        <FileCode2 className="h-3 w-3 shrink-0" />
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
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-card">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Multi-Agent Build Pipeline
              </span>
              {runnableTasks.length > 0 && (
                <Button
                  size="xs"
                  className="gap-1.5 font-semibold"
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
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-[11px]"
                >
                  <TaskDot status={task.status} />
                  <span className="truncate text-foreground font-medium">{task.title}</span>
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
                      className="ml-auto shrink-0 rounded bg-destructive/15 border border-destructive/30 px-2 py-0.5 text-[9px] font-semibold text-destructive hover:bg-destructive/25 transition-colors"
                    >
                      Retry Task
                    </button>
                  ) : (
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground uppercase">
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
          <div className="rounded-xl border border-primary/35 bg-accent p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Architecture Plan &amp; PRD Ready</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              {pendingApprovals.length} approval item{pendingApprovals.length > 1 ? "s" : ""} pending.
              Approve all to trigger the multi-agent generation pipeline.
            </p>
            <Button
              size="sm"
              className="w-full gap-2 font-semibold"
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
              <span>Approve &amp; Build App ({studio.tasks.length} tasks)</span>
            </Button>
          </div>
        )}

        {pendingApprovals.map((approval) => (
          <div key={approval.id} className="rounded-xl border border-warning/35 bg-warning/10 p-3.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
              <Sparkles className="h-3 w-3" />
              <span>Review Required · {approval.stage.replace("_", " ")}</span>
            </div>
            <p className="mt-1.5 text-xs text-foreground">{approval.summary}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="xs"
                onClick={() =>
                  studio.dispatch({
                    type: "decideApproval",
                    approvalId: approval.id,
                    status: "approved",
                  })
                }
              >
                <Check className="h-3 w-3 mr-1" />
                Approve &amp; Apply
              </Button>
              <Button
                size="xs"
                variant="outline"
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

        {studio.busy && (
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-accent px-3.5 py-2.5 text-xs text-accent-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span className="font-medium">AI is generating code and updating preview…</span>
          </div>
        )}
      </div>

      {/* Quick Prompts & Input Box */}
      <div className="shrink-0 border-t border-border p-3.5 bg-surface/60">
        {suggestedPrompts.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {suggestedPrompts.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void submit(label)}
                disabled={studio.busy}
                className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40 shadow-sm"
              >
                <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
                <span className="truncate max-w-[220px]">{label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative rounded-xl border border-input bg-card p-2 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
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
            className="min-h-[72px] border-0 bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-0 resize-none font-sans"
          />
          <div className="flex items-center justify-between px-2 pt-1.5 border-t border-border/70">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>Press</span>
              <kbd className="rounded border border-border bg-surface px-1 font-mono text-[9px] text-foreground">
                ↵
              </kbd>
              <span>to send</span>
            </span>

            <Button
              size="icon"
              className={cn(
                "h-7 w-7 rounded-lg transition-colors",
                draft.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                  : "bg-muted text-muted-foreground hover:bg-muted",
              )}
              disabled={studio.busy || !draft.trim()}
              onClick={() => void submit(draft)}
              aria-label="Send prompt"
            >
              {studio.busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : mode === "plan" ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
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
    success: "border-success/30 bg-success/10 text-success",
    pending: "border-warning/30 bg-warning/10 text-warning",
    error: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;
  return <span className={cn("studio-pill text-[10px]", tones[tone])}>{label}</span>;
}

function TaskDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-success ring-4 ring-success/20",
    running: "bg-primary animate-pulse ring-4 ring-primary/20",
    failed: "bg-destructive ring-4 ring-destructive/20",
    awaiting_approval: "bg-warning ring-4 ring-warning/20",
  };
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", map[status] ?? "bg-muted-foreground/50")}
      aria-hidden="true"
    />
  );
}
