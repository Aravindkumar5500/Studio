import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ChatPatchRequestSchema } from "@/lib/ai/schemas";
import { chatPatchAgent } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { applyPatchOperations, checkJsxBalance } from "@/lib/patch/apply-diff";
import { stampStudioIds } from "@/lib/patch/studio-id";
import { errorResponse } from "@/lib/api/errors";
import { selectRelevantFiles } from "@/lib/ai/select-files";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Surgical chat edit. Groq returns Zod-validated search/replace operations,
 * which are applied atomically — a single bad block rolls the whole set back.
 */
export async function POST(request: Request) {
  try {
    const body = ChatPatchRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const files: Record<string, string> = {};
    for (const file of body.files) files[file.filePath] = file.content;

    const selection = selectRelevantFiles(body.files, body.activeFilePath, body.message);
    const fileBlocks = selection
      .map((file) => `--- ${file.filePath} ---\n${file.content}`)
      .join("\n\n");

    const response = await runAgent(chatPatchAgent, {
      message: body.message,
      activeFilePath: body.activeFilePath,
      fileBlocks,
    });

    if (!response.data.operations.length && !response.data.newFiles.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The model replied but produced no edits. Try naming the file or the exact text to change.",
          reply: response.data.reply,
        },
        { status: 422 },
      );
    }

    const result = applyPatchOperations(files, response.data.operations);
    if (result.failures.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not apply the patch cleanly: ${result.failures
            .map((f) => `${f.filePath} (${f.reason})`)
            .join(", ")}`,
          failures: result.failures,
        },
        { status: 409 },
      );
    }

    const changed = new Set(result.changedPaths);
    const nextFiles = { ...result.files };
    for (const file of response.data.newFiles) {
      const malformed = checkJsxBalance(file.filePath, "", file.content);
      if (malformed) {
        return NextResponse.json(
          {
            ok: false,
            error: `The model proposed a new file that would not compile: ${file.filePath} (${malformed}).`,
          },
          { status: 409 },
        );
      }
      nextFiles[file.filePath] = file.content;
      changed.add(file.filePath);
    }

    if (!changed.size) {
      return NextResponse.json(
        {
          ok: false,
          error: "The patch applied but changed nothing. No files were modified.",
          reply: response.data.reply,
        },
        { status: 422 },
      );
    }

    const outFiles = Array.from(changed).map((filePath) => ({
      filePath,
      content: /\.(tsx|jsx)$/.test(filePath)
        ? stampStudioIds(filePath, nextFiles[filePath])
        : nextFiles[filePath],
    }));

    return NextResponse.json({
      ok: true,
      reply: response.data.reply,
      files: outFiles,
      changedPaths: outFiles.map((f) => f.filePath),
      usage: response.usage,
      model: response.model,
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
