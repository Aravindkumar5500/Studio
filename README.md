# Studio

**Studio is a prompt-first AI application builder and IDE.** Describe a website or application in plain language, let a multi-agent workflow plan its structure and generate the code, then refine the result in a live preview, inspect individual elements, edit source files, and export or deploy the project.

The repository currently implements a Next.js-based builder workspace with a local demo, AI-assisted generation and editing, a Sandpack preview, and optional Firebase-backed project persistence.

> **Project status:** This README describes the implementation currently present in this repository. It is not a claim that every generated application is production-ready. Generated code and deployment configuration should be reviewed and tested before production use.

## What you can do

- **Start from a prompt:** choose a project category and describe the application you want to build.
- **Choose a workflow:** use Guided mode for approval checkpoints or Autonomous mode to run the generation tasks without those approval gates.
- **Plan with AI agents:** generate a product requirements document, design system, and architecture/build-task plan.
- **Generate files:** execute build tasks that produce individual project files, with dependency-aware context and export-contract checks.
- **Edit with chat:** request targeted changes in natural language; the patch engine applies validated search/replace operations atomically.
- **Inspect visually:** select elements in the preview and adjust supported text and Tailwind styling through the inspector.
- **Edit source code:** browse project files and open them in the Monaco editor.
- **Review the build plan:** inspect the PRD and dependency graph views.
- **Preview responsive layouts:** switch between desktop, tablet, and mobile viewport presets.
- **Save and restore checkpoints:** create project snapshots and restore a selected version when Firebase persistence is configured.
- **Export and deploy:** download a project archive, push files to a GitHub repository, or create a Vercel deployment using credentials supplied for that action.

## Screens and workflow

1. Open the Studio dashboard at `/`.
2. Choose a category such as Website Builder, CRM / Dashboard, Business Site, E-Commerce, or Booking System.
3. Enter a prompt or select a starter prompt.
4. Select Guided or Autonomous mode and generate the application plan.
5. Review the PRD, design system, architecture, and generated task list.
6. Run the generation tasks and inspect the result in the preview.
7. Refine the application using AI chat, the visual inspector, or the code editor.
8. Export the source or deploy when the result has been reviewed.

The workspace includes Preview, Code, DAG Graph, and PRD Spec views. The left panel contains the AI Copilot and file explorer; the inspector provides element and theme controls.

## Technology

| Area | Implementation |
| --- | --- |
| Application framework | Next.js 14 App Router |
| Language | TypeScript (strict mode) |
| UI | React 18, Tailwind CSS, Radix UI primitives and custom components |
| Code editing | Monaco Editor |
| Live preview | CodeSandbox Sandpack |
| AI providers | Google Gemini and Groq |
| AI response validation | Zod |
| Project persistence | Firebase Authentication, Firestore and Firebase Admin (optional) |
| Visual code updates | TypeScript/JSX-aware utilities and deterministic patch operations |
| Export | JSZip |
| GitHub integration | Octokit and the Git Data API |
| Deployment | Vercel Deployments API |

## Getting started

### Requirements

- Node.js compatible with the Next.js 14 toolchain.
- npm.
- A Firebase project if you want Firebase-backed authentication and persistence.
- Gemini and/or Groq API credentials for AI-powered planning, generation, and editing.

### Install

```bash
git clone https://github.com/Aravindkumar5500/Studio.git
cd Studio
npm install
cp .env.example .env.local
```

Open `.env.local` and add the credentials for the services you intend to use. Do not commit this file.

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). The dashboard is available at `/`; the demo workspace is available at `/studio/demo`.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run the configured Next.js lint command |
| `npm run typecheck` | Run TypeScript without emitting files |

## Environment configuration

Copy `.env.example` to `.env.local`. Configure only the services you need.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client configuration | Used with the other public Firebase settings |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client configuration | Optional when Firebase is not configured |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project identifier | Used by Firebase client and server configuration |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase client configuration | Optional for workflows that do not use Firebase Storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase client configuration | Firebase web app setting |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client configuration | Firebase web app setting |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin service-account JSON | Keep private; required for Admin SDK-backed persistence and server operations |
| `GEMINI_API_KEY` | Gemini API access | Used by the product and architecture planning agents |
| `GROQ_API_KEY` | Groq API access | Used by configured UI/UX, file-generation, and chat-patching agents |
| `GITHUB_TOKEN` | — | Not required as a global variable; enter a GitHub token in the export flow when exporting |
| `VERCEL_TOKEN` | — | Not required as a global variable; enter a Vercel token in the deploy flow when deploying |
| `LOCAL_DEV_BYPASS_AUTH` | Local development auth-guard bypass | Defaults to `false`; keep disabled outside local development |

### Configuration notes

- The Firebase client settings use the `NEXT_PUBLIC_` prefix and are exposed to the browser. Never put service-account credentials or private API tokens in public variables.
- Firebase is optional for the in-memory demo/seed workspace. Firestore-backed persistence requires the Firebase Admin configuration and appropriate project setup.
- AI-backed routes return service-unavailable errors when their required provider key is missing. Configure the Gemini and Groq keys used by the agents you plan to run.
- GitHub and Vercel credentials are supplied in their respective dialogs for each action; the export/deploy routes use the submitted token.
- `LOCAL_DEV_BYPASS_AUTH` is a development convenience, not an authentication strategy. Do not enable it in a public or production deployment.

## Architecture overview

Studio is structured as a Next.js modular monolith. Its main areas are:

```text
src/
  app/
    page.tsx                         Dashboard and project launcher
    studio/[projectId]/page.tsx      Project workspace
    api/
      orchestrator/
        plan/                        Product, design and architecture planning
        execute-task/                Generate one file for a DAG task
        chat-patch/                  AI-assisted targeted edits
        qa-fix/                      Diagnostic-driven patch suggestions
      ast-patch/                     Deterministic visual JSX edits
      export/github/                 Push project files to GitHub
      deploy/vercel/                 Create a Vercel deployment
      versions/                      Checkpoint and restore endpoints
  components/studio/
    AiChatPanel.tsx
    FileExplorerPanel.tsx
    MonacoCodePanel.tsx
    SandpackCanvas.tsx
    PropertiesInspector.tsx
    DagGraphView.tsx
    PrdSpecView.tsx
    StudioWorkspace.tsx
  lib/
    ai/                              Agents, schemas, provider adapter and context slicing
    firebase/                        Client, Admin SDK and access guards
    patch/                           Atomic diffs, JSX stamping and visual patch helpers
    sandpack/                        Preview file builder and inspector runtime
    vfs/                              Virtual file system and file analysis
    export/                           Project boilerplate and ZIP helpers
  store/
    studio-store.tsx                 Workspace state and orchestration actions
  types/
    firestore.ts                     Firestore document types
```

### AI planning and generation

The planning endpoint coordinates Product, UI/UX, and Architect agents. It returns the requirements, design system, architecture, deterministic setup files, generation tasks, and (in Guided mode) approval records.

Generation is task-oriented: each task targets one file. The context slicer supplies design tokens and relevant dependency export signatures rather than sending every source file body to every task. Generated output is schema-validated, checked against the task's expected exports, stamped with Studio element identifiers where applicable, and checked against the per-file size limit before it is returned to the workspace.

### Virtual file system and checkpoints

Project source is represented as individual virtual file-system entries rather than one large project document. The Firestore model includes project, membership, source-file, version, requirements, design-system, generation-task, conversation, approval, build/test-run, and deployment records.

A version checkpoint stores a manifest of file paths, content hashes, and sizes. Version documents are immutable. Firebase security rules enforce project membership and role-aware access to project data.

### Editing and preview

- **Chat edits:** the chat-patch route returns a structured patch; operations are applied atomically so a failed or ambiguous patch does not partially modify the file set.
- **Visual edits:** JSX elements receive `data-studio-id` identifiers. The preview inspector communicates with the Studio shell, which can update supported text or style classes and persist the corresponding source edit.
- **Preview:** Sandpack builds a browser preview from the workspace file map. The preview can be inspected using the viewport and visual-inspection controls.
- **QA repair:** the QA-fix route accepts diagnostics and returns minimal patch operations from the QA agent. Treat this as an assistive repair step; rerun validation and test the application after applying any fix.

### Export and deployment

- **ZIP export:** package generated project files with the required boilerplate.
- **GitHub export:** authenticate with a token supplied in the export dialog; the server creates blobs, a tree, a commit, and updates the repository branch.
- **Vercel deployment:** submit a Vercel token in the deploy dialog to create a deployment from the project files.

Review generated source, environment configuration, access controls, and deployment settings before publishing.

## Security

- Keep `.env.local`, service-account JSON, Gemini/Groq keys, GitHub tokens, and Vercel tokens out of version control.
- Use `.env.example` only for variable names and safe placeholders; never add real credentials.
- Configure Firebase Authentication and Firestore rules before enabling shared or persistent workspaces.
- Review generated code and third-party dependencies before deployment.
- Do not enable `LOCAL_DEV_BYPASS_AUTH` in production.

## Current limitations and expectations

- Without Firebase Admin configuration, persistence-backed server operations such as checkpoint storage and restore are unavailable; the project can still use the in-memory seed/demo path.
- AI planning and generation depend on the configured provider keys, provider availability, model limits, and network access.
- AI-generated code may contain compile-time, runtime, accessibility, or security issues. A successful generation response is not a production-readiness guarantee.
- The visual inspector supports the element properties and Tailwind token groups implemented by the current inspector; it is not a full drag-and-drop visual design editor.
- Checkpoints store manifests; restoring a checkpoint changes the project's current version reference. Ensure the matching source-file content is available to the workspace when restoring.
- Export/deploy actions require valid user-supplied credentials and the necessary permissions in the target GitHub or Vercel account.

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Run the development server with `npm run dev`.
4. Run `npm run typecheck` and `npm run build` before submitting changes.
5. Include a concise description of the change and any relevant screenshots or test notes.

## License

No license file is currently included in this repository. Unless a license is added, assume that standard copyright applies and reuse, redistribution, and modification rights are not granted by default.
