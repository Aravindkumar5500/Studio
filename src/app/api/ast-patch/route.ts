import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { AstPatchRequestSchema } from "@/lib/ai/schemas";
import { applyAstPatch } from "@/lib/patch/ast-patch";
import { sha256Sync } from "@/lib/hash";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, MAX_FILE_BYTES, type SourceFileDoc } from "@/types/firestore";
import { sourceFileDocId } from "@/lib/hash";
import { byteSize, nowIso } from "@/lib/utils";
import { extractExportSignatures, extractImports } from "@/lib/vfs/analyze";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";

/**
 * Deterministic visual edit — no LLM call. Either the client passes the file
 * content (in-memory VFS) or we read it from Firestore and write it back.
 */
const BodySchema = AstPatchRequestSchema.extend({
  content: z.string().optional(),
  userId: z.string().default("me"),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const filePath = body.studioId.slice(0, body.studioId.lastIndexOf(":", body.studioId.lastIndexOf(":") - 1));

    const db = getAdminDb();
    const docId = sourceFileDocId(body.projectId, filePath);

    let source = body.content ?? null;
    if (source === null) {
      if (!db) {
        return NextResponse.json(
          { ok: false, error: "No file content supplied and Firestore is not configured." },
          { status: 400 },
        );
      }
      const snap = await db.collection(COLLECTIONS.sourceFiles).doc(docId).get();
      if (!snap.exists) {
        return NextResponse.json({ ok: false, error: `File not found: ${filePath}` }, { status: 404 });
      }
      source = (snap.data() as SourceFileDoc).content;
    }

    const outcome = applyAstPatch(filePath, source, body.mutation, body.studioId);
    if (!outcome.changed) {
      return NextResponse.json(
        { ok: false, error: outcome.reason ?? "No change applied", filePath, content: source },
        { status: 422 },
      );
    }

    const content = outcome.content;
    const size = byteSize(content);
    if (size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `The edit would make "${filePath}" ${size} bytes, above the ${MAX_FILE_BYTES}-byte per-document limit.`,
        },
        { status: 413 },
      );
    }
    const sha256 = sha256Sync(content);

    if (db) {
      const payload: Partial<SourceFileDoc> = {
        projectId: body.projectId,
        filePath,
        content,
        sha256,
        byteSize: size,
        exportSignatures: extractExportSignatures(content),
        imports: extractImports(content),
        lastModifiedBy: body.userId,
        updatedAt: nowIso(),
      };
      await db.collection(COLLECTIONS.sourceFiles).doc(docId).set(payload, { merge: true });
    }

    return NextResponse.json({ ok: true, filePath, content, sha256, changed: true });
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
