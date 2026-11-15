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
import type { GenerationTaskDoc, TaskStatus } from "@/types/firestore";

const STATUS_COLOR: Record<TaskStatus, { border: string; dot: string }> = {
  pending: { border: "#334155", dot: "#475569" },
  awaiting_approval: { border: "#b45309", dot: "#f59e0b" },
  running: { border: "#4f46e5", dot: "#6366f1" },
  succeeded: { border: "#047857", dot: "#10b981" },
  failed: { border: "#b91c1c", dot: "#ef4444" },
  skipped: { border: "#334155", dot: "#334155" },
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
    const value = !task || task.dependsOn.length === 0
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
    const colors = STATUS_COLOR[task.status];
    return {
      id: task.id,
      position: { x: column * 280, y: row * 110 },
      data: {
        label: (
          <div className="w-[220px] text-left">
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: colors.dot }}
              />
              <span className="truncate text-[11px] font-semibold text-slate-100">
                {task.title}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
              {task.targetFilePath}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
              {task.agentRole} · {task.provider}
            </p>
          </div>
        ),
      },
      style: {
        background: "#0c111d",
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: 10,
        width: 244,
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
        style: { stroke: "#334155" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#334155" },
      });
    }
  }
  return edges;
}

export function DagGraphView() {
  const studio = useStudio();
  const nodes = React.useMemo(() => layoutTasks(studio.tasks), [studio.tasks]);
  const edges = React.useMemo(() => buildEdges(studio.tasks), [studio.tasks]);

  if (!studio.tasks.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-slate-400">No build graph yet.</p>
        <p className="max-w-sm text-xs text-slate-500">
          Describe what you want to build in the chat panel. The Architect Agent will produce a
          task DAG and it will appear here as it executes.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#1e293b" />
        <Controls className="!border-slate-800 !bg-panel" />
      </ReactFlow>
    </div>
  );
}
