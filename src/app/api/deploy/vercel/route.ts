import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { VercelDeployRequestSchema } from "@/lib/ai/schemas";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

const VERCEL_API = "https://api.vercel.com";

interface VercelDeploymentResponse {
  id: string;
  url: string;
  readyState?: string;
  inspectorUrl?: string;
  error?: { message: string; code?: string };
}

/**
 * 1-click hosting: POST /v13/deployments with an inline `files` array.
 * Returns as soon as Vercel accepts the build, with the live URL.
 */
export async function POST(request: Request) {
  try {
    const body = VercelDeployRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const query = body.teamId ? `?teamId=${encodeURIComponent(body.teamId)}` : "";
    const response = await fetch(`${VERCEL_API}/v13/deployments${query}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${body.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: body.projectName,
        target: body.target,
        files: body.files.map((file) => ({
          file: file.filePath,
          data: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64",
        })),
        projectSettings: {
          framework: "nextjs",
          buildCommand: null,
          installCommand: null,
          outputDirectory: null,
        },
      }),
    });

    const payload = (await response.json()) as VercelDeploymentResponse;

    if (!response.ok || payload.error) {
      return NextResponse.json(
        {
          ok: false,
          error: payload.error?.message ?? `Vercel returned ${response.status}`,
          code: payload.error?.code,
        },
        { status: response.status === 401 || response.status === 403 ? response.status : 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      deploymentId: payload.id,
      url: payload.url.startsWith("http") ? payload.url : `https://${payload.url}`,
      inspectorUrl: payload.inspectorUrl ?? null,
      readyState: payload.readyState ?? "QUEUED",
      fileCount: body.files.length,
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

/** Polls a deployment until it is READY or ERROR. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const token = request.headers.get("x-vercel-token");
  if (!id || !token) {
    return NextResponse.json({ ok: false, error: "id and x-vercel-token are required" }, { status: 400 });
  }
  const response = await fetch(`${VERCEL_API}/v13/deployments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as VercelDeploymentResponse;
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: payload.error?.message ?? `Vercel returned ${response.status}` },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    readyState: payload.readyState ?? "QUEUED",
    url: payload.url?.startsWith("http") ? payload.url : `https://${payload.url}`,
  });
}
