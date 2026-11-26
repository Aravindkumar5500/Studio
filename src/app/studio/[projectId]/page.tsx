import dynamic from "next/dynamic";

const StudioWorkspace = dynamic(
  () => import("@/components/studio/StudioWorkspace").then((m) => m.StudioWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-canvas text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="font-mono text-xs text-muted-foreground">
            Initializing Studio Workspace...
          </span>
        </div>
      </div>
    ),
  },
);

export const dynamicParams = true;

export default function StudioPage({ params }: { params: { projectId: string } }) {
  return <StudioWorkspace projectId={params.projectId} />;
}
