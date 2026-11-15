import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { QaFixRequestSchema } from "@/lib/ai/schemas";
import { qaAgent } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { applyPatchOperations } from "@/lib/patch/apply-diff";
import { stampStudioIds } from "@/lib/patch/studio-id";
import { extractExportSignatures } from "@/lib/vfs/analyze";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Self-healing pass. Given compiler or runtime diagnostics, the QA Agent
 * returns minimal search/replace operations, applied atomically.
 */
export async function POST(request: Request) {
  try {
    const body = QaFixRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const affected = new Set(body.diagnostics.map((d) => d.filePath));
    const files: Record<string, string> = {};
    for (const file of body.files) files[file.filePath] = file.content;

    const fileBlocks = body.files
      .filter((file) => affected.has(file.filePath))
      .map((file) => `--- ${file.filePath} ---\n${file.content}`)
      .join("\n\n");

    // Signatures only — never the bodies of unaffected files.
    const availableSignatures = body.files
      .filter((file) => !affected.has(file.filePath))
      .map((file) => {
        const signatures = extractExportSignatures(file.content);
        return signatures.length ? `// ${file.filePath}\n${signatures.join("\n")}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    const fix = await runAgent(qaAgent, {
      diagnostics: body.diagnostics,
      fileBlocks: fileBlocks || "(no matching files supplied)",
      availableSignatures: availableSignatures || "(none)",
    });

    if (!fix.data.operations.length) {
      return NextResponse.json({
        ok: true,
        healed: false,
        diagnosis: fix.data.diagnosis,
        confidence: fix.data.confidence,
        files: [],
        changedPaths: [],
      });
    }

    const result = applyPatchOperations(files, fix.data.operations);
    if (result.failures.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `The proposed fix did not apply cleanly: ${result.failures
            .map((f) => `${f.filePath} (${f.reason})`)
            .join(", ")}`,
          diagnosis: fix.data.diagnosis,
          failures: result.failures,
        },
        { status: 409 },
      );
    }

    const outFiles = result.changedPaths.map((filePath) => ({
      filePath,
      content: /\.(tsx|jsx)$/.test(filePath)
        ? stampStudioIds(filePath, result.files[filePath])
        : result.files[filePath],
    }));

    return NextResponse.json({
      ok: true,
      healed: true,
      diagnosis: fix.data.diagnosis,
      confidence: fix.data.confidence,
      files: outFiles,
      changedPaths: outFiles.map((f) => f.filePath),
      usage: fix.usage,
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
