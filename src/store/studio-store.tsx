"use client";

import * as React from "react";
import type {
  ApprovalDoc,
  ConversationMessageDoc,
  GenerationTaskDoc,
  ProjectVersionDoc,
  ViewMode,
  ViewportPreset,
  WorkflowMode,
} from "@/types/firestore";
import type { DesignSystem, Prd } from "@/lib/ai/schemas";
import type { VfsFile, VfsMap } from "@/lib/vfs/types";
import { makeVfsFile } from "@/lib/vfs/store";
import { buildSeedProject, buildMinimalProject, SEED_DESIGN_SYSTEM } from "@/lib/vfs/seed";
import { normalizePath, sha256Sync } from "@/lib/hash";
import { nowIso, shortId } from "@/lib/utils";
import type { SelectedElementInfo } from "@/lib/patch/ast-patch";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { authenticatedFetch } from "@/lib/firebase/auth-client";
import { deleteFile as deleteFileDoc, loadProjectFiles, persistFile, persistFiles } from "@/lib/vfs/store";

export interface StudioState {
  projectId: string;
  projectName: string;
  workflowMode: WorkflowMode;
  viewMode: ViewMode;
  viewport: ViewportPreset;
  inspectEnabled: boolean;
  files: VfsMap;
  activeFilePath: string;
  selected: SelectedElementInfo | null;
  messages: ConversationMessageDoc[];
  tasks: GenerationTaskDoc[];
  approvals: ApprovalDoc[];
  versions: ProjectVersionDoc[];
  requirements: Prd | null;
  designSystem: DesignSystem;
  canvasBg: "light" | "aurora" | "dots" | "grid" | "sunset" | "minimal";
  saveState: "idle" | "saving" | "saved" | "error";
  busy: boolean;
  error: string | null;
  persistence: "firestore" | "memory";
}

type Action =
  | { type: "hydrate"; files: VfsMap; persistence: StudioState["persistence"] }
  | { type: "setFiles"; files: VfsMap }
  | { type: "writeFile"; file: VfsFile }
  | { type: "deleteFile"; filePath: string }
  | { type: "setActiveFile"; filePath: string }
  | { type: "setViewMode"; viewMode: ViewMode }
  | { type: "setViewport"; viewport: ViewportPreset }
  | { type: "setWorkflowMode"; workflowMode: WorkflowMode }
  | { type: "setInspect"; enabled: boolean }
  | { type: "select"; selected: SelectedElementInfo | null }
  | { type: "addMessage"; message: ConversationMessageDoc }
  | { type: "setTasks"; tasks: GenerationTaskDoc[] }
  | { type: "updateTask"; taskId: string; patch: Partial<GenerationTaskDoc> }
  | { type: "setApprovals"; approvals: ApprovalDoc[] }
  | { type: "decideApproval"; approvalId: string; status: "approved" | "rejected" }
  | { type: "addVersion"; version: ProjectVersionDoc }
  | { type: "setRequirements"; requirements: Prd | null }
  | { type: "setDesignSystem"; designSystem: DesignSystem }
  | { type: "setCanvasBg"; canvasBg: StudioState["canvasBg"] }
  | { type: "setSaveState"; saveState: StudioState["saveState"] }
  | { type: "setBusy"; busy: boolean }
  | { type: "setError"; error: string | null }
  | { type: "setProjectName"; name: string };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        files: action.files,
        persistence: action.persistence,
        activeFilePath:
          action.files[state.activeFilePath] !== undefined
            ? state.activeFilePath
            : Object.keys(action.files).sort()[0] ?? "",
      };
    case "setFiles":
      return { ...state, files: action.files };
    case "writeFile":
      return {
        ...state,
        files: { ...state.files, [action.file.filePath]: action.file },
      };
    case "deleteFile": {
      const next = { ...state.files };
      delete next[action.filePath];
      return {
        ...state,
        files: next,
        activeFilePath:
          state.activeFilePath === action.filePath
            ? Object.keys(next).sort()[0] ?? ""
            : state.activeFilePath,
        selected:
          state.selected?.filePath === action.filePath ? null : state.selected,
      };
    }
    case "setActiveFile":
      return { ...state, activeFilePath: action.filePath };
    case "setViewMode":
      return { ...state, viewMode: action.viewMode };
    case "setViewport":
      return { ...state, viewport: action.viewport };
    case "setWorkflowMode":
      return { ...state, workflowMode: action.workflowMode };
    case "setInspect":
      return { ...state, inspectEnabled: action.enabled, selected: action.enabled ? state.selected : null };
    case "select":
      return { ...state, selected: action.selected };
    case "addMessage":
      return { ...state, messages: [...state.messages, action.message] };
    case "setTasks":
      return { ...state, tasks: action.tasks };
    case "updateTask":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, ...action.patch, updatedAt: nowIso() } : t,
        ),
      };
    case "setApprovals":
      return { ...state, approvals: action.approvals };
    case "decideApproval":
      return {
        ...state,
        approvals: state.approvals.map((a) =>
          a.id === action.approvalId
            ? { ...a, status: action.status, decidedAt: nowIso(), decidedBy: "me" }
            : a,
        ),
      };
    case "addVersion":
      return { ...state, versions: [action.version, ...state.versions] };
    case "setRequirements":
      return { ...state, requirements: action.requirements };
    case "setDesignSystem":
      return { ...state, designSystem: action.designSystem };
    case "setCanvasBg":
      return { ...state, canvasBg: action.canvasBg };
    case "setSaveState":
      return { ...state, saveState: action.saveState };
    case "setBusy":
      return { ...state, busy: action.busy };
    case "setError":
      return { ...state, error: action.error };
    case "setProjectName":
      return { ...state, projectName: action.name };
    default:
      return state;
  }
}

function initialState(projectId: string): StudioState {
  const isDemo = projectId === "demo";
  const seed = isDemo ? buildSeedProject() : buildMinimalProject("New Application");
  const files: VfsMap = {};
  for (const [path, content] of Object.entries(seed)) {
    files[path] = { ...makeVfsFile(path, content), dirty: false };
  }
  return {
    projectId,
    projectName: isDemo ? "Nimbus Landing" : "New Application",
    workflowMode: "guided",
    viewMode: "preview",
    viewport: "desktop",
    inspectEnabled: false,
    canvasBg: "light",
    files,
    activeFilePath: "src/app/page.tsx",
    selected: null,
    messages: [
      {
        id: shortId("msg"),
        projectId,
        role: "assistant",
        content: isDemo
          ? "Welcome to Studio. Describe a change in plain language and I'll patch the code, or switch on Visual Inspect to edit elements directly."
          : "Workspace initialized. Ready to plan and generate your custom application.",
        statusPills: [],
        patchedFiles: [],
        versionId: null,
        createdAt: nowIso(),
      },
    ],
    tasks: [],
    approvals: [],
    versions: [
      {
        id: "v1.0",
        projectId,
        label: "v1.0",
        parentVersionId: null,
        manifest: Object.values(files).map((f) => ({
          filePath: f.filePath,
          sha256: f.sha256,
          byteSize: f.byteSize,
        })),
        createdBy: "system",
        createdAt: nowIso(),
      },
    ],
    requirements: null,
    designSystem: SEED_DESIGN_SYSTEM as DesignSystem,
    saveState: "saved",
    busy: false,
    error: null,
    persistence: "memory",
  };
}

export interface StudioApi extends StudioState {
  dispatch: React.Dispatch<Action>;
  setFileContent: (filePath: string, content: string) => void;
  createFile: (filePath: string, content?: string) => void;
  removeFile: (filePath: string) => void;
  openFile: (filePath: string) => void;
  selectElement: (studioId: string | null) => void;
  applyVisualMutation: (
    mutation:
      | { kind: "setText"; value: string }
      | { kind: "setClassToken"; group: string; value: string }
      | { kind: "addClass"; value: string }
      | { kind: "removeClass"; value: string },
  ) => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
  planBuild: (idea: string, modeOverride?: WorkflowMode) => Promise<void>;
  runPendingTasks: () => Promise<void>;
  createCheckpoint: (label?: string) => ProjectVersionDoc;
  restoreVersion: (versionId: string) => void;
  fileMap: Record<string, string>;
  latestVersionLabel: string;
}

const StudioContext = React.createContext<StudioApi | null>(null);

export function StudioProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = React.useReducer(reducer, projectId, initialState);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  /** Snapshot history for version restore (manifest -> content). */
  const snapshots = React.useRef<Map<string, Record<string, string>>>(
    new Map([["v1.0", mapContents(state.files)]]),
  );

  // Attempt anonymous sign-in if configured so guest sessions can obtain an auth token
  React.useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || !isFirebaseConfigured) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("studio_anon_auth_disabled")) {
      return;
    }
    import("firebase/auth").then(({ signInAnonymously, onAuthStateChanged }) => {
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          signInAnonymously(auth).catch((err) => {
            console.debug("Anonymous Firebase Auth not enabled:", err?.message || err);
            if (typeof window !== "undefined") {
              sessionStorage.setItem("studio_anon_auth_disabled", "true");
            }
          });
        }
      });
    });
  }, []);

  // Hydrate from Firestore when configured and authenticated; otherwise maintain in-memory VFS
  React.useEffect(() => {
    let cancelled = false;
    const db = getDb();
    const auth = getFirebaseAuth();
    if (!isFirebaseConfigured || !db) return;

    const hydrateFromDb = async (uid: string) => {
      try {
        const loaded = await loadProjectFiles(db, projectId);
        if (cancelled) return;
        if (Object.keys(loaded).length > 0) {
          dispatch({ type: "hydrate", files: loaded, persistence: "firestore" });
        } else {
          await persistFiles(db, projectId, Object.values(stateRef.current.files), uid);
          dispatch({ type: "hydrate", files: stateRef.current.files, persistence: "firestore" });
        }
      } catch (error) {
        console.warn("Firestore sync skipped (maintaining in-memory VFS):", error);
        // Do NOT surface permission-denied errors to the UI for guest / local workspaces
      }
    };

    if (auth?.currentUser) {
      void hydrateFromDb(auth.currentUser.uid);
    } else if (auth) {
      import("firebase/auth").then(({ onAuthStateChanged }) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user && !cancelled) {
            void hydrateFromDb(user.uid);
          }
        });
        return () => unsubscribe();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const writeFile = React.useCallback(
    (filePath: string, content: string) => {
      const path = normalizePath(filePath);
      let file: VfsFile;
      try {
        file = makeVfsFile(path, content);
      } catch (error) {
        dispatch({
          type: "setError",
          error: error instanceof Error ? error.message : "Could not write file",
        });
        return;
      }
      dispatch({ type: "writeFile", file });
      dispatch({ type: "setSaveState", saveState: "saving" });

      const db = getDb();
      const auth = getFirebaseAuth();
      const currentUser = auth?.currentUser;

      if (db && isFirebaseConfigured && currentUser) {
        persistFile(db, projectId, file, currentUser.uid)
          .then(() => dispatch({ type: "setSaveState", saveState: "saved" }))
          .catch((err) => {
            console.warn("Firestore persist failed, saving in memory:", err);
            dispatch({ type: "setSaveState", saveState: "saved" });
          });
      } else {
        window.setTimeout(() => dispatch({ type: "setSaveState", saveState: "saved" }), 180);
      }
    },
    [projectId],
  );

  const createCheckpoint = React.useCallback(
    (label?: string): ProjectVersionDoc => {
      const current = stateRef.current;
      const major = current.versions.length;
      const version: ProjectVersionDoc = {
        id: shortId("ver"),
        projectId,
        label: label ?? `v1.${major}`,
        parentVersionId: current.versions[0]?.id ?? null,
        manifest: Object.values(current.files).map((f) => ({
          filePath: f.filePath,
          sha256: f.sha256,
          byteSize: f.byteSize,
        })),
        createdBy: "me",
        createdAt: nowIso(),
      };
      snapshots.current.set(version.id, mapContents(current.files));
      dispatch({ type: "addVersion", version });

      if (isFirebaseConfigured && current.persistence === "firestore") {
        authenticatedFetch("/api/versions/checkpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            label: version.label,
            parentVersionId: version.parentVersionId,
            manifest: version.manifest,
          }),
        }).catch((err) => console.warn("Failed to persist version checkpoint:", err));
      }

      return version;
    },
    [projectId],
  );

  const selectElement = React.useCallback((studioId: string | null) => {
    if (!studioId) {
      dispatch({ type: "select", selected: null });
      return;
    }
    const [rawPath, rawLine, rawCol] = splitStudioId(studioId);
    const filePath = normalizePath(rawPath);
    const files = stateRef.current.files;
    const file =
      files[filePath] ??
      files[`/${filePath}`] ??
      Object.values(files).find((f) => f.filePath.endsWith(filePath));

    if (!file) {
      // Still set selection with basic coordinates so the inspector can switch to element view
      dispatch({
        type: "select",
        selected: {
          studioId,
          filePath,
          line: Number(rawLine) || 1,
          col: Number(rawCol) || 1,
          tagName: "element",
          className: "",
          text: null,
          canEditText: false,
        },
      });
      return;
    }
    import("@/lib/patch/ast-patch").then(({ describeElement }) => {
      let info = describeElement(file.filePath, file.content, studioId);
      if (!info) {
        info = {
          studioId,
          filePath: file.filePath,
          line: Number(rawLine) || 1,
          col: Number(rawCol) || 1,
          tagName: "element",
          className: "",
          text: null,
          canEditText: false,
        };
      }
      dispatch({ type: "select", selected: info });
    });
  }, []);

  const applyVisualMutation = React.useCallback<StudioApi["applyVisualMutation"]>(
    async (mutation) => {
      const current = stateRef.current;
      const selected = current.selected;
      if (!selected) return;
      const file = current.files[selected.filePath];
      if (!file) return;
      const { applyAstPatch } = await import("@/lib/patch/ast-patch");
      const outcome = applyAstPatch(
        selected.filePath,
        file.content,
        mutation as never,
        selected.studioId,
      );
      if (!outcome.changed) {
        if (outcome.reason && outcome.reason !== "no-op") {
          console.warn(`[Studio AST] Coordinate warning: ${outcome.reason}`);
          dispatch({
            type: "setError",
            error: `Element coordinate shifted or not found: ${outcome.reason}. You can edit it directly in the Code panel.`,
          });
        }
        return;
      }
      writeFile(selected.filePath, outcome.content);
      const { describeElement } = await import("@/lib/patch/ast-patch");
      dispatch({
        type: "select",
        selected: describeElement(selected.filePath, outcome.content, selected.studioId),
      });
    },
    [writeFile],
  );

  const sendChatMessage = React.useCallback(
    async (message: string) => {
      const current = stateRef.current;
      dispatch({
        type: "addMessage",
        message: {
          id: shortId("msg"),
          projectId,
          role: "user",
          content: message,
          statusPills: [],
          patchedFiles: [],
          versionId: null,
          createdAt: nowIso(),
        },
      });
      dispatch({ type: "setBusy", busy: true });
      dispatch({ type: "setError", error: null });

      try {
        const response = await authenticatedFetch("/api/orchestrator/chat-patch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message,
            activeFilePath: current.activeFilePath || null,
            files: Object.values(current.files).map((f) => ({
              filePath: f.filePath,
              content: f.content,
            })),
          }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          reply?: string;
          files?: { filePath: string; content: string }[];
          changedPaths?: string[];
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? `Request failed (${response.status})`);
        }

        for (const file of payload.files ?? []) {
          writeFile(file.filePath, file.content);
        }
        const version = (payload.changedPaths ?? []).length ? createCheckpoint() : null;

        dispatch({
          type: "addMessage",
          message: {
            id: shortId("msg"),
            projectId,
            role: "assistant",
            content: payload.reply ?? "Done.",
            statusPills: (payload.changedPaths ?? []).length ? ["Patch Applied"] : [],
            patchedFiles: payload.changedPaths ?? [],
            versionId: version?.id ?? null,
            createdAt: nowIso(),
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        dispatch({ type: "setError", error: detail });
        dispatch({
          type: "addMessage",
          message: {
            id: shortId("msg"),
            projectId,
            role: "assistant",
            content: `I couldn't apply that change: ${detail}`,
            statusPills: ["Failed"],
            patchedFiles: [],
            versionId: null,
            createdAt: nowIso(),
          },
        });
      } finally {
        dispatch({ type: "setBusy", busy: false });
      }
    },
    [createCheckpoint, projectId, writeFile],
  );


  const planBuild = React.useCallback(
    async (idea: string, modeOverride?: WorkflowMode) => {
      const activeMode = modeOverride ?? stateRef.current.workflowMode;
      dispatch({ type: "setBusy", busy: true });
      dispatch({ type: "setError", error: null });
      dispatch({
        type: "addMessage",
        message: {
          id: shortId("msg"),
          projectId,
          role: "user",
          content: idea,
          statusPills: [],
          patchedFiles: [],
          versionId: null,
          createdAt: nowIso(),
        },
      });
      try {
        const response = await authenticatedFetch("/api/orchestrator/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            prompt: idea,
            workflowMode: activeMode,
          }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          requirements?: Prd;
          designSystem?: DesignSystem;
          deterministicFiles?: { filePath: string; content: string }[];
          tasks?: GenerationTaskDoc[];
          approvals?: ApprovalDoc[];
          error?: string;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? `Planning failed (${response.status})`);
        }
        if (payload.requirements) {
          dispatch({ type: "setRequirements", requirements: payload.requirements });
          if (payload.requirements.productName) {
            dispatch({ type: "setProjectName", name: payload.requirements.productName });
          }
        }
        if (payload.designSystem) {
          dispatch({ type: "setDesignSystem", designSystem: payload.designSystem });
        }
        if (payload.deterministicFiles && Array.isArray(payload.deterministicFiles)) {
          for (const f of payload.deterministicFiles) {
            writeFile(f.filePath, f.content);
          }
        }
        dispatch({ type: "setTasks", tasks: payload.tasks ?? [] });
        dispatch({ type: "setApprovals", approvals: payload.approvals ?? [] });
        dispatch({
          type: "addMessage",
          message: {
            id: shortId("msg"),
            projectId,
            role: "assistant",
            content: `Planned ${payload.tasks?.length ?? 0} generation tasks for "${payload.requirements?.productName ?? "your product"}". ${
              activeMode === "autonomous"
                ? "Autonomous mode is active — generating components and assembling app now..."
                : "Open the DAG Graph and PRD Spec tabs to review approvals before running tasks."
            }`,
            statusPills: ["PRD Approved", "Architecture Plan"],
            patchedFiles: [],
            versionId: null,
            createdAt: nowIso(),
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        dispatch({ type: "setError", error: detail });
        dispatch({
          type: "addMessage",
          message: {
            id: shortId("msg"),
            projectId,
            role: "assistant",
            content: `Planning failed: ${detail}`,
            statusPills: ["Failed"],
            patchedFiles: [],
            versionId: null,
            createdAt: nowIso(),
          },
        });
      } finally {
        dispatch({ type: "setBusy", busy: false });
      }
    },
    [projectId],
  );

  /** Executes the DAG in dependency order, one file per task. */
  const runPendingTasks = React.useCallback(async () => {
    dispatch({ type: "setBusy", busy: true });
    try {
      const guarded = new Set<string>();
      for (let pass = 0; pass < 200; pass++) {
        const current = stateRef.current;
        const runnable = current.tasks.find(
          (task) =>
            (task.status === "pending" ||
              (task.status === "awaiting_approval" &&
                current.approvals.every((a) => a.status === "approved"))) &&
            !guarded.has(task.id) &&
            task.dependsOn.every((dep) => {
              const depTask = current.tasks.find((t) => t.id === dep);
              return depTask?.status === "succeeded" || depTask?.status === "failed";
            }),
        );
        if (!runnable) break;
        guarded.add(runnable.id);
        dispatch({
          type: "updateTask",
          taskId: runnable.id,
          patch: { status: "running", startedAt: nowIso() },
        });

        const contextFiles = runnable.requiredContextFiles
          .map((filePath) => stateRef.current.files[normalizePath(filePath)])
          .filter(Boolean)
          .map((file) => ({
            filePath: file.filePath,
            exportSignatures: file.exportSignatures,
          }));

        interface TaskPayload {
          ok: boolean;
          file?: { filePath: string; content: string };
          usage?: { inputTokens: number; outputTokens: number };
          error?: string;
        }
        let payload: TaskPayload | null = null;

        const maxTaskAttempts = 2;
        let lastTaskError: Error | null = null;

        for (let attempt = 1; attempt <= maxTaskAttempts; attempt++) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);

          try {
            const response = await authenticatedFetch("/api/orchestrator/execute-task", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                projectId,
                task: {
                  taskId: runnable.id,
                  title: runnable.title,
                  description: runnable.description,
                  agentRole: runnable.agentRole,
                  provider: runnable.provider,
                  order: runnable.order,
                  targetFilePath: runnable.targetFilePath,
                  requiredContextFiles: runnable.requiredContextFiles,
                  dependencies: runnable.dependsOn,
                  exportedSymbols: runnable.exportedSymbols,
                },
                designSystem: stateRef.current.designSystem,
                contextFiles,
              }),
            });
            clearTimeout(timeoutId);

            if (response.status === 429 && attempt < maxTaskAttempts) {
              console.warn(`Task "${runnable.title}" hit 429 rate limit. Retrying in 5s...`);
              await new Promise((r) => setTimeout(r, 5000));
              continue;
            }

            payload = (await response.json()) as TaskPayload;
            if (!response.ok || !payload?.ok || !payload?.file) {
              throw new Error(payload?.error ?? `Task failed (${response.status})`);
            }
            lastTaskError = null;
            break;
          } catch (err) {
            clearTimeout(timeoutId);
            const isAbort = err instanceof Error && err.name === "AbortError";
            lastTaskError = isAbort
              ? new Error("Task timed out after 45 seconds")
              : err instanceof Error
              ? err
              : new Error(String(err));

            if (
              attempt < maxTaskAttempts &&
              /429|rate limit|quota/i.test(lastTaskError.message)
            ) {
              console.warn(`Retrying task "${runnable.title}" after rate limit backoff...`);
              await new Promise((r) => setTimeout(r, 5000));
              continue;
            }
            break;
          }
        }

        if (lastTaskError || !payload?.file) {
          const errMsg = lastTaskError?.message || "Task failed";
          dispatch({
            type: "updateTask",
            taskId: runnable.id,
            patch: {
              status: "failed",
              finishedAt: nowIso(),
              error: errMsg,
            },
          });
          // Non-blocking: log the warning in chat, but continue assembling remaining app components!
          dispatch({
            type: "addMessage",
            message: {
              id: shortId("msg"),
              projectId,
              role: "assistant",
              content: `⚠️ Task "${runnable.title}" (${runnable.targetFilePath}) encountered an issue: ${errMsg}. Continuing to assemble remaining components...`,
              statusPills: ["Task Skipped"],
              patchedFiles: [],
              versionId: null,
              createdAt: nowIso(),
            },
          });
          continue;
        }

        // Incremental live preview: write file to VFS & push to Sandpack immediately
        const taskFile = payload?.file;
        if (taskFile) {
          writeFile(taskFile.filePath, taskFile.content);
          dispatch({
            type: "updateTask",
            taskId: runnable.id,
            patch: {
              status: "succeeded",
              finishedAt: nowIso(),
              tokensIn: payload?.usage?.inputTokens ?? 0,
              tokensOut: payload?.usage?.outputTokens ?? 0,
            },
          });
        }
      }
      createCheckpoint();
    } finally {
      dispatch({ type: "setBusy", busy: false });
    }
  }, [createCheckpoint, projectId, writeFile]);

  const restoreVersion = React.useCallback(
    (versionId: string) => {
      const snapshot = snapshots.current.get(versionId);
      if (!snapshot) {
        dispatch({ type: "setError", error: "That checkpoint's contents are no longer cached." });
        return;
      }
      const files: VfsMap = {};
      for (const [path, content] of Object.entries(snapshot)) {
        files[path] = { ...makeVfsFile(path, content), dirty: false };
      }
      dispatch({ type: "setFiles", files });
      const db = getDb();
      if (db && isFirebaseConfigured) {
        persistFiles(db, projectId, Object.values(files), "me").catch((err) =>
          console.warn("Firestore persistFiles skipped:", err),
        );
      }
    },
    [projectId],
  );

  // Auto-orchestrate fresh prompt-first projects when loaded with URL parameters or stored project metadata
  const autoOrchestratedRef = React.useRef(false);

  React.useEffect(() => {
    if (projectId === "demo" || autoOrchestratedRef.current) return;
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const urlPrompt = urlParams.get("prompt");
    const urlMode = urlParams.get("mode") as WorkflowMode | null;
    const urlCategory = urlParams.get("category");

    let initialPrompt = urlPrompt;
    let initialMode = urlMode;
    let initialCategory = urlCategory;
    let initialName = "";

    try {
      const stored = localStorage.getItem(`studio_project_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!initialPrompt && parsed.prompt) initialPrompt = parsed.prompt;
        if (!initialMode && parsed.mode) initialMode = parsed.mode;
        if (!initialCategory && parsed.category) initialCategory = parsed.category;
        if (parsed.name) initialName = parsed.name;
      }
    } catch {}

    if (initialName) {
      dispatch({ type: "setProjectName", name: initialName });
    }

    const effectiveMode: WorkflowMode =
      initialMode === "autonomous" || initialMode === "guided" ? initialMode : "autonomous";
    dispatch({ type: "setWorkflowMode", workflowMode: effectiveMode });

    if (initialPrompt && !autoOrchestratedRef.current) {
      autoOrchestratedRef.current = true;
      const combinedPrompt = initialCategory
        ? `[Category: ${initialCategory}] ${initialPrompt}`
        : initialPrompt;

      (async () => {
        try {
          await planBuild(combinedPrompt, effectiveMode);
          if (effectiveMode === "autonomous") {
            window.setTimeout(() => {
              void runPendingTasks();
            }, 350);
          }
        } catch (err) {
          console.error("Auto orchestration error:", err);
        }
      })();
    }
  }, [projectId, planBuild, runPendingTasks]);

  const fileMap = React.useMemo(() => mapContents(state.files), [state.files]);

  const api = React.useMemo<StudioApi>(
    () => ({
      ...state,
      dispatch,
      setFileContent: writeFile,
      createFile: (filePath, content = "") =>
        writeFile(filePath, content || scaffoldFor(filePath)),
      removeFile: (filePath) => {
        dispatch({ type: "deleteFile", filePath });
        // Without this the document survives and the file reappears on reload.
        const db = getDb();
        if (db && isFirebaseConfigured) {
          void deleteFileDoc(db, projectId, filePath).catch(() =>
            dispatch({
              type: "setError",
              error: `Removed "${filePath}" locally, but deleting it from Firestore failed.`,
            }),
          );
        }
      },
      openFile: (filePath) => {
        dispatch({ type: "setActiveFile", filePath });
        dispatch({ type: "setViewMode", viewMode: "code" });
      },
      selectElement,
      applyVisualMutation,
      sendChatMessage,
      planBuild,
      runPendingTasks,
      createCheckpoint,
      restoreVersion,
      fileMap,
      latestVersionLabel: state.versions[0]?.label ?? "v1.0",
    }),
    [
      state,
      writeFile,
      selectElement,
      applyVisualMutation,
      sendChatMessage,
      planBuild,
      runPendingTasks,
      createCheckpoint,
      restoreVersion,
      fileMap,
    ],
  );

  return <StudioContext.Provider value={api}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioApi {
  const ctx = React.useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside <StudioProvider>");
  return ctx;
}

export function splitStudioId(studioId: string): [string, number, number] {
  const idx = studioId.lastIndexOf(":");
  const idx2 = studioId.lastIndexOf(":", idx - 1);
  return [
    studioId.slice(0, idx2),
    Number(studioId.slice(idx2 + 1, idx)),
    Number(studioId.slice(idx + 1)),
  ];
}

function mapContents(files: VfsMap): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of Object.values(files)) out[file.filePath] = file.content;
  return out;
}

function scaffoldFor(filePath: string): string {
  const name = filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  if (/\.(tsx|jsx)$/.test(filePath)) {
    const componentName = name.replace(/[^A-Za-z0-9]/g, "") || "Component";
    const pascal = componentName[0].toUpperCase() + componentName.slice(1);
    return `export function ${pascal}() {
  return (
    <div className="p-6 text-sm text-slate-300">
      ${pascal}
    </div>
  );
}
`;
  }
  if (filePath.endsWith(".ts")) return `export {};\n`;
  if (filePath.endsWith(".css")) return `/* ${name} */\n`;
  if (filePath.endsWith(".json")) return `{}\n`;
  return "";
}

export { sha256Sync };
