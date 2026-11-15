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
  Laptop,
  Maximize2,
  Monitor,
  MousePointerClick,
  MousePointerSquareDashed,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  X,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { buildSandpackFiles } from "@/lib/sandpack/build-files";
import { generateStandaloneHtmlPreview } from "@/lib/sandpack/standalone-preview";
import { isInspectorMessage } from "@/lib/sandpack/runtime";
import { VIEWPORTS } from "./TopNavBar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SandpackCanvas() {
  const studio = useStudio();
  const previewRef = React.useRef<SandpackPreviewRef>(null);
  const [ready, setReady] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const sandpackFiles = React.useMemo(
    () =>
      buildSandpackFiles(studio.fileMap, {
        colors: studio.designSystem.colors,
        fontSans: studio.designSystem.typography.fontSans,
        fontMono: studio.designSystem.typography.fontMono,
        radius: studio.designSystem.radius,
      }),
    [studio.fileMap, studio.designSystem],
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
      if (msg.type === "status") {
        if (
          msg.status === "initializing" ||
          msg.status === "installing-dependencies" ||
          msg.status === "transpiling" ||
          msg.status === "evaluating"
        ) {
          studio.dispatch({ type: "setPreviewStatus", status: "starting" });
        } else if ((msg.status === "idle" || msg.status === "done") && studio.previewStatus !== "runtime_error") {
          studio.dispatch({ type: "setPreviewStatus", status: "ready" });
        }
      }
      if (
        msg.type === "action" &&
        msg.action === "notification" &&
        (msg as { notificationType?: string }).notificationType === "error"
      ) {
        const errorMsg =
          (msg as { message?: string }).message ||
          (msg as { title?: string }).title ||
          "Sandpack compilation error";
        studio.dispatch({ type: "setPreviewStatus", status: "build_error" });
        studio.dispatch({
          type: "addDiagnostic",
          diagnostic: {
            id: `diag_build_${Date.now()}`,
            projectId: studio.projectId,
            filePath: (msg as { path?: string }).path || "src/app/page.tsx",
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
  }, [ready, studio]);

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
    <div className="relative flex h-full flex-col bg-canvas select-none overflow-hidden">
      {/* Canvas Top Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c111d]/95 px-4 backdrop-blur-md z-10 whitespace-nowrap overflow-x-auto">
        {/* Left: Visual Inspect Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              studio.dispatch({ type: "setInspect", enabled: !studio.inspectEnabled })
            }
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-all shadow-sm",
              studio.inspectEnabled
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-500/40 shadow-emerald-500/20"
                : "border-white/[0.08] bg-zinc-900/60 text-zinc-300 hover:border-white/[0.18] hover:bg-zinc-800",
            )}
          >
            <MousePointerSquareDashed
              className={cn("h-3.5 w-3.5", studio.inspectEnabled ? "text-emerald-400 animate-pulse" : "text-zinc-400")}
            />
            <span>Visual Inspect:</span>
            <span className={cn("font-bold font-mono", studio.inspectEnabled ? "text-emerald-300" : "text-zinc-400")}>
              {studio.inspectEnabled ? "ON" : "OFF"}
            </span>
          </button>

          {/* Selected Element Pill */}
          {studio.selected ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs">
              <span className="font-mono font-bold text-emerald-300">
                &lt;{studio.selected.tagName}&gt;
              </span>
              <span className="text-zinc-500">·</span>
              <span className="font-mono text-[10px] text-zinc-300">
                {studio.selected.filePath.split("/").pop()}:{studio.selected.line}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400 hidden 2xl:inline">
              Click any element in preview to tweak typography, padding & colors directly
            </span>
          )}
        </div>

        {/* Right: Stage Backgrounds, Viewports & Reload */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Canvas Stage Background Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-zinc-950/80 p-0.5 shadow-sm">
            <span className="hidden xl:inline px-1.5 text-[10px] font-semibold text-zinc-400">
              Stage:
            </span>
            {[
              { id: "light", label: "⚪ Light", name: "Light Studio Stage (Figma Style)" },
              { id: "aurora", label: "🔮 Aurora", name: "Luminous Aurora Mesh" },
              { id: "grid", label: "⊞ Grid", name: "Blueprint Engineering Grid" },
              { id: "dots", label: "✦ Dots", name: "Architectural Dot Matrix" },
              { id: "sunset", label: "🌅 Sunset", name: "Sunset Dusk Glow" },
              { id: "minimal", label: "⚫ Dark", name: "Minimal Dark Charcoal" },
            ].map((bg) => {
              const active = studio.canvasBg === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => studio.dispatch({ type: "setCanvasBg", canvasBg: bg.id as any })}
                  title={bg.name}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all",
                    active
                      ? "bg-emerald-500 text-zinc-950 font-bold shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60",
                  )}
                >
                  {bg.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-zinc-950/80 p-0.5">
            {[
              { id: "desktop", icon: Monitor, label: "100%" },
              { id: "tablet", icon: Tablet, label: "768px" },
              { id: "mobile", icon: Smartphone, label: "375px" },
            ].map((vp) => {
              const Icon = vp.icon;
              const active = studio.viewport === vp.id;
              return (
                <button
                  key={vp.id}
                  type="button"
                  onClick={() => studio.dispatch({ type: "setViewport", viewport: vp.id as any })}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-all",
                    active
                      ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{vp.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleReload}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-900/60 text-zinc-400 transition-colors hover:border-white/[0.16] hover:bg-zinc-800 hover:text-white"
            title="Reload canvas preview"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 transition-transform", isRefreshing && "animate-spin text-emerald-400")} />
          </button>
        </div>
      </div>

      {/* Canvas Viewport Frame with Selectable Multi-Backgrounds */}
      <div
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-auto p-6 transition-all duration-300",
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
            "studio-preview-shell relative flex flex-col h-full overflow-hidden rounded-2xl transition-all duration-300",
            studio.canvasBg === "light"
              ? "border border-zinc-300 bg-zinc-950 shadow-2xl shadow-zinc-500/30 ring-1 ring-zinc-300/80"
              : "border border-white/[0.12] bg-zinc-950 shadow-2xl shadow-black/90 ring-1 ring-white/10",
            width ? "shadow-emerald-950/40" : "w-full",
          )}
          style={width ? { width, maxWidth: "100%" } : undefined}
        >
          {/* High-End Browser Window Chrome */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.08] bg-zinc-900/90 px-3.5 backdrop-blur-md select-none">
            {/* macOS window control dots */}
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/90 border border-[#e0443e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/90 border border-[#dea123]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/90 border border-[#1aab29]" />
            </div>

            {/* Browser URL bar */}
            <div className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-950/80 px-3 py-0.5 font-mono text-[10px] text-zinc-300 shadow-inner">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-zinc-500">https://</span>
              <span className="text-zinc-100 font-semibold">{studio.projectName.toLowerCase().replace(/\s+/g, "-")}.preview</span>
              <span className="text-zinc-500">/</span>
            </div>

            {/* Live Indicator & Open in New Tab */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {studio.previewStatus === "ready" ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      LIVE
                    </span>
                  </>
                ) : studio.previewStatus === "starting" ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-mono text-[9px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      COMPILING
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                    <span className="font-mono text-[9px] text-red-300 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                      {studio.previewStatus === "build_error" ? "BUILD ERROR" : "RUNTIME ERROR"}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                title="Open Preview in New Browser Tab"
                className="flex items-center gap-1 rounded border border-white/[0.1] bg-zinc-800/90 px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all shadow-sm"
              >
                <span>Open</span>
                <ExternalLink className="h-2.5 w-2.5 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Professional Self-Healing Error Overlay */}
          {(studio.previewStatus === "runtime_error" || studio.previewStatus === "build_error") &&
            studio.activeDiagnostics.length > 0 && (
              <div className="absolute inset-x-4 top-14 z-30 rounded-xl border border-red-500/40 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-red-500/20 p-2 text-red-400 border border-red-500/30">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-red-200">
                          {studio.previewStatus === "build_error"
                            ? "Preview Compilation Failed"
                            : "Application Runtime Error"}
                        </span>
                        {studio.activeDiagnostics[0].filePath && (
                          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                            {studio.activeDiagnostics[0].filePath}
                            {studio.activeDiagnostics[0].line ? `:${studio.activeDiagnostics[0].line}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-300 font-mono line-clamp-2">
                        {studio.activeDiagnostics[0].message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => studio.triggerQaRepair(studio.activeDiagnostics[0])}
                      disabled={studio.busy}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-all"
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
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-all"
                    >
                      <Code2 className="h-3.5 w-3.5 text-zinc-400" />
                      <span>View Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        studio.dispatch({ type: "clearDiagnostics" });
                        studio.dispatch({ type: "setPreviewStatus", status: "ready" });
                      }}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
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
              theme="dark"
              files={sandpackFiles}
              customSetup={{
                dependencies: {
                  "lucide-react": "^0.344.0",
                  clsx: "^2.1.0",
                  "tailwind-merge": "^2.2.1",
                },
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
