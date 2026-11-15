import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "./admin";
import { COLLECTIONS, type MemberRole } from "@/types/firestore";

export type ProjectRole = MemberRole;

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: ProjectRole;
  isBypass?: boolean;
}

export type AuthGuardResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

/**
 * Checks if local dev bypass is explicitly allowed.
 * Security boundary: Only active when process.env.NODE_ENV === "development".
 */
export function isLocalDevBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_DEV_BYPASS_AUTH === "true"
  );
}

/**
 * Extracts and verifies the Firebase ID token from incoming Request Authorization header.
 * Returns decoded token uid & email, or clean 401 / 503 response.
 */
export async function verifyAuthToken(
  req: NextRequest | Request,
): Promise<
  | { ok: true; uid: string; email?: string; isBypass?: boolean }
  | { ok: false; response: NextResponse }
> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const isBypass = isLocalDevBypass();

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (isBypass) {
      return { ok: true, uid: "dev-local-user", email: "dev@localhost", isBypass: true };
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Unauthorized: Missing or malformed 'Authorization: Bearer <idToken>' header.",
        },
        { status: 401 },
      ),
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    if (isBypass) {
      return { ok: true, uid: "dev-local-user", email: "dev@localhost", isBypass: true };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized: Bearer token is empty." },
        { status: 401 },
      ),
    };
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    if (isBypass) {
      return { ok: true, uid: "dev-local-user", email: "dev@localhost", isBypass: true };
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Authentication service unavailable: Firebase Admin credentials not configured.",
        },
        { status: 503 },
      ),
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid, email: decoded.email, isBypass: false };
  } catch (err: unknown) {
    if (isBypass) {
      return { ok: true, uid: "dev-local-user", email: "dev@localhost", isBypass: true };
    }
    const message = err instanceof Error ? err.message : "Invalid or expired token";
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: `Unauthorized: ${message}` },
        { status: 401 },
      ),
    };
  }
}

/**
 * Production authorization guard:
 * 1. Verifies Bearer ID token with Firebase Admin Auth.
 * 2. Checks projects/{projectId}.ownerId === uid OR project_members/{projectId}_{uid} role membership.
 * 3. Enforces allowedRoles filter (defaults to ['owner', 'editor']).
 * 4. Honors LOCAL_DEV_BYPASS_AUTH=true ONLY when NODE_ENV === 'development'.
 */
export async function requireProjectAccess(
  req: NextRequest | Request,
  projectId: string,
  allowedRoles: ProjectRole[] = ["owner", "editor"],
  allowCreateIfMissing = false,
): Promise<AuthGuardResult> {
  if (!projectId || typeof projectId !== "string") {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Bad Request: 'projectId' parameter is required." },
        { status: 400 },
      ),
    };
  }

  const tokenResult = await verifyAuthToken(req);
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const { uid, email, isBypass } = tokenResult;

  if (isBypass) {
    return {
      ok: true,
      user: {
        uid,
        email,
        role: "owner",
        isBypass: true,
      },
    };
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Database service unavailable: Firebase Admin Firestore is not configured.",
        },
        { status: 503 },
      ),
    };
  }

  let userRole: ProjectRole | null = null;

  try {
    // 1. Check projects/{projectId} ownership
    const projectSnap = await adminDb.collection(COLLECTIONS.projects).doc(projectId).get();
    if (projectSnap.exists) {
      const pdata = projectSnap.data();
      if (pdata?.ownerId === uid) {
        userRole = "owner";
      }
    } else if (allowCreateIfMissing) {
      // Auto-initialize project document so ownership and Firestore security rules succeed
      userRole = "owner";
      const now = new Date().toISOString();
      await adminDb.collection(COLLECTIONS.projects).doc(projectId).set(
        {
          id: projectId,
          ownerId: uid,
          name: "Studio Project",
          slug: projectId,
          description: "AI-generated Studio application",
          status: "planning",
          workflowMode: "autonomous",
          framework: "nextjs",
          entryFilePath: "src/app/page.tsx",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    // 2. Check project_members/{projectId}_{uid} membership
    if (!userRole) {
      const memberDocId = `${projectId}_${uid}`;
      const memberSnap = await adminDb
        .collection(COLLECTIONS.projectMembers)
        .doc(memberDocId)
        .get();

      if (memberSnap.exists) {
        const mdata = memberSnap.data();
        if (mdata?.role && ["owner", "editor", "viewer"].includes(mdata.role)) {
          userRole = mdata.role as ProjectRole;
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database lookup failed";
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: `Authorization check error: ${message}` },
        { status: 500 },
      ),
    };
  }

  if (!userRole) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: `Forbidden: User ${uid} does not have access to project '${projectId}'.`,
        },
        { status: 403 },
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: `Forbidden: Role '${userRole}' is not authorized. Required: ${allowedRoles.join(", ")}.`,
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user: {
      uid,
      email,
      role: userRole,
      isBypass: false,
    },
  };
}

