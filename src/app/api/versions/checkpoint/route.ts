import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";
import { COLLECTIONS, type ProjectVersionDoc, type VersionManifestEntry } from "@/types/firestore";
import { sha256Sync } from "@/lib/hash";
import { byteSize, nowIso, shortId } from "@/lib/utils";

export const runtime = "nodejs";

const CheckpointRequestSchema = z.object({
  projectId: z.string().min(1),
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

    const manifest: VersionManifestEntry[] =
      body.manifest ??
      (body.files ?? []).map((f) => ({
        filePath: f.filePath,
        sha256: sha256Sync(f.content),
        byteSize: byteSize(f.content),
      }));

    const versionId = shortId("ver");
    const versionDoc: ProjectVersionDoc = {
      id: versionId,
      projectId: body.projectId,
      label: body.label ?? `Checkpoint ${nowIso()}`,
      parentVersionId: body.parentVersionId ?? null,
      manifest,
      createdBy: auth.user.uid,
      createdAt: nowIso(),
    };

    const db = getAdminDb();
    if (db) {
      await db.collection(COLLECTIONS.projectVersions).doc(versionId).set(versionDoc);
      await db.collection(COLLECTIONS.projects).doc(body.projectId).set(
        { currentVersionId: versionId, updatedAt: nowIso() },
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

