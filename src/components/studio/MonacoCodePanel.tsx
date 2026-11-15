"use client";

import * as React from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useStudio } from "@/store/studio-store";
import { cn, formatBytes } from "@/lib/utils";
import { MAX_FILE_BYTES } from "@/types/firestore";

const LANGUAGE_MAP: Record<string, string> = {
  tsx: "typescript",
  typescript: "typescript",
  jsx: "javascript",
  javascript: "javascript",
  css: "css",
  json: "json",
  markdown: "markdown",
  html: "html",
  plaintext: "plaintext",
};

export function MonacoCodePanel() {
  const studio = useStudio();
  const file = studio.files[studio.activeFilePath];
  const [draft, setDraft] = React.useState(file?.content ?? "");
  const dirtyRef = React.useRef(false);
  const timerRef = React.useRef<number | null>(null);
  /** The edit waiting to be written, pinned to the file it was typed into. */
  const pendingRef = React.useRef<{ filePath: string; value: string } | null>(null);

  const setFileContent = studio.setFileContent;

  /** Writes any outstanding edit immediately, to its own file. */
  const flush = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    dirtyRef.current = false;
    if (pending) setFileContent(pending.filePath, pending.value);
  }, [setFileContent]);

  // Switching files must commit the previous file's edit before the editor
  // rebinds, otherwise the pending write lands on the newly opened file.
  React.useEffect(() => {
    flush();
    setDraft(studio.files[studio.activeFilePath]?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.activeFilePath]);

  // Flush on unmount so a half-typed edit is never dropped.
  React.useEffect(() => flush, [flush]);

  // Keep the editor in sync when the file changes underneath us (AI / visual edits).
  React.useEffect(() => {
    const current = studio.files[studio.activeFilePath];
    if (current && current.content !== draft && !dirtyRef.current) {
      setDraft(current.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.files[studio.activeFilePath]?.sha256]);

  const commit = React.useCallback(
    (filePath: string, value: string) => {
      pendingRef.current = { filePath, value };
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        dirtyRef.current = false;
        if (pending) setFileContent(pending.filePath, pending.value);
      }, 500);
    },
    [setFileContent],
  );

  const handleMount: OnMount = (editor, monaco) => {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      esModuleInterop: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    editor.updateOptions({ padding: { top: 12 } });
  };

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Select a file in the Explorer to start editing.
      </div>
    );
  }

  const oversize = file.byteSize > MAX_FILE_BYTES * 0.9;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-slate-800 px-3">
        <span className="font-mono text-xs text-slate-300">{file.filePath}</span>
        <span className="font-mono text-[10px] text-slate-600">{file.language}</span>
        <span
          className={cn(
            "ml-auto font-mono text-[10px]",
            oversize ? "text-amber-400" : "text-slate-600",
          )}
        >
          {formatBytes(file.byteSize)} / {formatBytes(MAX_FILE_BYTES)}
        </span>
        <span className="font-mono text-[10px] text-slate-600">
          sha {file.sha256.slice(0, 8)}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          path={file.filePath}
          language={LANGUAGE_MAP[file.language] ?? "plaintext"}
          value={draft}
          onMount={handleMount}
          onChange={(value) => {
            dirtyRef.current = true;
            setDraft(value ?? "");
            // Pin the write to this file, not to whatever is active in 500ms.
            commit(file.filePath, value ?? "");
          }}
          options={{
            fontSize: 12.5,
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderLineHighlight: "line",
            tabSize: 2,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
