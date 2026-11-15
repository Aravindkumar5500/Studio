import type { FilePatchOperation } from "@/lib/ai/schemas";
import { scanJsxElements } from "./studio-id";

export interface PatchResult {
  content: string;
  applied: number;
  failures: { searchBlock: string; reason: string }[];
}

/**
 * Applies search/replace blocks atomically: if any block fails to match
 * exactly once, nothing is changed and the failure is reported.
 */
export function applyPatchOperation(
  original: string,
  operation: FilePatchOperation,
): PatchResult {
  let draft = original;
  const failures: PatchResult["failures"] = [];

  for (const patch of operation.patches) {
    const target = normalizeLineEndings(draft);

    // Models sometimes double-escape their JSON strings, emitting a literal
    // backslash-n where the file has a real newline. Try the block as given
    // first, then the unescaped form; never the other way round, so a file
    // that genuinely contains "\n" still matches exactly.
    const candidates = buildSearchCandidates(patch.searchBlock);
    const hit = candidates.find((candidate) => target.includes(candidate.search));

    if (!hit) {
      const relaxed = findWithFlexibleIndent(target, candidates[candidates.length - 1].search);
      if (relaxed === null) {
        failures.push({ searchBlock: patch.searchBlock, reason: "no exact match found" });
        continue;
      }
      const replacement = unescapeIfNeeded(patch.replaceBlock, candidates.length > 1);
      draft = target.slice(0, relaxed.start) + replacement + target.slice(relaxed.end);
      continue;
    }

    const first = target.indexOf(hit.search);
    if (target.indexOf(hit.search, first + 1) !== -1) {
      failures.push({
        searchBlock: patch.searchBlock,
        reason: "match is ambiguous (appears more than once)",
      });
      continue;
    }
    const replacement = unescapeIfNeeded(patch.replaceBlock, hit.unescaped);
    draft = target.slice(0, first) + replacement + target.slice(first + hit.search.length);
  }

  if (failures.length) {
    return { content: original, applied: 0, failures };
  }
  return { content: draft, applied: operation.patches.length, failures: [] };
}

export function applyPatchOperations(
  files: Record<string, string>,
  operations: FilePatchOperation[],
): {
  files: Record<string, string>;
  changedPaths: string[];
  failures: { filePath: string; searchBlock: string; reason: string }[];
} {
  const next = { ...files };
  const changedPaths: string[] = [];
  const failures: { filePath: string; searchBlock: string; reason: string }[] = [];

  for (const op of operations) {
    const current = next[op.targetFilePath];
    if (current === undefined) {
      failures.push({
        filePath: op.targetFilePath,
        searchBlock: op.patches[0]?.searchBlock ?? "",
        reason: "file not found in project",
      });
      continue;
    }
    const result = applyPatchOperation(current, op);
    if (result.failures.length) {
      for (const f of result.failures) failures.push({ filePath: op.targetFilePath, ...f });
      continue;
    }

    // A search/replace block whose replacement spans more elements than it
    // matched leaves orphaned closing tags. Catch it structurally rather than
    // shipping a file that cannot compile.
    const structural = checkJsxBalance(op.targetFilePath, current, result.content);
    if (structural) {
      failures.push({
        filePath: op.targetFilePath,
        searchBlock: op.patches[0]?.searchBlock ?? "",
        reason: structural,
      });
      continue;
    }

    next[op.targetFilePath] = result.content;
    if (!changedPaths.includes(op.targetFilePath)) changedPaths.push(op.targetFilePath);
  }

  // Atomic: any failure rolls the whole operation set back.
  if (failures.length) return { files, changedPaths: [], failures };
  return { files: next, changedPaths, failures: [] };
}

/**
 * Counts opening vs closing tags per element name. Only reports a problem the
 * patch introduced: a file that was already unbalanced is left alone.
 */
export function jsxTagBalance(filePath: string, source: string): Map<string, number> {
  const balance = new Map<string, number>();
  for (const element of scanJsxElements(filePath, source)) {
    if (element.selfClosing) continue;
    balance.set(element.tagName, (balance.get(element.tagName) ?? 0) + 1);
  }
  for (const match of source.matchAll(/<\/\s*([A-Za-z][A-Za-z0-9.\-_]*)\s*>/g)) {
    balance.set(match[1], (balance.get(match[1]) ?? 0) - 1);
  }
  return balance;
}

export function checkJsxBalance(
  filePath: string,
  before: string,
  after: string,
): string | null {
  if (!/\.(tsx|jsx)$/.test(filePath)) return null;
  const beforeBalance = jsxTagBalance(filePath, before);
  const afterBalance = jsxTagBalance(filePath, after);
  for (const [tag, count] of afterBalance) {
    if (count === 0) continue;
    if ((beforeBalance.get(tag) ?? 0) === count) continue; // pre-existing
    return `patch left <${tag}> unbalanced (${count > 0 ? `${count} unclosed` : `${-count} extra closing`})`;
  }
  return null;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

/** Decodes a JSON string that was escaped one time too many. */
export function unescapeDoubleEscaped(value: string): string {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function buildSearchCandidates(
  searchBlock: string,
): { search: string; unescaped: boolean }[] {
  const asGiven = normalizeLineEndings(searchBlock);
  const candidates = [{ search: asGiven, unescaped: false }];
  if (/\\[nrt"']/.test(asGiven)) {
    const decoded = unescapeDoubleEscaped(asGiven);
    if (decoded !== asGiven) candidates.push({ search: decoded, unescaped: true });
  }
  return candidates;
}

function unescapeIfNeeded(replaceBlock: string, unescaped: boolean): string {
  return unescaped ? unescapeDoubleEscaped(normalizeLineEndings(replaceBlock)) : replaceBlock;
}

function cleanLineForMatch(line: string): string {
  return line
    .replace(/\s+data-studio-id="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Falls back to whitespace-insensitive and studio-id-insensitive line matching when indentation or attributes drifted. */
function findWithFlexibleIndent(
  haystack: string,
  needle: string,
): { start: number; end: number } | null {
  const needleLines = needle.split("\n").map(cleanLineForMatch).filter((l) => l.length > 0);
  if (!needleLines.length) return null;
  const hayLines = haystack.split("\n");
  const cleanedHayLines = hayLines.map(cleanLineForMatch);
  const offsets: number[] = [];
  let cursor = 0;
  for (const line of hayLines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  // 1. Try exact line-by-line sequential match with cleaned lines
  for (let i = 0; i <= hayLines.length - needleLines.length; i++) {
    let match = true;
    for (let j = 0; j < needleLines.length; j++) {
      if (cleanedHayLines[i + j] !== needleLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      const start = offsets[i];
      const lastIndex = i + needleLines.length - 1;
      const end = offsets[lastIndex] + hayLines[lastIndex].length;
      return { start, end };
    }
  }

  // 2. If needle has at least 3 lines, try matching by first and last anchor line
  if (needleLines.length >= 3) {
    const firstNeedle = needleLines[0];
    const lastNeedle = needleLines[needleLines.length - 1];

    for (let i = 0; i < hayLines.length; i++) {
      if (cleanedHayLines[i] === firstNeedle) {
        // Look ahead for the closing anchor within a reasonable range
        const maxLookahead = Math.min(hayLines.length - 1, i + needleLines.length + 8);
        for (let k = i + 1; k <= maxLookahead; k++) {
          if (cleanedHayLines[k] === lastNeedle) {
            const start = offsets[i];
            const end = offsets[k] + hayLines[k].length;
            return { start, end };
          }
        }
      }
    }
  }

  // 3. Whole component / whole file match fallback if needle represents most of the file
  if (needleLines.length >= hayLines.filter((l) => l.trim().length > 0).length * 0.8) {
    return { start: 0, end: haystack.length };
  }

  return null;
}
