import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";
import {
  COLLECTIONS,
  MAX_FILE_BYTES,
  type ProjectVersionDoc,
  type VersionManifestEntry,
  type VersionSnapshotDoc,
} from "@/types/firestore";
import { detectLanguage } from "@/lib/vfs/analyze";
import { normalizePath, sha256Sync, versionSnapshotDocId } from "@/lib/hash";
import { byteSize, nowIso, shortId } from "@/lib/utils";

export const runtime = "nodejs";

const CheckpointRequestSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  label: z.string().optional(),
  parentVersionId: z.string().nullable().optional(),
  manifest: z
    .array(
      z.object({
        filePath: z.string(),
        sha256: z.string(),
        byteSize: z.number(),
      }),
    )
    .optional(),
  files: z
    .array(
      z.object({
        filePath: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = CheckpointRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const validFiles = (body.files ?? []).filter(
      (f) => byteSize(f.content) <= MAX_FILE_BYTES,
    );

    const manifest: VersionManifestEntry[] =
      body.manifest ??
      validFiles.map((f) => ({
        filePath: normalizePath(f.filePath),
        sha256: sha256Sync(f.content),
        byteSize: byteSize(f.content),
      }));

    const versionId = body.versionId ?? shortId("ver");
    const createdAt = nowIso();
    const versionDoc: ProjectVersionDoc = {
      id: versionId,
      projectId: body.projectId,
      label: body.label ?? `Checkpoint ${createdAt}`,
      parentVersionId: body.parentVersionId ?? null,
      manifest,
      createdBy: auth.user.uid,
      createdAt,
    };

    const db = getAdminDb();
    if (db) {
      await db.collection(COLLECTIONS.projectVersions).doc(versionId).set(versionDoc);
      for (let i = 0; i < validFiles.length; i += 400) {
        const batch = db.batch();
        for (const f of validFiles.slice(i, i + 400)) {
          const normPath = normalizePath(f.filePath);
          const snapId = versionSnapshotDocId(versionId, normPath);
          const snapDoc: VersionSnapshotDoc = {
            id: snapId,
            projectId: body.projectId,
            versionId,
            filePath: normPath,
            language: detectLanguage(normPath),
            content: f.content,
            sha256: sha256Sync(f.content),
            byteSize: byteSize(f.content),
            createdBy: auth.user.uid,
            createdAt,
          };
          batch.set(db.collection(COLLECTIONS.versionSnapshots).doc(snapId), snapDoc);
        }
        await batch.commit();
      }
      await db.collection(COLLECTIONS.projects).doc(body.projectId).set(
        { currentVersionId: versionId, updatedAt: createdAt },
        { merge: true },
      );
    }

    return NextResponse.json({ ok: true, version: versionDoc });
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

