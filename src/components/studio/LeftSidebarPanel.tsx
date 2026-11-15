"use client";

import * as React from "react";
import {
  Code2,
  Folder,
  Layers,
  Sparkles,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";
import { FileExplorerPanel } from "./FileExplorerPanel";
import { AiChatPanel } from "./AiChatPanel";

export type SidebarTab = "chat" | "files";

export function LeftSidebarPanel() {
  const studio = useStudio();
  const [tab, setTab] = React.useState<SidebarTab>("chat");

  const totalFiles = Object.keys(studio.files).length;
  const isBusy = studio.busy;
  const hasPendingApprovals = studio.approvals.some((a) => a.status === "pending");
  const runningTask = studio.tasks.find((t) => t.status === "running");

  return (
    <aside className="flex h-full w-[350px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0b0f19]/95 backdrop-blur-2xl transition-all duration-200 select-none">
      {/* Top Segmented Tab Switcher */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-3.5 bg-black/30">
        <div className="flex w-full items-center gap-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 p-1 shadow-inner">
          {/* AI Assistant Tab */}
          <button
            type="button"
            onClick={() => setTab("chat")}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all",
              tab === "chat"
                ? "bg-gradient-to-r from-zinc-800 to-zinc-900 text-white shadow-sm ring-1 ring-white/[0.12]"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40",
            )}
          >
            <Sparkles
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                tab === "chat" ? "text-emerald-400" : "text-zinc-500",
                isBusy && "animate-spin text-emerald-400",
              )}
            />
            <span>AI Copilot</span>
            {(isBusy || hasPendingApprovals || runningTask) && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </button>

          {/* Files Tab */}
          <button
            type="button"
            onClick={() => setTab("files")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all",
              tab === "files"
                ? "bg-gradient-to-r from-zinc-800 to-zinc-900 text-white shadow-sm ring-1 ring-white/[0.12]"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40",
            )}
          >
            <Folder
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                tab === "files" ? "text-emerald-400" : "text-zinc-500",
              )}
            />
            <span>Files</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.2 font-mono text-[10px] font-medium border transition-colors",
                tab === "files"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                  : "bg-zinc-900 text-zinc-400 border-white/[0.06]",
              )}
            >
              {totalFiles}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "chat" ? (
          <AiChatPanel onSwitchToFiles={() => setTab("files")} />
        ) : (
          <FileExplorerPanel />
        )}
      </div>
    </aside>
  );
}
