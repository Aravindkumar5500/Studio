"use client";

import * as React from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
  type SandpackPreviewRef,
} from "@codesandbox/sandpack-react";
import {
  AlertTriangle,
  Code2,
  ExternalLink,
  MousePointerSquareDashed,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { useTheme } from "@/components/theme-provider";
import { buildSandpackFiles } from "@/lib/sandpack/build-files";
import { generateStandaloneHtmlPreview } from "@/lib/sandpack/standalone-preview";
import { isInspectorMessage } from "@/lib/sandpack/runtime";
import { VIEWPORTS } from "./TopNavBar";
import { cn } from "@/lib/utils";
import { extractDependenciesFromFiles } from "@/config/studio-config";

export function SandpackCanvas() {
  const studio = useStudio();
  const { theme } = useTheme();
  const studioRef = React.useRef(studio);
  studioRef.current = studio;
  const previewRef = React.useRef<SandpackPreviewRef>(null);
  const [ready, setReady] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const sandboxDependencies = React.useMemo(
    () => extractDependenciesFromFiles(studio.fileMap, studio.studioConfig?.sandboxDependencies),
    [studio.fileMap, studio.studioConfig?.sandboxDependencies],
  );

  const sandpackFiles = React.useMemo(
    () =>
      buildSandpackFiles(
        studio.fileMap,
        {
          colors: studio.designSystem.colors,
          fontSans: studio.designSystem.typography.fontSans,
          fontMono: studio.designSystem.typography.fontMono,
          radius: studio.designSystem.radius,
        },
        sandboxDependencies,
      ),
    [studio.fileMap, studio.designSystem, sandboxDependencies],
  );

  const postToPreview = React.useCallback((message: Record<string, unknown>) => {
    const iframe = previewRef.current?.getClient()?.iframe;
    iframe?.contentWindow?.postMessage({ source: "studio-shell", ...message }, "*");
  }, []);

  // Receive selections & runtime diagnostics from inside the preview iframe.
  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isInspectorMessage(event.data)) return;
      if (event.data.type === "ready") {
        setReady(true);
        studio.dispatch({ type: "setPreviewStatus", status: "ready" });
        postToPreview({ type: "set-inspect", enabled: studio.inspectEnabled });
        postToPreview({ type: "set-theme", colors: studio.designSystem.colors });
        return;
      }
      if (event.data.type === "runtime-error") {
        studio.dispatch({ type: "setPreviewStatus", status: "runtime_error" });
        studio.dispatch({
          type: "addDiagnostic",
          diagnostic: {
            id: event.data.diagnostic.id,
            projectId: studio.projectId,
            filePath: event.data.diagnostic.filePath,
            line: event.data.diagnostic.line,
            column: event.data.diagnostic.column,
            message: event.data.diagnostic.message,
            stack: event.data.diagnostic.stack,
            severity: event.data.diagnostic.severity,
            timestamp: event.data.diagnostic.timestamp,
          },
        });
        return;
      }
      studio.selectElement(event.data.studioId);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postToPreview, studio]);

  // Listen for Sandpack bundler compilation events
  React.useEffect(() => {
    const client = previewRef.current?.getClient();
    if (!client) return;

    const unsubscribe = client.listen((msg) => {
      const currentStudio = studioRef.current;

      if (msg.type === "status") {
        if (
          msg.status === "initializing" ||
          msg.status === "installing-dependencies" ||
          msg.status === "transpiling" ||
          msg.status === "evaluating"
        ) {
          if (msg.status === "transpiling") {
            currentStudio.dispatch({ type: "clearDiagnostics" });
          }
          currentStudio.dispatch({ type: "setPreviewStatus", status: "starting" });
        } else if (
          (msg.status === "idle" || msg.status === "done") &&
          currentStudio.previewStatus !== "runtime_error" &&
          currentStudio.previewStatus !== "build_error"
        ) {
          currentStudio.dispatch({ type: "setPreviewStatus", status: "ready" });
        }
        return;
      }

      if (msg.type === "done") {
        const hasCompileError = Boolean((msg as { compilatonError?: boolean }).compilatonError);
        if (!hasCompileError && currentStudio.previewStatus !== "runtime_error") {
          currentStudio.dispatch({ type: "clearDiagnostics" });
          currentStudio.dispatch({ type: "setPreviewStatus", status: "ready" });
        }
        return;
      }

      if (msg.type === "action" && msg.action === "show-error") {
        const err = msg as {
          title?: string;
          message?: string;
          path?: string;
          line?: number;
          column?: number;
        };
        const rawPath = (err.path || "").replace(/^\//, "");
        const errorMsg = err.message || err.title || "Sandpack compilation error";
        const line = typeof err.line === "number" && err.line > 0 ? err.line : undefined;
        const column = typeof err.column === "number" && err.column > 0 ? err.column : undefined;

        currentStudio.dispatch({ type: "setPreviewStatus", status: "build_error" });
        currentStudio.dispatch({
          type: "addDiagnostic",
          diagnostic: {
            id: `diag_sandpack_${rawPath}_${line ?? 0}_${errorMsg.slice(0, 64)}`,
            projectId: currentStudio.projectId,
            filePath: rawPath || currentStudio.activeFilePath || "src/app/page.tsx",
            line,
            column,
            message: errorMsg,
            severity: "error",
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      if (
        msg.type === "action" &&
        msg.action === "notification" &&
        (msg as { notificationType?: string }).notificationType === "error"
      ) {
        const notif = msg as { message?: string; title?: string; path?: string };
        const errorMsg = notif.message || notif.title || "Sandpack compilation error";
        const rawPath = (notif.path || "").replace(/^\//, "");
        currentStudio.dispatch({ type: "setPreviewStatus", status: "build_error" });
        currentStudio.dispatch({
          type: "addDiagnostic",
          diagnostic: {
            id: `diag_build_${rawPath}_${errorMsg.slice(0, 64)}`,
            projectId: currentStudio.projectId,
            filePath: rawPath || currentStudio.activeFilePath || "src/app/page.tsx",
            message: errorMsg,
            severity: "error",
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ready]);

  React.useEffect(() => {
    if (ready) postToPreview({ type: "set-inspect", enabled: studio.inspectEnabled });
  }, [ready, studio.inspectEnabled, postToPreview]);

  React.useEffect(() => {
    if (ready) postToPreview({ type: "set-selected", studioId: studio.selected?.studioId ?? null });
  }, [ready, studio.selected?.studioId, postToPreview]);

  React.useEffect(() => {
    if (ready) postToPreview({ type: "set-theme", colors: studio.designSystem.colors });
  }, [ready, studio.designSystem.colors, postToPreview]);

  const width = VIEWPORTS[studio.viewport].width;

  function handleReload() {
    setIsRefreshing(true);
    previewRef.current?.getClient()?.dispatch({ type: "refresh" });
    setTimeout(() => setIsRefreshing(false), 600);
  }

  function handleOpenInNewTab() {
    const html = generateStandaloneHtmlPreview(studio.fileMap, studio.designSystem);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col bg-canvas select-none overflow-hidden">
      {/* Canvas Top Bar */}
      <div className="flex min-h-11 w-full min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-panel px-3 py-1.5 z-10 overflow-x-auto">
        {/* Left: Visual Inspect Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-pressed={studio.inspectEnabled}
            onClick={() =>
              studio.dispatch({ type: "setInspect", enabled: !studio.inspectEnabled })
            }
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors shadow-sm",
              studio.inspectEnabled
                ? "border-primary/40 bg-accent text-accent-foreground ring-1 ring-primary/30"
                : "border-border bg-card text-foreground hover:bg-surface",
            )}
          >
            <MousePointerSquareDashed
              className={cn("h-3.5 w-3.5", studio.inspectEnabled ? "text-primary animate-pulse" : "text-muted-foreground")}
            />
            <span>Visual Inspect:</span>
            <span className={cn("font-bold font-mono", studio.inspectEnabled ? "text-primary" : "text-muted-foreground")}>
              {studio.inspectEnabled ? "ON" : "OFF"}
            </span>
          </button>

          {studio.selected ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-accent px-2.5 py-0.5 text-xs">
              <span className="font-mono font-bold text-primary">
                &lt;{studio.selected.tagName}&gt;
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-[10px] text-foreground">
                {studio.selected.filePath.split("/").pop()}:{studio.selected.line}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground hidden 2xl:inline">
              Click any element in preview to tweak typography, padding &amp; colors
            </span>
          )}
        </div>

        {/* Right: Stage Backgrounds, Viewports & Reload */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            <span className="hidden xl:inline px-1.5 text-[10px] font-semibold text-muted-foreground">
              Stage:
            </span>
            {(studio.studioConfig?.stageBackgrounds ?? []).map((bg) => {
              const active = studio.canvasBg === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => studio.dispatch({ type: "setCanvasBg", canvasBg: bg.id as any })}
                  title={bg.name}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {bg.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            {(
              Object.entries(VIEWPORTS) as [
                keyof typeof VIEWPORTS,
                (typeof VIEWPORTS)[keyof typeof VIEWPORTS],
              ][]
            ).map(([id, vp]) => {
              const Icon = vp.icon;
              const active = studio.viewport === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => studio.dispatch({ type: "setViewport", viewport: id })}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{vp.width ? `${vp.width}px` : "100%"}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleReload}
            aria-label="Reload canvas preview"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            title="Reload canvas preview"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5 transition-transform", isRefreshing && "animate-spin text-primary")}
            />
          </button>
        </div>
      </div>

      {/* Canvas Viewport Frame */}
      <div
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-auto p-4 sm:p-6 transition-all duration-300",
          studio.canvasBg === "light" && "bg-canvas-light",
          studio.canvasBg === "aurora" && "bg-canvas-aurora",
          studio.canvasBg === "sunset" && "bg-canvas-sunset",
          studio.canvasBg === "grid" && "bg-canvas-grid",
          studio.canvasBg === "dots" && "bg-canvas-dots",
          studio.canvasBg === "minimal" && "bg-canvas-minimal",
        )}
      >
        <div
          className={cn(
            "studio-preview-shell relative flex flex-col h-full overflow-hidden rounded-2xl border border-border bg-card shadow-elevated transition-all duration-300",
            width ? "" : "w-full",
          )}
          style={width ? { width, maxWidth: "100%" } : undefined}
        >
          {/* Browser Window Chrome */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-panel px-3.5 select-none">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
            </div>

            <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-0.5 font-mono text-[10px] text-muted-foreground max-w-[260px] truncate">
              <ShieldCheck className="h-3 w-3 shrink-0 text-success" />
              <span className="hidden sm:inline">https://</span>
              <span className="text-foreground font-semibold truncate">
                {studio.projectName.toLowerCase().replace(/\s+/g, "-")}.preview
              </span>
              <span>/</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {studio.previewStatus === "ready" ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    <span className="font-mono text-[9px] text-success font-bold bg-success/10 px-1.5 py-0.5 rounded border border-success/25">
                      LIVE
                    </span>
                  </>
                ) : studio.previewStatus === "starting" ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                    <span className="font-mono text-[9px] text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded border border-warning/25">
                      COMPILING
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                    <span className="font-mono text-[9px] text-destructive font-bold bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/25">
                      {studio.previewStatus === "build_error" ? "BUILD ERROR" : "RUNTIME ERROR"}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                title="Open Preview in New Browser Tab"
                className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span>Open</span>
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Self-Healing Error Overlay */}
          {(studio.previewStatus === "runtime_error" || studio.previewStatus === "build_error") &&
            studio.activeDiagnostics.length > 0 && (
              <div
                role="alert"
                aria-live="polite"
                className="absolute inset-x-4 top-14 z-30 rounded-xl border border-destructive/40 bg-card/95 p-4 shadow-elevated backdrop-blur-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-destructive/15 p-2 text-destructive border border-destructive/25">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {studio.previewStatus === "build_error"
                            ? "Preview Compilation Failed"
                            : "Application Runtime Error"}
                        </span>
                        {studio.activeDiagnostics[0].filePath && (
                          <span className="rounded bg-surface border border-border px-2 py-0.5 font-mono text-[11px] text-foreground">
                            {studio.activeDiagnostics[0].filePath.replace(/^\//, "")}
                            {studio.activeDiagnostics[0].line && studio.activeDiagnostics[0].line > 0
                              ? `:${studio.activeDiagnostics[0].line}`
                              : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-words text-xs text-destructive font-mono line-clamp-3">
                        {studio.activeDiagnostics[0].message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => studio.triggerQaRepair(studio.activeDiagnostics[0])}
                      disabled={studio.busy}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{studio.busy ? "Healing..." : "Self-Heal with AI"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const file = studio.activeDiagnostics[0].filePath || "src/app/page.tsx";
                        studio.openFile(file.replace(/^\//, ""));
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>View Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        studio.dispatch({ type: "clearDiagnostics" });
                        studio.dispatch({ type: "setPreviewStatus", status: "ready" });
                      }}
                      aria-label="Dismiss error banner"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Sandpack Preview Container */}
          <div
            className="flex-1 overflow-hidden min-h-0 transition-colors duration-300"
            style={{ backgroundColor: studio.designSystem.colors.background || "#09090b" }}
          >
            <SandpackProvider
              template="react-ts"
              theme={theme}
              files={sandpackFiles}
              customSetup={{
                dependencies: sandboxDependencies,
              }}
              options={{ recompileMode: "delayed", recompileDelay: 300 }}
            >
              <SandpackLayout className="!h-full !border-0 !bg-transparent">
                <SandpackPreview
                  ref={previewRef}
                  showNavigator={false}
                  showOpenInCodeSandbox={false}
                  showRefreshButton={false}
                  className="!h-full"
                  style={{ height: "100%" }}
                />
              </SandpackLayout>
            </SandpackProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
