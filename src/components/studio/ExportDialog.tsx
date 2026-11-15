"use client";

import * as React from "react";
import { Download, Github, Loader2, PackageCheck } from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { downloadProjectZip } from "@/lib/export/zip";
import { mergeWithBoilerplate } from "@/lib/export/boilerplate";
import { authenticatedFetch } from "@/lib/firebase/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const studio = useStudio();
  const [tab, setTab] = React.useState<"zip" | "github">("zip");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [owner, setOwner] = React.useState("");
  const [repoName, setRepoName] = React.useState("studio-app");
  const [token, setToken] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(true);

  const merged = React.useMemo(
    () => mergeWithBoilerplate(studio.fileMap, { projectName: studio.projectName }),
    [studio.fileMap, studio.projectName],
  );

  async function handleZip() {
    setBusy(true);
    setError(null);
    try {
      const { fileName, fileCount } = await downloadProjectZip({
        projectName: studio.projectName,
        files: studio.fileMap,
      });
      setResult(`Downloaded ${fileName} (${fileCount} files).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ZIP export failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGithub() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await authenticatedFetch("/api/export/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: studio.projectId,
          owner,
          repoName,
          isPrivate,
          token,
          commitMessage: `feat: ${studio.projectName} from Studio`,
          files: Object.entries(merged).map(([filePath, content]) => ({ filePath, content })),
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        repoUrl?: string;
        commitSha?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "GitHub push failed");
      setResult(`Pushed to ${payload.repoUrl} (${payload.commitSha?.slice(0, 7)}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub push failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export project</DialogTitle>
          <DialogDescription>
            {Object.keys(merged).length} files, including the runnable Next.js base.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex rounded-md border border-slate-800 bg-slate-950 p-0.5">
          {(["zip", "github"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === id ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {id === "zip" ? "Download ZIP" : "Push to GitHub"}
            </button>
          ))}
        </div>

        {tab === "zip" ? (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-400">
              Bundles every source file with <span className="font-mono">package.json</span>,{" "}
              <span className="font-mono">tsconfig.json</span>,{" "}
              <span className="font-mono">next.config.mjs</span>,{" "}
              <span className="font-mono">tailwind.config.ts</span> and{" "}
              <span className="font-mono">postcss.config.mjs</span>. Run{" "}
              <span className="font-mono">npm install && npm run dev</span> after unzipping.
            </p>
            <Button onClick={handleZip} disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download .zip
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gh-owner">Owner</Label>
                <Input
                  id="gh-owner"
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  placeholder="your-username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-repo">Repository</Label>
                <Input
                  id="gh-repo"
                  value={repoName}
                  onChange={(event) => setRepoName(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gh-token">Personal access token (repo scope)</Label>
              <Input
                id="gh-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ghp_…"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(event) => setIsPrivate(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900"
              />
              Create the repository as private
            </label>
            <Button
              onClick={handleGithub}
              disabled={busy || !owner || !repoName || !token}
              className="w-full gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
              Push to GitHub
            </Button>
          </div>
        )}

        {result && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-emerald-800/60 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
            <PackageCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {result}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md border border-red-800/60 bg-red-500/10 p-2.5 text-xs text-red-300">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
