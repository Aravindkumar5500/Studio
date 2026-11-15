import dynamic from "next/dynamic";

const StudioWorkspace = dynamic(
  () => import("@/components/studio/StudioWorkspace").then((m) => m.StudioWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-[#09090b] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="font-mono text-sm text-zinc-400">Initializing Studio Workspace...</span>
        </div>
      </div>
    ),
  },
);

export const dynamicParams = true;

export default function StudioPage({ params }: { params: { projectId: string } }) {
  return <StudioWorkspace projectId={params.projectId} />;
}
