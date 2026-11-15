# Studio

An AI-powered full-stack web/app builder IDE — a modular monolith on Next.js 14 (App Router),
TypeScript (strict), Tailwind + shadcn/ui, Monaco, Sandpack, Firebase and a Gemini + Groq
orchestration layer.

```bash
npm install
cp .env.example .env.local   # add keys (optional — the app runs without them)
npm run dev                  # http://localhost:3000 → /studio/demo
```

## Architecture

```
src/
  app/
    studio/[projectId]/page.tsx   4-panel workspace route
    api/orchestrator/plan         Product → Design → Architect agents (Gemini + Groq)
    api/orchestrator/execute-task One DAG node → one generated file
    api/orchestrator/chat-patch   Surgical search/replace diffs (Groq)
    api/ast-patch                 Deterministic JSX edits, no LLM call
    api/export/github             Git Data API: blob → tree → commit → ref
    api/deploy/vercel             POST /v13/deployments with inline files
  lib/
    ai/schemas.ts        Zod schema for every AI response
    ai/provider.ts       Unified Gemini/Groq adapter with validate-and-retry
    ai/token-slicer.ts   Design tokens + direct export signatures only
    patch/studio-id.ts   data-studio-id stamping and lexical JSX scanning
    patch/ast-patch.ts   setText / class-token mutations at file:line:col
    patch/apply-diff.ts  Atomic search/replace application
    vfs/                 Per-file Firestore VFS (analyse, store, seed)
    sandpack/            Preview bundle builder + in-iframe inspector runtime
    export/              Boilerplate merge + JSZip download
  types/firestore.ts     All 13 collection document shapes
```

### VFS rule

A project's code is **never** one document. Each file is its own `source_files` document keyed
`${projectId}_${sha256(path).slice(0,32)}`, capped at 250 KB, carrying `sha256`,
`exportSignatures` and `imports`. Checkpoints in `project_versions` are immutable SHA-256
manifests.

### Context budget

`sliceContext()` renders only the design-system tokens plus the `export` signatures of a task's
direct `requiredContextFiles` — file bodies are never sent — and drops the least relevant context
files until the token budget is met.

### Dual editing engine

* **Visual** — every generated JSX tag carries `data-studio-id="<filePath>:<line>:<col>"`. The
  inspector runtime inside the Sandpack iframe reports clicks over `postMessage`; the Properties
  panel then rewrites the Tailwind token or the text node at that exact coordinate with no model
  call. Ids are re-stamped to a fixed point after each edit.
* **Chat** — `/api/orchestrator/chat-patch` returns a Zod-validated
  `{ targetFilePath, patches: [{ searchBlock, replaceBlock }] }`. Patches apply atomically: one
  ambiguous or missing block rolls the whole set back, and a successful apply creates a checkpoint.

## Configuration

| Variable | Effect when unset |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Workspace runs on the in-memory seed VFS |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `/api/ast-patch` requires the client to pass file content |
| `GEMINI_API_KEY` | `/api/orchestrator/plan` returns 503 |
| `GROQ_API_KEY` | chat patching and UI generation return 503 |

GitHub and Vercel credentials are entered per-action in the Export and Deploy dialogs and are
never persisted.
