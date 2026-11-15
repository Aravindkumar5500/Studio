import { repairSourceCode, validateSourceCode } from "../application/code-integrity-service";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${msg}`);
}

console.log("=== Running Code Integrity Engine Tests ===\n");

// Test 1: Critical Bug Reproduction: useState without import in src/app/page.tsx
{
  const buggyCode = `export default function HomePage() {
  const [search, setSearch] = useState("");
  return <div>{search}</div>;
}`;

  const validation = validateSourceCode("src/app/page.tsx", buggyCode);
  assert(!validation.valid, "Buggy code fails validation");
  assert(
    validation.diagnostics.some((d) => d.code === "REACT_HOOK_NOT_IMPORTED"),
    "Detects REACT_HOOK_NOT_IMPORTED for useState",
  );
  assert(
    validation.diagnostics.some((d) => d.code === "MISSING_USE_CLIENT"),
    "Detects MISSING_USE_CLIENT when hooks are present",
  );

  const repaired = repairSourceCode("src/app/page.tsx", buggyCode);
  assert(repaired.repaired, "Repairs buggy code");
  assert(repaired.content.includes('"use client";'), "Injected 'use client'");
  assert(
    repaired.content.includes('import { useState } from "react";'),
    "Injected 'import { useState } from \"react\";'",
  );
  assert(repaired.valid, "Repaired code passes validation");
}

// Test 2: Multiple hooks (useState + useMemo + useEffect)
{
  const buggyCode = `"use client";

export default function App() {
  const [count, setCount] = useState(0);
  const doubled = useMemo(() => count * 2, [count]);
  useEffect(() => {
    console.log(doubled);
  }, [doubled]);
  return <button onClick={() => setCount(count + 1)}>{doubled}</button>;
}`;

  const repaired = repairSourceCode("src/app/page.tsx", buggyCode);
  assert(repaired.repaired, "Repairs multiple hooks");
  assert(
    repaired.content.includes("useState") &&
      repaired.content.includes("useMemo") &&
      repaired.content.includes("useEffect"),
    "Injected all missing hooks into React import",
  );
  assert(repaired.valid, "Passes validation after multi-hook repair");
}

// Test 3: Lucide icons referenced in JSX without import
{
  const iconCode = `"use client";
import * as React from "react";

export function SearchBar() {
  return (
    <div>
      <Search className="w-4 h-4" />
      <ArrowRight className="w-5 h-5" />
    </div>
  );
}`;

  const repaired = repairSourceCode("src/components/SearchBar.tsx", iconCode);
  assert(repaired.repaired, "Repairs missing icons");
  assert(
    repaired.content.includes('from "lucide-react"'),
    "Injected lucide-react import",
  );
  assert(
    repaired.content.includes("Search") && repaired.content.includes("ArrowRight"),
    "Imports both Search and ArrowRight",
  );
  assert(repaired.valid, "Repaired icon code passes validation");
}

// Test 4: Existing React default import extended with hooks
{
  const existingReact = `"use client";
import React from "react";

export function Counter() {
  const [val, setVal] = useState(10);
  return <div>{val}</div>;
}`;

  const repaired = repairSourceCode("src/components/Counter.tsx", existingReact);
  assert(repaired.repaired, "Extends existing React import");
  assert(
    repaired.content.includes("import React, { useState } from \"react\";"),
    "Merged useState into existing default React import",
  );
  assert(repaired.valid, "Extended React import passes validation");
}

// Test 5: Next.js Link & Image auto-import
{
  const nextCode = `"use client";

export function Nav() {
  return (
    <nav>
      <Link href="/about">About</Link>
      <Image src="/logo.png" alt="Logo" width={100} height={100} />
    </nav>
  );
}`;

  const repaired = repairSourceCode("src/components/Nav.tsx", nextCode);
  assert(repaired.repaired, "Repairs missing Next.js components");
  assert(repaired.content.includes('import Link from "next/link";'), "Injected Link import");
  assert(repaired.content.includes('import Image from "next/image";'), "Injected Image import");
  assert(repaired.valid, "Passes validation after Next component repair");
}

// Test 6: Syntax error detection
{
  const brokenSyntax = `export default function Broken() {
  return <div>Unclosed div
}`;

  const validation = validateSourceCode("src/app/page.tsx", brokenSyntax);
  assert(!validation.valid, "Detects syntax error");
  assert(
    validation.diagnostics.some((d) => d.source === "typescript"),
    "Contains TypeScript syntax diagnostic",
  );
}

console.log("\n🎉 All 6 Code Integrity Engine Test Suites Passed Successfully!");

