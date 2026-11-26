import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PlanRequestSchema, validateDag } from "@/lib/ai/schemas";
import { ensureScaffoldTasks, normalizeTaskRoles } from "@/lib/ai/scaffold";
import { architectAgent, productAgent, uiuxAgent, ROLE_PROVIDER } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { byteSize, nowIso, shortId } from "@/lib/utils";
import type { ApprovalDoc, GenerationTaskDoc } from "@/types/firestore";
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
 * The planning pass:
 *   Product Agent (Gemini) -> UI/UX Agent (Groq) -> Architect Agent (Gemini)
 * Returns the PRD, the design system, zero-LLM deterministic setup files,
 * and a compact 3-to-4 task build DAG.
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
      await adminDb
        .collection(COLLECTIONS.projects)
        .doc(body.projectId)
        .set(
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
        )
        .catch(() => {});
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

    // Zero-LLM deterministic setup files for instant mounting
    const deterministicFiles = getDeterministicSetupFiles(
      prd.data.productName || "Studio App",
      design.data,
    );

    // Filter out setup files that are generated deterministically
    const SETUP_PATHS = new Set([
      "src/app/layout.tsx",
      "src/app/globals.css",
      "src/theme/tokens.ts",
      "app/layout.tsx",
      "app/globals.css",
    ]);

    let rawTasks = architecture.data.tasks.filter((task) => {
      const target = task.targetFilePath.toLowerCase().trim();
      return !SETUP_PATHS.has(target) && !/layout\.tsx|globals\.css|tokens\.ts/.test(target);
    });

    // If architect omitted page.tsx, ensure page task exists
    const hasPage = rawTasks.some((t) => t.targetFilePath.includes("page.tsx"));
    if (!hasPage) {
      rawTasks.push({
        taskId: "task_page",
        title: "Assemble main page",
        description: `Assemble interactive ${prd.data.productName} application page with stateful widgets`,
        agentRole: "frontend",
        provider: "groq",
        order: 9,
        targetFilePath: "src/app/page.tsx",
        dependencies: rawTasks.map((t) => t.taskId),
        requiredContextFiles: rawTasks.map((t) => t.targetFilePath),
        exportedSymbols: ["export default function HomePage"],
      });
    }

    // Cap tasks: 4 for websites (~20s), up to 5 for fullstack_app (includes API route)
    const maxTasks = prd.data.category === "fullstack_app" || body.includeBackend ? 5 : 4;
    if (rawTasks.length > maxTasks) {
      const pageTask = rawTasks.find((t) => t.targetFilePath.includes("page.tsx"))!;
      const nonPageTasks = rawTasks.filter((t) => !t.targetFilePath.includes("page.tsx"));
      rawTasks = [...nonPageTasks.slice(0, maxTasks - 1), pageTask];
    }

    // Clean dependencies to only reference retained tasks
    const retainedIds = new Set(rawTasks.map((t) => t.taskId));
    for (const task of rawTasks) {
      task.dependencies = task.dependencies.filter((dep) => retainedIds.has(dep));
    }

    // The shell is normally seeded into the VFS and deliberately excluded
    // above. If the caller reports it missing, plan it after all.
    let scaffoldInjected: string[] = [];
    if (body.existingFiles.length) {
      const scaffold = ensureScaffoldTasks(rawTasks, body.existingFiles);
      rawTasks = scaffold.tasks;
      scaffoldInjected = scaffold.injected;
    }

    // The target path, not the model's label, decides which agent writes a file.
    const roleFix = normalizeTaskRoles(rawTasks);
    rawTasks = roleFix.tasks;

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
        provider: task.provider || ROLE_PROVIDER[task.agentRole] || "groq",
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

    const approvals: ApprovalDoc[] =
      body.workflowMode === "guided"
        ? [
            makeApproval(
              body.projectId,
              "prd",
              `PRD for ${prd.data.productName} — ${prd.data.features.filter((f) => f.priority === "P0").length} P0 features across ${prd.data.pages.length} pages.`,
            ),
            makeApproval(
              body.projectId,
              "design_system",
              `Design system "${design.data.name}" with ${Object.keys(design.data.colors).length} semantic tokens.`,
            ),
            makeApproval(
              body.projectId,
              "architecture",
              `${tasks.length} generation tasks across ${new Set(tasks.map((t) => t.agentRole)).size} agents.`,
            ),
          ]
        : [];

    if (adminDb) {
      const ts = nowIso();
      const batch = adminDb.batch();
      batch.set(
        adminDb.collection(COLLECTIONS.requirements).doc(body.projectId),
        {
          id: body.projectId,
          projectId: body.projectId,
          ...prd.data,
          targetUsers: prd.data.personas.map((p) => p.name),
          approvedBy: null,
          approvedAt: null,
          createdAt: ts,
          updatedAt: ts,
        },
        { merge: true },
      );
      batch.set(
        adminDb.collection(COLLECTIONS.designSystems).doc(body.projectId),
        {
          id: body.projectId,
          projectId: body.projectId,
          ...design.data,
          createdAt: ts,
          updatedAt: ts,
        },
        { merge: true },
      );
      for (const task of tasks) {
        batch.set(
          adminDb.collection(COLLECTIONS.generationTasks).doc(`${body.projectId}_${task.id}`),
          task,
          { merge: true },
        );
      }
      for (const approval of approvals) {
        batch.set(adminDb.collection(COLLECTIONS.approvals).doc(approval.id), approval, { merge: true });
      }
      for (const file of deterministicFiles) {
        const docId = sourceFileDocId(body.projectId, file.filePath);
        batch.set(
          adminDb.collection(COLLECTIONS.sourceFiles).doc(docId),
          {
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
          },
          { merge: true },
        );
      }
      await batch.commit().catch((err) => {
        console.warn("Firestore batch persist skipped during plan:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      requirements: prd.data,
      designSystem: design.data,
      architecture: architecture.data,
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
    return errorResponse(error);
  }
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
