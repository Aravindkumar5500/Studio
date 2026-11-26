import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";
import { COLLECTIONS, type ProjectVersionDoc, type VersionSnapshotDoc } from "@/types/firestore";
import { extractExportSignatures, extractImports } from "@/lib/vfs/analyze";
import { sourceFileDocId } from "@/lib/hash";
import { nowIso } from "@/lib/utils";

export const runtime = "nodejs";

const RestoreRequestSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = RestoreRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { ok: false, error: "Database service unavailable: Firestore is not configured." },
        { status: 503 },
      );
    }

    const snap = await db.collection(COLLECTIONS.projectVersions).doc(body.versionId).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Version not found." }, { status: 404 });
    }

    const version = snap.data() as ProjectVersionDoc;
    if (version.projectId !== body.projectId) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Version does not belong to this project." },
        { status: 403 },
      );
    }

    const snapshotQuery = await db
      .collection(COLLECTIONS.versionSnapshots)
      .where("projectId", "==", body.projectId)
      .where("versionId", "==", body.versionId)
      .get();

    const restoredFiles = snapshotQuery.docs.map((docSnap) => {
      const s = docSnap.data() as VersionSnapshotDoc;
      return {
        filePath: s.filePath,
        language: s.language,
        content: s.content,
        sha256: s.sha256,
        byteSize: s.byteSize,
      };
    });

    if (restoredFiles.length > 0) {
      const existingSourceFiles = await db
        .collection(COLLECTIONS.sourceFiles)
        .where("projectId", "==", body.projectId)
        .get();
      const restoredIds = new Set(
        restoredFiles.map((f) => sourceFileDocId(body.projectId, f.filePath)),
      );
      const ts = nowIso();
      const batch = db.batch();
      for (const docSnap of existingSourceFiles.docs) {
        if (!restoredIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
        }
      }
      for (const f of restoredFiles) {
        const id = sourceFileDocId(body.projectId, f.filePath);
        batch.set(db.collection(COLLECTIONS.sourceFiles).doc(id), {
          id,
          projectId: body.projectId,
          filePath: f.filePath,
          language: f.language,
          content: f.content,
          sha256: f.sha256,
          byteSize: f.byteSize,
          exportSignatures: extractExportSignatures(f.content),
          imports: extractImports(f.content),
          lastModifiedBy: auth.user.uid,
          createdAt: ts,
          updatedAt: ts,
        });
      }
      await batch.commit();
    }

    await db.collection(COLLECTIONS.projects).doc(body.projectId).set(
      { currentVersionId: body.versionId, updatedAt: nowIso() },
      { merge: true },
    );

    return NextResponse.json({ ok: true, version, files: restoredFiles });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

