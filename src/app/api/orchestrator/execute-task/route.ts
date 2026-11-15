import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ExecuteTaskRequestSchema } from "@/lib/ai/schemas";
import { FILE_AGENTS, isFileAgentRole } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { sliceContext } from "@/lib/ai/token-slicer";
import { stampStudioIds } from "@/lib/patch/studio-id";
import { extractExportSignatures, extractImports, verifyExportContract } from "@/lib/vfs/analyze";
import { sha256Sync } from "@/lib/hash";
import { byteSize } from "@/lib/utils";
import { MAX_FILE_BYTES } from "@/types/firestore";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Executes one node of the build DAG: generates exactly one file using only the
 * design tokens plus the export signatures of its direct dependencies.
 */
export async function POST(request: Request) {
  try {
    const body = ExecuteTaskRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const { task, designSystem, contextFiles } = body;

    const sliced = sliceContext(task.targetFilePath, designSystem, contextFiles);

    if (!isFileAgentRole(task.agentRole)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Role "${task.agentRole}" does not generate a single file. Route it to its own endpoint.`,
        },
        { status: 400 },
      );
    }

    const agent = FILE_AGENTS[task.agentRole];
    const generated = await runAgent(agent, {
      taskTitle: task.title,
      taskDescription: task.description,
      targetFilePath: task.targetFilePath,
      exportedSymbols: task.exportedSymbols,
      slicedContext: sliced.text,
    });

    const filePath = task.targetFilePath;
    const content = /\.(tsx|jsx)$/.test(filePath)
      ? stampStudioIds(filePath, generated.data.file.content)
      : generated.data.file.content;

    // The DAG promised these exports to downstream tasks; verify before writing.
    const signatures = extractExportSignatures(content);
    const contract = verifyExportContract(content, filePath, task.exportedSymbols);
    if (!contract.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Generated file is missing the exports its dependents require: ${contract.missing.join(", ")}`,
        },
        { status: 422 },
      );
    }

    const size = byteSize(content);
    if (size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Generated file is ${size} bytes, above the ${MAX_FILE_BYTES}-byte per-document limit. Split this task into smaller files.`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      file: {
        filePath,
        language: generated.data.file.language,
        content,
        sha256: sha256Sync(content),
        byteSize: size,
        exportSignatures: signatures,
        imports: extractImports(content),
      },
      context: {
        estimatedTokens: sliced.estimatedTokens,
        includedFiles: sliced.includedFiles,
        droppedFiles: sliced.droppedFiles,
      },
      usage: generated.usage,
      attempts: generated.attempts,
      model: generated.model,
      followUpNotes: generated.data.followUpNotes,
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
