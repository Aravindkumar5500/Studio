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
  if (filePath.endsWith(".json")) return { icon: FileJson, color: "text-warning" };
  if (filePath.endsWith(".css")) return { icon: FileType2, color: "text-primary" };
  if (filePath.endsWith(".md")) return { icon: FileText, color: "text-success" };
  return { icon: FileCode2, color: "text-primary" };
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
    <div className="flex h-full flex-col select-none bg-panel">
      {/* Subheader */}
      {!hideHeader && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3.5 bg-surface/50">
          <div className="flex items-center gap-2">
            <Folder className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Workspace Files
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface"
            title="Create new file"
          >
            <Plus className="h-3 w-3 text-primary" />
            <span>New File</span>
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="border-b border-border p-2 bg-surface/30">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files..."
            aria-label="Filter workspace files"
            className="h-7 w-full rounded-lg border border-input bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear file filter"
              className="absolute right-2 text-muted-foreground hover:text-foreground"
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
                className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
                {isCollapsed ? (
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="tracking-wide">{group}</span>
                <span className="ml-auto rounded-full bg-surface border border-border px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
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
                          "group relative flex items-center rounded-md px-2 py-1 text-xs transition-colors",
                          active
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => studio.openFile(path)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          title={path}
                        >
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : color)} />
                          <span className="truncate font-mono text-[11px]">{fileName}</span>
                          <span className="ml-auto shrink-0 pr-1 text-[9px] text-muted-foreground group-hover:hidden">
                            {formatBytes(file.byteSize)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(path)}
                          className="hidden rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:block"
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
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No files matching &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription className="text-xs">
              <span className="font-mono text-primary font-medium">{pendingDelete}</span> will be
              removed from the project workspace. You can restore it anytime from an earlier checkpoint.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create new source file</DialogTitle>
            <DialogDescription className="text-xs">
              Adds a component or page to the project virtual file system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="new-file-path">File path</Label>
            <Input
              id="new-file-path"
              value={newPath}
              autoFocus
              onChange={(event) => setNewPath(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleCreate()}
              className="font-mono text-xs"
              placeholder="src/components/Pricing.tsx"
            />
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate}>
              Create file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
