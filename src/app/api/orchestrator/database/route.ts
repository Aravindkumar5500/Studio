import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DatabaseRequestSchema } from "@/lib/ai/schemas";
import { databaseAgent } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { extractExportSignatures, extractImports } from "@/lib/vfs/analyze";
import { repairSourceCode, validateSourceCode } from "@/modules/code-integrity";
import { sha256Sync } from "@/lib/hash";
import { byteSize } from "@/lib/utils";
import { MAX_FILE_BYTES } from "@/types/firestore";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Generates typed Firestore collections, repository helpers, and scoped
 * firestore.rules from the PRD's data entities via Database Agent.
 */
export async function POST(request: Request) {
  try {
    const body = DatabaseRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const generated = await runAgent(databaseAgent, {
      productName: body.productName,
      dataEntitiesJson: JSON.stringify(body.dataEntities, null, 2),
      existingCollections: body.existingCollections,
    });

    const outFiles = [];
    for (const file of generated.data.files) {
      let content = file.content;
      if (/\.(ts|tsx|js|jsx)$/.test(file.filePath)) {
        const healed = repairSourceCode(file.filePath, content);
        content = healed.content;
        const validation = validateSourceCode(file.filePath, content);
        if (!validation.valid) {
          const msg = validation.diagnostics
            .filter((d) => d.severity === "error")
            .map((d) => `line ${d.line}: ${d.message}`)
            .join("; ");
          return NextResponse.json(
            {
              ok: false,
              error: `Generated database file "${file.filePath}" failed validation: ${msg}`,
              diagnostics: validation.diagnostics,
            },
            { status: 422 },
          );
        }
      }

      const size = byteSize(content);
      if (size > MAX_FILE_BYTES) {
        return NextResponse.json(
          {
            ok: false,
            error: `Generated database file "${file.filePath}" exceeds ${MAX_FILE_BYTES} bytes.`,
          },
          { status: 422 },
        );
      }

      outFiles.push({
        filePath: file.filePath,
        language: file.language,
        content,
        sha256: sha256Sync(content),
        byteSize: size,
        exportSignatures: extractExportSignatures(content),
        imports: extractImports(content),
      });
    }

    return NextResponse.json({
      ok: true,
      collections: generated.data.collections,
      files: outFiles,
      rules: generated.data.rules,
      notes: generated.data.notes,
      usage: generated.usage,
      model: generated.model,
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
