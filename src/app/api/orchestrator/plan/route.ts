import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PlanRequestSchema, validateDag } from "@/lib/ai/schemas";
import { ensureScaffoldTasks, normalizeTaskRoles } from "@/lib/ai/scaffold";
import { architectAgent, productAgent, uiuxAgent, ROLE_PROVIDER } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { byteSize, nowIso, shortId } from "@/lib/utils";
import type { ApprovalDoc, GenerationTaskDoc } from "@/types/firestore";
import type { DagTaskNode } from "@/lib/ai/schemas";
import { COLLECTIONS } from "@/types/firestore";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";
import { getDeterministicSetupFiles } from "@/lib/vfs/deterministic";
import { detectLanguage, extractExportSignatures, extractImports } from "@/lib/vfs/analyze";
import { sha256Sync, sourceFileDocId } from "@/lib/hash";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Planning pipeline: PRD -> design system -> complete architecture DAG.
 * Task count is driven by the PRD, never by a fixed website/full-stack cap.
 */
export async function POST(request: Request) {
  try {
    const body = PlanRequestSchema.parse(await request.json());
    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"], true);
    if (!auth.ok) return auth.response;

    const prd = await runAgent(productAgent, {
      idea: body.prompt,
      workflowMode: body.workflowMode,
    });

    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.collection(COLLECTIONS.projects).doc(body.projectId).set(
        {
          id: body.projectId,
          ownerId: auth.user.uid,
          name: prd.data.productName || body.projectId,
          slug: body.projectId,
          description: prd.data.oneLiner || "AI-generated Studio application",
          status: "ready",
          workflowMode: body.workflowMode,
          framework: "nextjs",
          entryFilePath: "src/app/page.tsx",
          updatedAt: nowIso(),
        },
        { merge: true },
      ).catch(() => {});
    }

    const design = await runAgent(uiuxAgent, {
      productName: prd.data.productName,
      category: prd.data.category,
      valueProposition: prd.data.valueProposition,
      personas: prd.data.personas.map((persona) => persona.name),
    });

    const architecture = await runAgent(architectAgent, {
      prdJson: JSON.stringify(prd.data),
      designSystemJson: JSON.stringify(design.data),
    });

    const deterministicFiles = getDeterministicSetupFiles(
      prd.data.productName || "Studio App",
      design.data,
    );

    const setupPaths = new Set([
      "src/app/layout.tsx",
      "src/app/globals.css",
      "src/theme/tokens.ts",
      "app/layout.tsx",
      "app/globals.css",
    ]);

    let rawTasks = architecture.data.tasks.filter(
      (task) => !setupPaths.has(normalizePath(task.targetFilePath)),
    );

    // The PRD is the source of truth for route coverage. Canonicalize route
    // files and add a page task for every route the architect accidentally omitted.
    const routeRecords = prd.data.pages.map((page) => ({
      path: normalizeRoute(page.route),
      filePath: appFileForRoute(page.route),
      purpose: page.purpose,
    }));

    if (!routeRecords.some((route) => route.path === "/")) {
      routeRecords.unshift({
        path: "/",
        filePath: "src/app/page.tsx",
        purpose: `Application home for ${prd.data.productName}`,
      });
    }

    const routePathSet = new Set<string>();
    for (const route of routeRecords) {
      if (routePathSet.has(route.path)) {
        return NextResponse.json(
          { ok: false, error: `The PRD contains duplicate route "${route.path}". Fix the PRD before planning.` },
          { status: 422 },
        );
      }
      routePathSet.add(route.path);
    }

    const routeFilePaths = new Set(routeRecords.map((route) => normalizePath(route.filePath)));
    rawTasks = rawTasks.filter((task) => !isPageFile(task.targetFilePath) || routeFilePaths.has(normalizePath(task.targetFilePath)));
    const pageTasks = rawTasks.filter((task) => isPageFile(task.targetFilePath));
    const canonicalPageTasks = new Map<string, DagTaskNode>();

    for (const task of pageTasks) {
      const match = routeRecords.find((route) =>
        normalizePath(task.targetFilePath) === normalizePath(route.filePath),
      );
      if (match) canonicalPageTasks.set(normalizePath(match.filePath), task);
    }

    let nextOrder = rawTasks.reduce((max, task) => Math.max(max, task.order), -1) + 1;
    for (const route of routeRecords) {
      const key = normalizePath(route.filePath);
      const existing = canonicalPageTasks.get(key);
      if (existing) {
        existing.title = `Build ${route.path === "/" ? "home" : route.path} page`;
        existing.description = route.purpose;
        if (!existing.exportedSymbols.length) existing.exportedSymbols = ["export default function Page"];
        continue;
      }

      const taskId = uniqueTaskId(`page_${route.path === "/" ? "home" : route.path.replace(/[^a-zA-Z0-9]+/g, "_")}`, rawTasks);
      rawTasks.push({
        taskId,
        title: `Build ${route.path === "/" ? "home" : route.path} page`,
        description: route.purpose,
        agentRole: "frontend",
        provider: "groq",
        order: nextOrder++,
        targetFilePath: route.filePath,
        dependencies: [],
        requiredContextFiles: [],
        exportedSymbols: ["export default function Page"],
      });
    }

    // Drop tasks that target the same file as a PRD route under a non-page role;
    // the page task is the sole writer for that App Router page file.
    rawTasks = rawTasks.filter((task) => {
      if (!routeFilePaths.has(normalizePath(task.targetFilePath))) return true;
      return isPageFile(task.targetFilePath);
    });

    // Fail closed on ambiguous DAGs instead of silently dropping nodes or edges.
    const taskIds = new Set<string>();
    const targetPaths = new Set<string>();
    for (const task of rawTasks) {
      const taskPath = normalizePath(task.targetFilePath);
      if (!task.targetFilePath.startsWith("src/") || task.targetFilePath.split(/[\\/]/).some((part) => part === "." || part === "..")) {
        return NextResponse.json(
          { ok: false, error: `The architect produced an unsafe or unsupported target path "${task.targetFilePath}".` },
          { status: 502 },
        );
      }
      if (taskIds.has(task.taskId)) {
        return NextResponse.json(
          { ok: false, error: `The architect produced duplicate task id "${task.taskId}".` },
          { status: 502 },
        );
      }
      if (targetPaths.has(taskPath)) {
        return NextResponse.json(
          { ok: false, error: `The architect assigned more than one task to "${task.targetFilePath}". Each file must have exactly one task.` },
          { status: 502 },
        );
      }
      taskIds.add(task.taskId);
      targetPaths.add(taskPath);
    }

    // The shell is normally seeded into the VFS. Inject mandatory shell tasks
    // only when the caller supplies an explicit existing-file inventory.
    let scaffoldInjected: string[] = [];
    if (body.existingFiles.length) {
      const scaffold = ensureScaffoldTasks(rawTasks, body.existingFiles);
      rawTasks = scaffold.tasks;
      scaffoldInjected = scaffold.injected;
    }

    const roleFix = normalizeTaskRoles(rawTasks);
    rawTasks = roleFix.tasks.map((task) => ({
      ...task,
      provider: ROLE_PROVIDER[task.agentRole] || task.provider,
    }));

    const dagCheck = validateDag(rawTasks);
    if (!dagCheck.ok) {
      return NextResponse.json(
        { ok: false, error: `The architect produced an invalid DAG. ${dagCheck.error}` },
        { status: 502 },
      );
    }

    const tasks: GenerationTaskDoc[] = [...rawTasks]
      .sort((a, b) => a.order - b.order)
      .map((task) => ({
        id: task.taskId,
        projectId: body.projectId,
        title: task.title,
        description: task.description,
        agentRole: task.agentRole,
        provider: ROLE_PROVIDER[task.agentRole] || task.provider,
        targetFilePath: task.targetFilePath,
        requiredContextFiles: task.requiredContextFiles,
        dependsOn: task.dependencies,
        exportedSymbols: task.exportedSymbols,
        order: task.order,
        status: body.workflowMode === "guided" ? "awaiting_approval" : "pending",
        attempts: 0,
        error: null,
        tokensIn: 0,
        tokensOut: 0,
        startedAt: null,
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }));

    const approvals: ApprovalDoc[] = body.workflowMode === "guided"
      ? [
          makeApproval(
            body.projectId,
            "prd",
            `PRD for ${prd.data.productName} — ${prd.data.features.filter((f) => f.priority === "P0").length} P0 features across ${routeRecords.length} routes.`,
          ),
          makeApproval(
            body.projectId,
            "design_system",
            `Design system "${design.data.name}" with ${Object.keys(design.data.colors).length} semantic tokens.`,
          ),
          makeApproval(
            body.projectId,
            "architecture",
            `${tasks.length} generation tasks across ${new Set(tasks.map((task) => task.agentRole)).size} agent roles.`,
          ),
        ]
      : [];

    if (adminDb) {
      const ts = nowIso();
      const batch = adminDb.batch();
      batch.set(adminDb.collection(COLLECTIONS.requirements).doc(body.projectId), {
        id: body.projectId,
        projectId: body.projectId,
        ...prd.data,
        targetUsers: prd.data.personas.map((persona) => persona.name),
        approvedBy: null,
        approvedAt: null,
        createdAt: ts,
        updatedAt: ts,
      }, { merge: true });
      batch.set(adminDb.collection(COLLECTIONS.designSystems).doc(body.projectId), {
        id: body.projectId,
        projectId: body.projectId,
        ...design.data,
        createdAt: ts,
        updatedAt: ts,
      }, { merge: true });
      for (const task of tasks) {
        batch.set(adminDb.collection(COLLECTIONS.generationTasks).doc(`${body.projectId}_${task.id}`), task, { merge: true });
      }
      for (const approval of approvals) {
        batch.set(adminDb.collection(COLLECTIONS.approvals).doc(approval.id), approval, { merge: true });
      }
      for (const file of deterministicFiles) {
        const docId = sourceFileDocId(body.projectId, file.filePath);
        batch.set(adminDb.collection(COLLECTIONS.sourceFiles).doc(docId), {
          id: docId,
          projectId: body.projectId,
          filePath: file.filePath,
          language: detectLanguage(file.filePath),
          content: file.content,
          sha256: sha256Sync(file.content),
          byteSize: byteSize(file.content),
          exportSignatures: extractExportSignatures(file.content),
          imports: extractImports(file.content),
          lastModifiedBy: auth.user.uid,
          createdAt: ts,
          updatedAt: ts,
        }, { merge: true });
      }
      await batch.commit().catch((err) => {
        console.warn("Firestore batch persist skipped during plan:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      requirements: prd.data,
      designSystem: design.data,
      architecture: { ...architecture.data, routes: routeRecords, tasks: rawTasks },
      deterministicFiles,
      tasks,
      approvals,
      scaffoldInjected,
      rolesCorrected: roleFix.corrected,
      usage: { product: prd.usage, design: design.usage, architect: architecture.usage },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.startsWith("Invalid PRD route:")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    }
    return errorResponse(error);
  }
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim().replace(/\\/g, "/");
  if (!trimmed.startsWith("/") || trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error(`Invalid PRD route: "${route}" must be an absolute pathname without query/hash.`);
  }
  const segments = trimmed.split("/").filter(Boolean).map((segment) => {
    if (segment === "." || segment === ".." || !/^(?::[a-zA-Z0-9_]+|[a-zA-Z0-9_.\-[\]]+)$/.test(segment)) {
      throw new Error(`Invalid PRD route: "${route}" contains an unsupported segment "${segment}".`);
    }
    return segment.startsWith(":") ? `[${segment.slice(1)}]` : segment;
  });
  return segments.length ? `/${segments.join("/")}` : "/";
}

function appFileForRoute(route: string): string {
  const normalized = normalizeRoute(route);
  return normalized === "/"
    ? "src/app/page.tsx"
    : `src/app/${normalized.slice(1)}/page.tsx`;
}

function isPageFile(filePath: string): boolean {
  return /(^|\/)page\.[jt]sx?$/i.test(filePath.replace(/\\/g, "/"));
}

function uniqueTaskId(base: string, tasks: DagTaskNode[]): string {
  const used = new Set(tasks.map((task) => task.taskId));
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}_${suffix++}`;
  return candidate;
}

function makeApproval(
  projectId: string,
  stage: ApprovalDoc["stage"],
  summary: string,
): ApprovalDoc {
  return {
    id: shortId("apr"),
    projectId,
    stage,
    payloadRef: stage,
    summary,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    createdAt: nowIso(),
  };
}
