import { NextResponse } from "next/server";
import { ProviderError, SchemaValidationError } from "@/lib/ai/provider";

/** Maps internal failures onto stable HTTP responses. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof SchemaValidationError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        // The model's last reply, so a bad agent response is diagnosable.
        rawPreview: error.raw.slice(0, 1200),
      },
      { status: 502 },
    );
  }
  if (error instanceof ProviderError) {
    const missingKey = /is not set/.test(error.message);
    return NextResponse.json(
      { ok: false, error: error.message, provider: error.provider },
      { status: missingKey ? 503 : 502 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
