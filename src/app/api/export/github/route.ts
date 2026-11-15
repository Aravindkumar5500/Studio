import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Octokit } from "@octokit/rest";
import { GithubExportRequestSchema } from "@/lib/ai/schemas";
import { errorResponse } from "@/lib/api/errors";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Serverless repo push via the Git Data API:
 *   createBlob -> createTree -> createCommit -> updateRef
 * Works for both an empty new repository and an existing one.
 */
export async function POST(request: Request) {
  try {
    const body = GithubExportRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor"]);
    if (!auth.ok) return auth.response;

    const octokit = new Octokit({ auth: body.token });

    const { owner, repoName } = body;
    let defaultBranch = "main";
    let repoUrl: string;
    let baseCommitSha: string | null = null;
    let baseTreeSha: string | undefined;

    try {
      const existing = await octokit.repos.get({ owner, repo: repoName });
      defaultBranch = existing.data.default_branch || "main";
      repoUrl = existing.data.html_url;
      try {
        const ref = await octokit.git.getRef({
          owner,
          repo: repoName,
          ref: `heads/${defaultBranch}`,
        });
        baseCommitSha = ref.data.object.sha;
        const commit = await octokit.git.getCommit({
          owner,
          repo: repoName,
          commit_sha: baseCommitSha,
        });
        baseTreeSha = commit.data.tree.sha;
      } catch {
        baseCommitSha = null; // Empty repository: no ref yet.
      }
    } catch (error) {
      if (!isNotFound(error)) throw error;
      const authed = await octokit.users.getAuthenticated();
      const created =
        authed.data.login.toLowerCase() === owner.toLowerCase()
          ? await octokit.repos.createForAuthenticatedUser({
              name: repoName,
              private: body.isPrivate,
              auto_init: false,
            })
          : await octokit.repos.createInOrg({
              org: owner,
              name: repoName,
              private: body.isPrivate,
            });
      repoUrl = created.data.html_url;
      defaultBranch = created.data.default_branch || "main";
    }

    // 1. Blobs
    const blobs = await Promise.all(
      body.files.map(async (file) => {
        const blob = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64",
        });
        return { path: file.filePath, sha: blob.data.sha };
      }),
    );

    // 2. Tree
    const tree = await octokit.git.createTree({
      owner,
      repo: repoName,
      base_tree: baseTreeSha,
      tree: blobs.map((blob) => ({
        path: blob.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      })),
    });

    // 3. Commit
    const commit = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: body.commitMessage,
      tree: tree.data.sha,
      parents: baseCommitSha ? [baseCommitSha] : [],
    });

    // 4. Ref
    const refName = `heads/${defaultBranch}`;
    if (baseCommitSha) {
      await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: refName,
        sha: commit.data.sha,
        force: false,
      });
    } else {
      await octokit.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/${refName}`,
        sha: commit.data.sha,
      });
    }

    return NextResponse.json({
      ok: true,
      repoUrl,
      branch: defaultBranch,
      commitSha: commit.data.sha,
      fileCount: body.files.length,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", issues: error.issues },
        { status: 400 },
      );
    }
    const message = describeGithubError(error);
    if (message) return NextResponse.json({ ok: false, error: message }, { status: 502 });
    return errorResponse(error);
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: number }).status === 404;
}

function describeGithubError(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: number }).status;
  const message = (error as { message?: string }).message;
  if (!status) return null;
  if (status === 401) return "GitHub rejected the token (401). Check that it has the `repo` scope.";
  if (status === 403) return "GitHub returned 403 — the token lacks permission for that owner.";
  if (status === 422) return `GitHub rejected the request (422): ${message ?? "validation failed"}`;
  return `GitHub error ${status}: ${message ?? "unknown"}`;
}
