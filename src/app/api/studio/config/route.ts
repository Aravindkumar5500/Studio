import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import studioConfig from "@/config/studio.config.json";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves dynamic Studio UI configuration (categories, starters, themes,
 * inspector options, stage backgrounds, and sandbox package versions from package.json).
 * Merges Firestore `studio_config` overrides when Firebase Admin is configured.
 */
export async function GET() {
  let merged: Record<string, unknown> = { ...studioConfig };

  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      const snap = await adminDb.collection("studio_config").get();
      if (!snap.empty) {
        const overrides: Record<string, unknown> = {};
        snap.forEach((doc) => {
          overrides[doc.id] = doc.data().items ?? doc.data();
        });
        merged = { ...merged, ...overrides };
      }
    } catch (err) {
      console.warn("Firestore studio_config fetch skipped:", err);
    }
  }

  let allDeps: Record<string, string> = {};
  try {
    const pkgRaw = await readFile(path.join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> };
    allDeps = pkg.dependencies ?? {};
  } catch (err) {
    console.warn("Could not read package.json for sandboxDependencies:", err);
  }

  const runtimeList = Array.isArray(merged.sandboxRuntimePackages)
    ? (merged.sandboxRuntimePackages as string[])
    : [];
  const sandboxDependencies: Record<string, string> = {};
  for (const name of runtimeList) {
    if (allDeps[name]) {
      sandboxDependencies[name] = allDeps[name];
    }
  }

  return NextResponse.json({
    ok: true,
    config: {
      ...merged,
      sandboxDependencies,
    },
  });
}
