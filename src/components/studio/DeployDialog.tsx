"use client";

import * as React from "react";
import { ExternalLink, Loader2, Rocket } from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { mergeWithBoilerplate, slugifyPackageName } from "@/lib/export/boilerplate";
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

export function DeployDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const studio = useStudio();
  const [projectName, setProjectName] = React.useState(slugifyPackageName(studio.projectName));
  const [token, setToken] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [target, setTarget] = React.useState<"production" | "preview">("production");
  const [busy, setBusy] = React.useState(false);
  const [deployUrl, setDeployUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDeploy() {
    setBusy(true);
    setError(null);
    setDeployUrl(null);
    try {
      const merged = mergeWithBoilerplate(studio.fileMap, { projectName: studio.projectName });
      const response = await authenticatedFetch("/api/deploy/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: studio.projectId,
          projectName,
          token,
          teamId: teamId || undefined,
          target,
          files: Object.entries(merged).map(([filePath, content]) => ({ filePath, content })),
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        url?: string;
        inspectorUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Deployment failed");
      setDeployUrl(payload.url ?? null);
      studio.createCheckpoint();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deploy to Vercel</DialogTitle>
          <DialogDescription>
            Uploads the merged project to the Vercel deployments API and returns a live URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vercel-project">Project name</Label>
            <Input
              id="vercel-project"
              value={projectName}
              onChange={(event) => setProjectName(slugifyPackageName(event.target.value))}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vercel-token">Vercel token</Label>
            <Input
              id="vercel-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="vercel_…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vercel-team">Team ID (optional)</Label>
              <Input
                id="vercel-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                placeholder="team_…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vercel-target">Target</Label>
              <select
                id="vercel-target"
                value={target}
                onChange={(event) => setTarget(event.target.value as "production" | "preview")}
                className="h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="production">Production</option>
                <option value="preview">Preview</option>
              </select>
            </div>
          </div>

          <Button
            onClick={handleDeploy}
            disabled={busy || !token || !projectName}
            className="w-full gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {busy ? "Uploading & building…" : "Deploy now"}
          </Button>
        </div>

        {deployUrl && (
          <a
            href={deployUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center gap-2 rounded-md border border-emerald-800/60 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 hover:bg-emerald-500/15"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {deployUrl}
          </a>
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
