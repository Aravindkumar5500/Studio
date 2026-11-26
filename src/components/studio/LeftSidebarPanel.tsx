"use client";

import * as React from "react";
import { Activity, Folder, Sparkles } from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";
import { FileExplorerPanel } from "./FileExplorerPanel";
import { AiChatPanel } from "./AiChatPanel";
import { ActivityPanel } from "./ActivityPanel";

export type SidebarTab = "chat" | "files" | "activity";

export function LeftSidebarPanel() {
  const studio = useStudio();
  const [tab, setTab] = React.useState<SidebarTab>("chat");

  const totalFiles = Object.keys(studio.files).length;
  const isBusy = studio.busy;
  const hasPendingApprovals = studio.approvals.some((a) => a.status === "pending");
  const runningTask = studio.tasks.find((t) => t.status === "running");
  const hasErrors =
    studio.previewStatus === "runtime_error" || studio.previewStatus === "build_error";

  return (
    <aside className="flex h-full w-full lg:w-[290px] xl:w-[330px] shrink-0 min-w-0 flex-col border-r border-border bg-panel select-none overflow-hidden">
      {/* Top Segmented Tab Switcher */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 bg-surface/60">
        <div
          role="tablist"
          aria-label="Workspace left sidebar"
          className="flex w-full items-center gap-1 rounded-xl border border-border bg-surface p-1"
        >
          {/* AI Assistant Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chat"}
            onClick={() => setTab("chat")}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors",
              tab === "chat"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                tab === "chat" ? "text-primary" : "text-muted-foreground",
                isBusy && "animate-spin text-primary",
              )}
            />
            <span>Copilot</span>
            {(isBusy || hasPendingApprovals || runningTask) && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
            )}
          </button>

          {/* Files Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "files"}
            onClick={() => setTab("files")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors",
              tab === "files"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Folder
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                tab === "files" ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span>Files</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.2 font-mono text-[10px] font-medium border transition-colors",
                tab === "files"
                  ? "bg-accent text-accent-foreground border-primary/25"
                  : "bg-card text-muted-foreground border-border",
              )}
            >
              {totalFiles}
            </span>
          </button>

          {/* Activity & Tasks Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "activity"}
            onClick={() => setTab("activity")}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors",
              tab === "activity"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Activity
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                tab === "activity"
                  ? "text-primary"
                  : hasErrors
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            />
            <span>Activity</span>
            {hasErrors ? (
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            ) : runningTask ? (
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            ) : null}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "chat" ? (
          <AiChatPanel onSwitchToFiles={() => setTab("files")} />
        ) : tab === "files" ? (
          <FileExplorerPanel />
        ) : (
          <ActivityPanel />
        )}
      </div>
    </aside>
  );
}
