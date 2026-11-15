"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { FILE_GROUPS, groupForPath, type FileGroup } from "@/lib/vfs/analyze";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getFileIcon(filePath: string) {
  if (filePath.endsWith(".json")) return { icon: FileJson, color: "text-amber-400" };
  if (filePath.endsWith(".css")) return { icon: FileType2, color: "text-violet-400" };
  if (filePath.endsWith(".md")) return { icon: FileText, color: "text-emerald-400" };
  return { icon: FileCode2, color: "text-sky-400" };
}

export function FileExplorerPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const studio = useStudio();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [creating, setCreating] = React.useState(false);
  const [newPath, setNewPath] = React.useState("src/components/");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const filteredPaths = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Object.keys(studio.files).sort();
    if (!q) return all;
    return all.filter((p) => p.toLowerCase().includes(q));
  }, [studio.files, query]);

  const grouped = React.useMemo(() => {
    const buckets: Record<FileGroup, string[]> = {
      Pages: [],
      Components: [],
      "Theme & Config": [],
    };
    for (const path of filteredPaths) {
      buckets[groupForPath(path)].push(path);
    }
    return buckets;
  }, [filteredPaths]);

  function handleCreate() {
    const path = newPath.trim();
    if (!path || path.endsWith("/")) {
      setCreateError("Enter a full file path, e.g. src/components/Pricing.tsx");
      return;
    }
    if (studio.files[path]) {
      setCreateError("A file with that path already exists.");
      return;
    }
    studio.createFile(path);
    studio.openFile(path);
    setCreating(false);
    setCreateError(null);
    setNewPath("src/components/");
  }

  return (
    <div className="flex h-full flex-col select-none bg-panel/30">
      {/* Subheader */}
      {!hideHeader && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-3.5 bg-panel/50">
          <div className="flex items-center gap-2">
            <Folder className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold tracking-wider text-zinc-300 uppercase">
              Workspace Files
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800 hover:text-white"
            title="Create new file"
          >
            <Plus className="h-3 w-3 text-emerald-400" />
            <span>New File</span>
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="border-b border-white/[0.06] p-2 bg-zinc-950/40">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files..."
            className="h-7 w-full rounded-lg border border-white/[0.08] bg-zinc-900/80 pl-8 pr-7 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {FILE_GROUPS.map((group) => {
          const files = grouped[group];
          const isCollapsed = collapsed[group] && !query;
          if (query && files.length === 0) return null;

          return (
            <div key={group} className="space-y-0.5">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group]: !c[group] }))}
                className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-zinc-500 transition-transform group-hover:text-zinc-300" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-zinc-500 transition-transform group-hover:text-zinc-300" />
                )}
                {isCollapsed ? (
                  <Folder className="h-3.5 w-3.5 text-zinc-500" />
                ) : (
                  <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span className="tracking-wide">{group}</span>
                <span className="ml-auto rounded-full bg-zinc-900 px-1.5 py-0.2 font-mono text-[9px] text-zinc-500">
                  {files.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 pl-3">
                  {files.map((path) => {
                    const { icon: Icon, color } = getFileIcon(path);
                    const file = studio.files[path];
                    const active = studio.activeFilePath === path;
                    const fileName = path.split("/").pop();

                    return (
                      <div
                        key={path}
                        className={cn(
                          "group relative flex items-center rounded-md px-2 py-1 text-xs transition-all",
                          active
                            ? "bg-emerald-500/15 text-emerald-100 font-medium ring-1 ring-emerald-500/30"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => studio.openFile(path)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          title={path}
                        >
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-emerald-400" : color)} />
                          <span className="truncate font-mono text-[11px]">{fileName}</span>
                          <span className="ml-auto shrink-0 pr-1 text-[9px] text-zinc-500/80 group-hover:hidden">
                            {formatBytes(file.byteSize)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(path)}
                          className="hidden rounded p-0.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 group-hover:block"
                          aria-label={`Delete ${path}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredPaths.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-zinc-500">
            No files matching &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Delete file?</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              <span className="font-mono text-emerald-300 font-medium">{pendingDelete}</span> will be
              removed from the project workspace. You can restore it anytime from an earlier checkpoint.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(null)}
              className="border-white/[0.1] bg-zinc-900"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingDelete) studio.removeFile(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md border-white/[0.1] bg-zinc-950/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Create new source file</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Adds a component or page to the project virtual file system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="new-file-path" className="text-xs text-zinc-300">
              File path
            </Label>
            <Input
              id="new-file-path"
              value={newPath}
              autoFocus
              onChange={(event) => setNewPath(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleCreate()}
              className="font-mono text-xs border-white/[0.1] bg-zinc-900/90 text-white"
              placeholder="src/components/Pricing.tsx"
            />
            {createError && <p className="text-xs text-red-400">{createError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(false)}
              className="border-white/[0.1] bg-zinc-900"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              className="bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400"
            >
              Create file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
