import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";
import { COLLECTIONS, type ProjectVersionDoc } from "@/types/firestore";
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

    await db.collection(COLLECTIONS.projects).doc(body.projectId).set(
      { currentVersionId: body.versionId, updatedAt: nowIso() },
      { merge: true },
    );

    return NextResponse.json({ ok: true, version });
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

