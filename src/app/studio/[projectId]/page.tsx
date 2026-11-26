import dynamic from "next/dynamic";

const StudioWorkspace = dynamic(
  () => import("@/components/studio/StudioWorkspace").then((m) => m.StudioWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full flex-col bg-canvas text-foreground">
        {/* Skeleton header */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
            <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        {/* Skeleton body */}
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar skeleton */}
          <div className="hidden lg:flex w-80 shrink-0 flex-col border-r border-border bg-panel p-4 gap-3">
            <div className="h-8 w-full rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            <div className="mt-auto h-10 w-full rounded-lg bg-muted animate-pulse" />
          </div>
          {/* Center canvas skeleton */}
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="font-mono text-xs text-muted-foreground">
              Initializing Studio Workspace...
            </span>
          </div>
        </div>
      </div>
    ),
  },
);

export const dynamicParams = true;

export default function StudioPage({ params }: { params: { projectId: string } }) {
  return <StudioWorkspace projectId={params.projectId} />;
}
