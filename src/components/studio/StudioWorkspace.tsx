"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, PanelLeft, PanelRight, Monitor, X } from "lucide-react";
import { StudioProvider, useStudio } from "@/store/studio-store";
import { TopNavBar } from "./TopNavBar";
import { LeftSidebarPanel } from "./LeftSidebarPanel";
import { DagGraphView } from "./DagGraphView";
import { PrdSpecView } from "./PrdSpecView";
import { PropertiesInspector } from "./PropertiesInspector";
import { ExportDialog } from "./ExportDialog";
import { DeployDialog } from "./DeployDialog";
import { cn } from "@/lib/utils";

const SandpackCanvas = dynamic(
  () => import("./SandpackCanvas").then((mod) => mod.SandpackCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="font-mono text-xs text-muted-foreground">Loading Preview Canvas...</span>
        </div>
      </div>
    ),
  },
);

const MonacoCodePanel = dynamic(
  () => import("./MonacoCodePanel").then((mod) => mod.MonacoCodePanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="font-mono text-xs text-muted-foreground">Loading Code Editor...</span>
        </div>
      </div>
    ),
  },
);

export function StudioWorkspace({ projectId }: { projectId: string }) {
  return (
    <StudioProvider projectId={projectId}>
      <WorkspaceShell />
    </StudioProvider>
  );
}

function WorkspaceShell() {
  const studio = useStudio();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [deployOpen, setDeployOpen] = React.useState(false);
  const [mobilePane, setMobilePane] = React.useState<"left" | "center" | "right">("center");

  return (
    <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-canvas text-foreground">
      {/* Top Header */}
      <TopNavBar onExport={() => setExportOpen(true)} onDeploy={() => setDeployOpen(true)} />

      {/* Error notification banner */}
      {studio.error && (
        <div
          role="alert"
          className="flex min-w-0 items-center gap-2.5 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words font-medium">{studio.error}</span>
          <button
            type="button"
            onClick={() => studio.dispatch({ type: "setError", error: null })}
            className="shrink-0 rounded p-1 hover:bg-destructive/15"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Mobile / Tablet Pane Switcher (hidden on lg+) */}
      <div className="flex lg:hidden shrink-0 items-center gap-1 border-b border-border bg-panel px-3 py-1.5">
        <button
          type="button"
          onClick={() => setMobilePane("left")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
            mobilePane === "left"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <PanelLeft className="h-3.5 w-3.5" />
          <span>Copilot &amp; Files</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("center")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
            mobilePane === "center"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Monitor className="h-3.5 w-3.5" />
          <span>Canvas</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("right")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
            mobilePane === "right"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <PanelRight className="h-3.5 w-3.5" />
          <span>Inspector</span>
        </button>
      </div>

      {/* 3-Column Workspace Layout */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Left Panel: Tabbed AI Chat, Files & Activity */}
        <div
          className={cn(
            "min-h-0 shrink-0",
            mobilePane === "left" ? "flex w-full lg:w-auto" : "hidden lg:flex",
          )}
        >
          <LeftSidebarPanel />
        </div>

        {/* Center Main View Canvas */}
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas",
            mobilePane === "center" ? "flex" : "hidden lg:flex",
          )}
        >
          {studio.viewMode === "preview" && <SandpackCanvas />}
          {studio.viewMode === "code" && <MonacoCodePanel />}
          {studio.viewMode === "dag" && <DagGraphView />}
          {studio.viewMode === "prd" && <PrdSpecView />}
        </main>

        {/* Right Inspector Panel */}
        <div
          className={cn(
            "min-h-0 shrink-0",
            mobilePane === "right" ? "flex w-full lg:w-auto" : "hidden lg:flex",
          )}
        >
          <PropertiesInspector />
        </div>
      </div>

      {/* Export & Deploy Dialogs */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <DeployDialog open={deployOpen} onOpenChange={setDeployOpen} />
    </div>
  );
}
