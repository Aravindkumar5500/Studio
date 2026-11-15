import type { AstPatchRequest } from "@/lib/ai/schemas";
import { findElementByStudioId, scanJsxElements, stampStudioIds } from "./studio-id";
import {
  addClass as addClassToken,
  isClassGroup,
  removeClass as removeClassToken,
  setGroupToken,
} from "./class-groups";

export interface AstPatchOutcome {
  content: string;
  changed: boolean;
  reason?: string;
}

/**
 * Deterministic, LLM-free JSX mutation at an exact `filePath:line:col`.
 * Used by every PropertiesInspector control.
 */
export function applyAstPatch(
  filePath: string,
  source: string,
  mutation: AstPatchRequest["mutation"],
  studioId: string,
): AstPatchOutcome {
  const element = findElementByStudioId(filePath, source, studioId);
  if (!element) {
    return { content: source, changed: false, reason: `no element at ${studioId}` };
  }

  if (mutation.kind === "setText") {
    return setElementText(filePath, source, studioId, mutation.value);
  }

  const openTag = source.slice(element.tagStart, element.tagEnd);
  const current = readClassName(openTag);
  if (current === null) {
    return {
      content: source,
      changed: false,
      reason: "className is a dynamic expression; edit it in the Code panel",
    };
  }

  let next: string;
  switch (mutation.kind) {
    case "setClassToken": {
      if (!isClassGroup(mutation.group)) {
        return { content: source, changed: false, reason: `unknown class group "${mutation.group}"` };
      }
      next = setGroupToken(current, mutation.group, mutation.value);
      break;
    }
    case "addClass":
      next = addClassToken(current, mutation.value);
      break;
    case "removeClass":
      next = removeClassToken(current, mutation.value);
      break;
  }

  if (next === current) return { content: source, changed: false, reason: "no-op" };

  const nextTag = writeClassName(openTag, next);
  const updated = source.slice(0, element.tagStart) + nextTag + source.slice(element.tagEnd);
  return { content: stampStudioIds(filePath, updated), changed: true };
}

/** Replaces an element's children when they are a single static text node. */
export function setElementText(
  filePath: string,
  source: string,
  studioId: string,
  value: string,
): AstPatchOutcome {
  const element = findElementByStudioId(filePath, source, studioId);
  if (!element) return { content: source, changed: false, reason: `no element at ${studioId}` };
  if (element.selfClosing) {
    return { content: source, changed: false, reason: "self-closing element has no text" };
  }

  const closeIndex = findMatchingClose(source, element.tagEnd, element.tagName);
  if (closeIndex === -1) {
    return { content: source, changed: false, reason: "closing tag not found" };
  }
  const children = source.slice(element.tagEnd, closeIndex);
  if (/[<{]/.test(children)) {
    return {
      content: source,
      changed: false,
      reason: "element has nested or dynamic children; select a leaf element",
    };
  }
  const leading = /^\s*/.exec(children)?.[0] ?? "";
  const trailing = /\s*$/.exec(children)?.[0] ?? "";
  const escaped = escapeJsxText(value);
  const updated =
    source.slice(0, element.tagEnd) + leading + escaped + trailing + source.slice(closeIndex);
  return { content: stampStudioIds(filePath, updated), changed: children.trim() !== value };
}

export function readClassName(openTag: string): string | null {
  const literal = /\sclassName\s*=\s*"([^"]*)"/.exec(openTag);
  if (literal) return literal[1];
  const braced = /\sclassName\s*=\s*\{\s*"([^"]*)"\s*\}/.exec(openTag);
  if (braced) return braced[1];
  if (/\sclassName\s*=\s*\{/.test(openTag)) return null;
  return "";
}

export function writeClassName(openTag: string, className: string): string {
  const literal = /\sclassName\s*=\s*"([^"]*)"/.exec(openTag);
  if (literal) return openTag.replace(literal[0], ` className="${className}"`);
  const braced = /\sclassName\s*=\s*\{\s*"([^"]*)"\s*\}/.exec(openTag);
  if (braced) return openTag.replace(braced[0], ` className="${className}"`);
  const selfClosing = /\/>$/.test(openTag);
  const head = selfClosing ? openTag.slice(0, -2).trimEnd() : openTag.slice(0, -1).trimEnd();
  return `${head} className="${className}"${selfClosing ? " />" : ">"}`;
}

/** Returns the index of the `<` of the matching closing tag, or -1. */
export function findMatchingClose(source: string, from: number, tagName: string): number {
  let depth = 1;
  const open = new RegExp(`<\\s*${escapeRegExp(tagName)}(?=[\\s/>])`, "g");
  const close = new RegExp(`<\\s*/\\s*${escapeRegExp(tagName)}\\s*>`, "g");
  let i = from;
  while (i < source.length) {
    open.lastIndex = i;
    close.lastIndex = i;
    const nextOpen = open.exec(source);
    const nextClose = close.exec(source);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      const tagEnd = source.indexOf(">", nextOpen.index);
      if (tagEnd === -1) return -1;
      if (source[tagEnd - 1] !== "/") depth++;
      i = tagEnd + 1;
      continue;
    }
    depth--;
    if (depth === 0) return nextClose.index;
    i = nextClose.index + nextClose[0].length;
  }
  return -1;
}

export function escapeJsxText(value: string): string {
  return value.replace(/[{}<>]/g, (ch) => `{"${ch}"}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Everything the inspector needs about the selected element. */
export interface SelectedElementInfo {
  studioId: string;
  filePath: string;
  line: number;
  col: number;
  tagName: string;
  className: string | null;
  text: string | null;
  canEditText: boolean;
}

export function describeElement(
  filePath: string,
  source: string,
  studioId: string,
): SelectedElementInfo | null {
  const element = findElementByStudioId(filePath, source, studioId);
  if (!element) return null;
  const openTag = source.slice(element.tagStart, element.tagEnd);
  const className = readClassName(openTag);
  let text: string | null = null;
  let canEditText = false;
  if (!element.selfClosing) {
    const closeIndex = findMatchingClose(source, element.tagEnd, element.tagName);
    if (closeIndex !== -1) {
      const children = source.slice(element.tagEnd, closeIndex);
      if (!/[<{]/.test(children)) {
        text = children.trim();
        canEditText = true;
      }
    }
  }
  return {
    studioId: element.studioId,
    filePath,
    line: element.line,
    col: element.col,
    tagName: element.tagName,
    className,
    text,
    canEditText,
  };
}

export { scanJsxElements, stampStudioIds };
