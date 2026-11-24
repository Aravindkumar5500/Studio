import { VIEWPORTS } from "@/components/studio/TopNavBar";
import { validateDag, type DagTaskNode } from "@/lib/ai/schemas";
import { buildSandpackFiles } from "@/lib/sandpack/build-files";
import { stampStudioIds, scanJsxElements } from "@/lib/patch/studio-id";
import { setGroupToken } from "@/lib/patch/class-groups";
import { buildSeedProject, SEED_DESIGN_SYSTEM } from "@/lib/vfs/seed";
import {
  repairSourceCode,
  validateSourceCode,
  validateProjectVfs,
} from "../application/code-integrity-service";

type Status = "PASS" | "FAIL" | "BLOCKED";
interface TestReport {
  name: string;
  status: Status;
  expected: string;
  actual: string;
}

const reports: TestReport[] = [];
const baseUrl = (process.env.STUDIO_E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const authToken = process.env.STUDIO_E2E_AUTH_TOKEN;

function record(name: string, status: Status, expected: string, actual: string) {
  reports.push({ name, status, expected, actual });
  const icon = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "BLOCKED";
  console.log("[" + icon + "] " + name + " — " + actual);
}

function pass(name: string, condition: boolean, expected: string, actual: string) {
  record(name, condition ? "PASS" : "FAIL", expected, actual);
}

function blocked(name: string, reason: string) {
  record(name, "BLOCKED", "Explicit live E2E configuration required", reason);
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: "Bearer " + authToken } : {}),
  };
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, any>;
  return { response, json };
}

function runLocalChecks() {
  console.log("\n=== Studio local verification ===\n");

  // 1. Seed VFS and Sandpack entry files.
  try {
    const seedFiles = buildSeedProject();
    const keys = Object.keys(seedFiles);
    const bundle = buildSandpackFiles(seedFiles, {
      colors: SEED_DESIGN_SYSTEM.colors,
      radius: SEED_DESIGN_SYSTEM.radius,
      fontSans: SEED_DESIGN_SYSTEM.typography.fontSans,
      fontMono: SEED_DESIGN_SYSTEM.typography.fontMono,
    });
    const required = ["/App.tsx", "/index.tsx", "/studio-theme.ts", "/studio-inspector.ts"];
    const missing = required.filter((key) => !bundle[key]?.code);
    pass(
      "1. Seed VFS and Sandpack bundle",
      keys.includes("src/app/page.tsx") &&
        keys.some((key) => key.startsWith("src/components/")) &&
        missing.length === 0,
      "Seed page/components and all generated Sandpack entry files exist",
      keys.length + " source files; missing bundle files: " + (missing.join(", ") || "none"),
    );
  } catch (error) {
    record("1. Seed VFS and Sandpack bundle", "FAIL", "Bundle generation succeeds", String(error));
  }

  // 2, 3, 8 and 9 require a running local server and are handled below.
  // 4. Alias rewriting and Next.js shims.
  try {
    const sourceFiles: Record<string, string> = {
      "src/app/page.tsx":
        'import { Hero } from "@/components/Hero";\n' +
        'import Link from "next/link";\n' +
        "export default function Page() { return <main><Hero /><Link href=\"/book\">Book</Link></main>; }\n",
      "src/components/Hero.tsx": "export function Hero() { return <h1>Hero</h1>; }\n",
    };
    const bundle = buildSandpackFiles(sourceFiles, { colors: { primary: "#123456" } });
    const page = bundle["/src/app/page.tsx"]?.code || "";
    const passAliases =
      page.includes('from "/src/components/Hero"') &&
      page.includes('from "/src/__studio/next-link"') &&
      !/from\s+["']@\/|from\s+["']src\//.test(page) &&
      Boolean(bundle["/App.tsx"]?.code);
    pass(
      "4. Sandpack alias rewriting and Next.js shims",
      passAliases,
      "Aliases resolve and Next.js Link maps to the local shim",
      "Hero alias, Link shim and App entry: " + String(passAliases),
    );
  } catch (error) {
    record("4. Sandpack alias rewriting and Next.js shims", "FAIL", "Bundle alias checks pass", String(error));
  }

  // 5. Assert the actual viewport presets consumed by the UI.
  pass(
    "5. Actual responsive viewport presets",
    VIEWPORTS.desktop.width === null &&
      VIEWPORTS.tablet.width === 768 &&
      VIEWPORTS.mobile.width === 375,
    "Desktop is fluid; tablet is 768px; mobile is 375px",
    "desktop=" + VIEWPORTS.desktop.width +
      ", tablet=" + VIEWPORTS.tablet.width +
      ", mobile=" + VIEWPORTS.mobile.width,
  );

  // 6. AST stamping and class-token mutation.
  try {
    const source =
      'import React from "react";\n' +
      "export function ScheduleList() {\n" +
      "  const staff = new Set<string>();\n" +
      '  staff.add("Elena");\n' +
      '  return <div className="flex p-4"><button className="px-4">Add</button></div>;\n' +
      "}";
    const stamped = stampStudioIds("src/components/ScheduleList.tsx", source);
    const elements = scanJsxElements("src/components/ScheduleList.tsx", stamped);
    const updated = setGroupToken("bg-emerald-500 text-white px-4 py-2 rounded", "paddingX", "px-6");
    const valid =
      !stamped.includes("<string data-studio-id") &&
      elements.some((element) => element.tagName === "div") &&
      elements.some((element) => element.tagName === "button") &&
      updated.includes("px-6") &&
      !updated.includes("px-4");
    pass(
      "6. Visual inspector AST stamping and class patch",
      valid,
      "TypeScript generics remain unchanged, JSX is stamped, class token changes",
      "JSX elements=" + elements.length + "; updated classes=" + updated,
    );
  } catch (error) {
    record("6. Visual inspector AST stamping and class patch", "FAIL", "AST patch checks pass", String(error));
  }

  // 7. Verify actual theme tokens emitted by Sandpack, not a mock string replacement.
  try {
    const theme = {
      colors: {
        primary: "#123456",
        accent: "#abcdef",
        background: "#faf8f5",
        surface: "#ffffff",
        border: "#dddddd",
        foreground: "#111111",
      },
      fontSans: "Inter, sans-serif",
      fontMono: "JetBrains Mono, monospace",
      radius: { md: "10px" },
    };
    const bundle = buildSandpackFiles(buildSeedProject(), theme);
    const html = bundle["/public/index.html"]?.code || "";
    const themeModule = bundle["/studio-theme.ts"]?.code || "";
    const valid =
      html.includes("--color-primary: #123456") &&
      html.includes("--color-background: #faf8f5") &&
      themeModule.includes('"primary": "#123456"') &&
      themeModule.includes('"md": "10px"');
    pass(
      "7. Real design-token propagation into preview",
      valid,
      "Selected design tokens reach generated preview CSS and theme module",
      "Primary/background/radius tokens propagated: " + String(valid),
    );
  } catch (error) {
    record("7. Real design-token propagation into preview", "FAIL", "Theme tokens are emitted", String(error));
  }

  // 10. Syntax error detection.
  try {
    const broken = "export function BadComponent() {\n const value = {;\n return <div>Broken</div>;\n}";
    const result = validateSourceCode("src/components/BadComponent.tsx", broken);
    const syntaxDiagnostic = result.diagnostics.some(
      (diagnostic) => diagnostic.source === "typescript" || diagnostic.code === "TYPESCRIPT_PARSE_ERROR",
    );
    pass(
      "10. Syntax error detection",
      !result.valid && result.errors > 0 && syntaxDiagnostic,
      "Malformed TSX is rejected with a TypeScript diagnostic",
      "valid=" + result.valid + "; errors=" + result.errors + "; syntax diagnostic=" + syntaxDiagnostic,
    );
  } catch (error) {
    record("10. Syntax error detection", "FAIL", "Malformed TSX is rejected", String(error));
  }

  // 11. Multi-error deterministic healing.
  try {
    const broken =
      "export function MultiError() {\n" +
      " const [count, setCount] = useState(0);\n" +
      " const doubled = useMemo(() => count * 2, [count]);\n" +
      " return <div><Search /><ArrowRight /><Link href=\"/details\">Details</Link>{doubled}</div>;\n" +
      "}";
    const before = validateSourceCode("src/components/MultiError.tsx", broken);
    const repaired = repairSourceCode("src/components/MultiError.tsx", broken);
    const after = validateSourceCode("src/components/MultiError.tsx", repaired.content);
    pass(
      "11. Multi-error deterministic self-healing",
      !before.valid && repaired.repaired && repaired.valid && after.valid && after.errors === 0,
      "Missing hooks, icons, Next Link and client directive are repaired in one pass",
      "before errors=" + before.errors +
        "; repaired=" + repaired.repaired +
        "; after errors=" + after.errors,
    );
  } catch (error) {
    record("11. Multi-error deterministic self-healing", "FAIL", "All supported errors are repaired", String(error));
  }

  // Validate the project-wide VFS API directly with the seed files.
  try {
    const result = validateProjectVfs(buildSeedProject());
    pass(
      "12. Seed project-wide integrity validation",
      result.valid,
      "Seed project passes project-wide Code Integrity validation",
      "valid=" + result.valid + "; errors=" + result.errors + "; warnings=" + result.warnings,
    );
  } catch (error) {
    record("12. Seed project-wide integrity validation", "FAIL", "VFS validation completes", String(error));
  }
}

async function runLiveChecks() {
  const liveEnabled = process.env.STUDIO_RUN_LIVE_E2E === "true";
  const allowSideEffects = process.env.STUDIO_E2E_ALLOW_SIDE_EFFECTS === "true";

  if (!liveEnabled) {
    blocked("2. AI planning API", "Set STUDIO_RUN_LIVE_E2E=true to call the local server and AI providers.");
    blocked("3. Task generation API", "Requires live planning output and STUDIO_RUN_LIVE_E2E=true.");
    blocked("8. QA self-healing API", "Set STUDIO_RUN_LIVE_E2E=true to call the local QA endpoint.");
    blocked("9. Invalid QA request rejection", "Set STUDIO_RUN_LIVE_E2E=true to call the local QA endpoint.");
    return;
  }

  let plannedTasks: any[] = [];
  let designSystem: any;
  let projectId = "studio-e2e-" + Date.now();

  // 2. Live planning is explicitly side-effect gated because the route can create/update a Firestore project.
  if (!allowSideEffects) {
    blocked("2. AI planning API", "Planning can write a Firestore project. Set STUDIO_E2E_ALLOW_SIDE_EFFECTS=true to opt in.");
  } else {
    try {
      const { response, json } = await postJson("/api/orchestrator/plan", {
        projectId,
        prompt: "Build a small salon appointment booking app with services and staff selection",
        workflowMode: "autonomous",
      });
      plannedTasks = Array.isArray(json.tasks) ? json.tasks : [];
      designSystem = json.designSystem;
      const ids = new Set(plannedTasks.map((task) => task.id));
      const dependenciesValid = plannedTasks.every((task) =>
        (task.dependsOn || []).every((dependency: string) => ids.has(dependency)),
      );
      pass(
        "2. AI planning API",
        response.ok && json.ok === true && plannedTasks.length > 0 && Boolean(designSystem) && dependenciesValid,
        "Planning returns a design system and a DAG with valid dependencies",
        "HTTP " + response.status + "; tasks=" + plannedTasks.length +
          "; designSystem=" + Boolean(designSystem) + "; dependenciesValid=" + dependenciesValid +
          (json.error ? "; error=" + json.error : ""),
      );
    } catch (error) {
      record("2. AI planning API", "FAIL", "Planning API returns valid PRD/design/DAG", String(error));
    }
  }

  // 3. Convert the persisted GenerationTask shape to the exact ExecuteTaskRequestSchema shape.
  if (!plannedTasks.length || !designSystem) {
    blocked("3. Task generation API", "A successful live planning result is required first.");
  } else {
    try {
      const planned = plannedTasks[0];
      const task: DagTaskNode = {
        taskId: planned.id,
        title: planned.title,
        description: planned.description || "",
        agentRole: planned.agentRole,
        provider: planned.provider || "groq",
        order: planned.order,
        targetFilePath: planned.targetFilePath,
        dependencies: planned.dependsOn || [],
        requiredContextFiles: planned.requiredContextFiles || [],
        exportedSymbols: planned.exportedSymbols || [],
      };
      const { response, json } = await postJson("/api/orchestrator/execute-task", {
        projectId,
        task,
        designSystem,
        contextFiles: [],
      });
      const integrity = json.file?.content
        ? validateSourceCode(json.file.filePath, json.file.content)
        : null;
      pass(
        "3. Task generation API and Code Integrity",
        response.ok && json.ok === true && Boolean(json.file?.content) && Boolean(integrity?.valid),
        "Schema-valid task generates a file that passes Code Integrity",
        "HTTP " + response.status + "; file=" + (json.file?.filePath || "none") +
          "; integrity=" + (integrity?.valid ?? false) +
          (json.error ? "; error=" + json.error : ""),
      );
    } catch (error) {
      record("3. Task generation API and Code Integrity", "FAIL", "Task generation returns valid source", String(error));
    }
  }

  // 8. The deterministic fast path should heal this input without an AI provider call or database write.
  try {
    const filePath = "src/components/BookingForm.tsx";
    const buggy =
      "export function BookingForm() {\n" +
      ' const [service, setService] = useState("haircut");\n' +
      " const formatted = useMemo(() => service.toUpperCase(), [service]);\n" +
      " return <div><Calendar />{formatted}</div>;\n" +
      "}";
    const before = validateSourceCode(filePath, buggy);
    const diagnostics = before.diagnostics.map((diagnostic) => ({
      filePath: diagnostic.filePath,
      line: diagnostic.line,
      column: diagnostic.column,
      message: diagnostic.message,
      source: diagnostic.source === "ast" ? "typescript" : diagnostic.source === "build" ? "sandpack" : diagnostic.source,
    }));
    const { response, json } = await postJson("/api/orchestrator/qa-fix", {
      projectId,
      diagnostics,
      files: [{ filePath, content: buggy }],
    });
    const healed = json.files?.find((file: any) => file.filePath === filePath);
    const after = healed?.content ? validateSourceCode(filePath, healed.content) : null;
    pass(
      "8. QA API deterministic self-healing",
      response.ok && json.ok === true && json.healed === true && Boolean(after?.valid),
      "QA endpoint returns repaired source that passes Code Integrity",
      "HTTP " + response.status + "; healed=" + Boolean(json.healed) +
        "; validAfter=" + (after?.valid ?? false) +
        (json.error ? "; error=" + json.error : ""),
    );
  } catch (error) {
    record("8. QA API deterministic self-healing", "FAIL", "QA endpoint returns valid healed source", String(error));
  }

  // 9. Schema validation runs before auth, so malformed input must be rejected as 400.
  try {
    const response = await fetch(baseUrl + "/api/orchestrator/qa-fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });
    const json = (await response.json()) as Record<string, any>;
    pass(
      "9. QA API malformed request rejection",
      response.status === 400 && json.ok === false && Array.isArray(json.issues),
      "Invalid request returns HTTP 400 with Zod issues",
      "HTTP " + response.status + "; issues=" + (json.issues?.length || 0),
    );
  } catch (error) {
    record("9. QA API malformed request rejection", "FAIL", "Invalid request returns structured 400", String(error));
  }
}

async function main() {
  runLocalChecks();
  await runLiveChecks();

  const passed = reports.filter((report) => report.status === "PASS").length;
  const failed = reports.filter((report) => report.status === "FAIL").length;
  const blockedCount = reports.filter((report) => report.status === "BLOCKED").length;
  console.log("\n=== Studio verification summary ===");
  console.log("Total: " + reports.length + " | PASS: " + passed + " | FAIL: " + failed + " | BLOCKED: " + blockedCount);

  if (failed > 0) process.exitCode = 1;
}

void main().catch((error) => {
  console.error("Verification runner crashed:", error);
  process.exitCode = 1;
});
