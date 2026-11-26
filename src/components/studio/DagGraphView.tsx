"use client";

import * as React from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { useStudio } from "@/store/studio-store";
import { useTheme } from "@/components/theme-provider";
import type { GenerationTaskDoc, TaskStatus } from "@/types/firestore";

const STATUS_DOT: Record<TaskStatus, string> = {
  pending: "#78716c",
  awaiting_approval: "#d97706",
  running: "#ea580c",
  validating: "#0284c7",
  repairing: "#d97706",
  succeeded: "#16a34a",
  failed: "#dc2626",
  skipped: "#78716c",
};

/** Layers tasks by dependency depth so the DAG reads left-to-right. */
export function layoutTasks(tasks: GenerationTaskDoc[]): Node[] {
  const depth = new Map<string, number>();
  const byId = new Map(tasks.map((t) => [t.id, t]));

  function depthOf(id: string, seen: Set<string>): number {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const task = byId.get(id);
    const value =
      !task || task.dependsOn.length === 0
        ? 0
        : 1 + Math.max(...task.dependsOn.map((d) => depthOf(d, seen)));
    depth.set(id, value);
    return value;
  }

  for (const task of tasks) depthOf(task.id, new Set());

  const perColumn = new Map<number, number>();
  return tasks.map((task) => {
    const column = depth.get(task.id) ?? 0;
    const row = perColumn.get(column) ?? 0;
    perColumn.set(column, row + 1);
    const dotColor = STATUS_DOT[task.status];
    return {
      id: task.id,
      position: { x: column * 280, y: row * 110 },
      data: {
        label: (
          <div className="w-[220px] text-left">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              <span className="truncate text-[11px] font-semibold text-foreground">
                {task.title}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {task.targetFilePath}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {task.agentRole} · {task.provider}
            </p>
          </div>
        ),
      },
      style: {
        background: "hsl(var(--card))",
        border: `1px solid ${dotColor}`,
        borderRadius: 10,
        padding: 10,
        width: 244,
        boxShadow: "var(--shadow-card)",
      },
    } satisfies Node;
  });
}

export function buildEdges(tasks: GenerationTaskDoc[]): Edge[] {
  const edges: Edge[] = [];
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      edges.push({
        id: `${dep}->${task.id}`,
        source: dep,
        target: task.id,
        animated: task.status === "running",
        style: { stroke: "hsl(var(--muted-foreground))" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#ea580c" },
      });
    }
  }
  return edges;
}

export function DagGraphView() {
  const studio = useStudio();
  const { theme } = useTheme();
  const nodes = React.useMemo(() => layoutTasks(studio.tasks), [studio.tasks]);
  const edges = React.useMemo(() => buildEdges(studio.tasks), [studio.tasks]);

  if (!studio.tasks.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-semibold text-foreground">No build graph yet.</p>
        <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
          Describe what you want to build in the Copilot panel. The Architect Agent will produce a
          task DAG and it will appear here as it executes.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-canvas">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color={theme === "dark" ? "#312d29" : "#d6cfc5"}
        />
        <Controls className="!border-border !bg-card" />
      </ReactFlow>
    </div>
  );
}
