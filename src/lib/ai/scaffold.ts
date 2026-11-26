import type { DagTaskNode } from "./schemas";

/**
 * Files a Next.js App Router project cannot run without. The Architect Agent
 * These are normally seeded into the VFS when a project is created, so the
 * planner excludes them to save tasks. This guard only matters when one has
 * been deleted: without a root layout the generated app will not boot.
 */
export const MANDATORY_FILES = [
  {
    targetFilePath: "src/app/globals.css",
    taskId: "scaffold_globals_css",
    title: "Global stylesheet",
    description:
      "Tailwind base/components/utilities plus the design system CSS variables. No component styles.",
    agentRole: "design" as const,
    order: 0,
  },
  {
    targetFilePath: "src/app/layout.tsx",
    taskId: "scaffold_root_layout",
    title: "Root layout",
    description:
      "App Router root layout: html/body shell, font setup, metadata export, and it must import ./globals.css.",
    agentRole: "frontend" as const,
    order: 3,
  },
] as const;

export interface ScaffoldResult {
  tasks: DagTaskNode[];
  injected: string[];
}

/**
 * Appends any missing mandatory file as a task, wired into the graph at the
 * right layer. Existing tasks are never modified or reordered.
 */
export function ensureScaffoldTasks(
  tasks: DagTaskNode[],
  existingFiles: string[] = [],
): ScaffoldResult {
  const present = new Set([
    ...tasks.map((task) => normalize(task.targetFilePath)),
    ...existingFiles.map(normalize),
  ]);
  const taskIds = new Set(tasks.map((task) => task.taskId));
  const next = [...tasks];
  const injected: string[] = [];

  for (const required of MANDATORY_FILES) {
    if (present.has(normalize(required.targetFilePath))) continue;

    // Keep the generated id unique even if the architect used the same one.
    let taskId: string = required.taskId;
    let suffix = 2;
    while (taskIds.has(taskId)) taskId = `${required.taskId}_${suffix++}`;
    taskIds.add(taskId);

    const dependencies =
      required.targetFilePath === "src/app/layout.tsx"
        ? next
            .filter((task) => normalize(task.targetFilePath) === "src/app/globals.css")
            .map((task) => task.taskId)
        : [];

    next.push({
      taskId,
      title: required.title,
      description: required.description,
      agentRole: required.agentRole,
      provider: "groq",
      order: required.order,
      targetFilePath: required.targetFilePath,
      dependencies,
      requiredContextFiles: [],
      exportedSymbols:
        required.targetFilePath === "src/app/layout.tsx"
          ? ["export default function RootLayout", "export const metadata"]
          : [],
    });
    present.add(normalize(required.targetFilePath));
    injected.push(required.targetFilePath);
  }

  // The layout task may have been added before globals.css in the same pass.
  const globalsIds = next
    .filter((task) => normalize(task.targetFilePath) === "src/app/globals.css")
    .map((task) => task.taskId);
  for (const task of next) {
    if (normalize(task.targetFilePath) !== "src/app/layout.tsx") continue;
    for (const id of globalsIds) {
      if (id !== task.taskId && !task.dependencies.includes(id)) task.dependencies.push(id);
    }
  }

  return { tasks: next, injected };
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}

/**
 * The architect frequently labels every task "frontend", including API route
 * handlers. execute-task dispatches on agentRole, so a mislabelled task would
 * be written by the Frontend Agent — JSX tagging rules and all — against a
 * server file. The target path is authoritative, so correct it here.
 */
export function roleForPath(filePath: string): DagTaskNode["agentRole"] | null {
  const p = normalize(filePath);
  if (/(^|\/)api\/.*route\.[jt]sx?$/.test(p)) return "backend";
  if (/(^|\/)(middleware|instrumentation)\.[jt]s$/.test(p)) return "backend";
  if (/firestore\.rules$|(^|\/)(db|repository|repositories)\//.test(p)) return "database";
  if (/\.css$/.test(p) || /(^|\/)(theme|tokens)[./]/.test(p)) return "design";
  if (/\.(tsx|jsx)$/.test(p)) return "frontend";
  return null;
}

export function normalizeTaskRoles(tasks: DagTaskNode[]): {
  tasks: DagTaskNode[];
  corrected: { taskId: string; from: string; to: string }[];
} {
  const corrected: { taskId: string; from: string; to: string }[] = [];
  const next = tasks.map((task) => {
    const expected = roleForPath(task.targetFilePath);
    if (!expected || expected === task.agentRole) return task;
    corrected.push({ taskId: task.taskId, from: task.agentRole, to: expected });
    return { ...task, agentRole: expected };
  });
  return { tasks: next, corrected };
}
