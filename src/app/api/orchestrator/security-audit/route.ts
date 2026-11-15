import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SecurityAuditRequestSchema } from "@/lib/ai/schemas";
import { securityAgent } from "@/lib/ai/agents";
import { runAgent } from "@/lib/ai/run-agent";
import { estimateTokens } from "@/lib/ai/token-slicer";
import { errorResponse } from "@/lib/api/errors";
import { auditPriority } from "@/lib/ai/audit-priority";
import { requireProjectAccess } from "@/lib/firebase/auth-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Files most worth auditing, within a token budget. */
const AUDIT_BUDGET_TOKENS = 14000;

export async function POST(request: Request) {
  try {
    const body = SecurityAuditRequestSchema.parse(await request.json());

    const auth = await requireProjectAccess(request, body.projectId, ["owner", "editor", "viewer"]);
    if (!auth.ok) return auth.response;

    const ranked = [...body.files].sort(
      (a, b) => auditPriority(b.filePath) - auditPriority(a.filePath),
    );

    const selected: typeof ranked = [];
    let budget = AUDIT_BUDGET_TOKENS;
    for (const file of ranked) {
      const cost = estimateTokens(file.content);
      if (cost > budget) continue;
      budget -= cost;
      selected.push(file);
    }

    const audit = await runAgent(securityAgent, {
      fileBlocks: selected
        .map((file) => `--- ${file.filePath} ---\n${file.content}`)
        .join("\n\n"),
      firestoreRules: body.firestoreRules,
    });

    const blocking = audit.data.findings.filter(
      (finding) => finding.severity === "critical" || finding.severity === "high",
    );

    return NextResponse.json({
      ok: true,
      passed: audit.data.passed && blocking.length === 0,
      summary: audit.data.summary,
      findings: audit.data.findings,
      blockingCount: blocking.length,
      auditedFiles: selected.map((file) => file.filePath),
      skippedFiles: ranked
        .filter((file) => !selected.includes(file))
        .map((file) => file.filePath),
      usage: audit.usage,
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
