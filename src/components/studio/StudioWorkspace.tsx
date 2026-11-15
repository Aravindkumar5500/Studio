"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, X } from "lucide-react";
import { StudioProvider, useStudio } from "@/store/studio-store";
import { TopNavBar } from "./TopNavBar";
import { LeftSidebarPanel } from "./LeftSidebarPanel";
import { DagGraphView } from "./DagGraphView";
import { PrdSpecView } from "./PrdSpecView";
import { PropertiesInspector } from "./PropertiesInspector";
import { ExportDialog } from "./ExportDialog";
import { DeployDialog } from "./DeployDialog";

const SandpackCanvas = dynamic(
  () => import("./SandpackCanvas").then((mod) => mod.SandpackCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="font-mono text-xs text-zinc-400">Loading Preview Canvas...</span>
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="font-mono text-xs text-zinc-400">Loading Code Editor...</span>
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

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      {/* Top Header */}
      <TopNavBar onExport={() => setExportOpen(true)} onDeploy={() => setDeployOpen(true)} />

      {/* Error notification banner */}
      {studio.error && (
        <div className="flex items-center gap-2.5 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200 backdrop-blur-md">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="flex-1 font-medium">{studio.error}</span>
          <button
            type="button"
            onClick={() => studio.dispatch({ type: "setError", error: null })}
            className="rounded p-1 text-red-400 hover:bg-red-500/20 hover:text-red-200"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 3-Column Workspace Layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left Panel: Clean Tabbed AI Chat & File Explorer */}
        <LeftSidebarPanel />

        {/* Center Main View Canvas */}
        <main className="flex min-w-0 flex-1 flex-col bg-canvas">
          {studio.viewMode === "preview" && <SandpackCanvas />}
          {studio.viewMode === "code" && <MonacoCodePanel />}
          {studio.viewMode === "dag" && <DagGraphView />}
          {studio.viewMode === "prd" && <PrdSpecView />}
        </main>

        {/* Right Inspector Panel */}
        <PropertiesInspector />
      </div>

      {/* Export & Deploy Dialogs */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <DeployDialog open={deployOpen} onOpenChange={setDeployOpen} />
    </div>
  );
}
