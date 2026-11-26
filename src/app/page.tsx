"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, Check,
  Clock3, Code2, Command, FolderOpen, Globe2, Layers3, LayoutDashboard,
  Plus, ShoppingBag, Trash2, Zap
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SavedProject {
  id: string; name: string; prompt: string; category: string;
  mode: "guided" | "autonomous"; createdAt: string; isFreshProject?: boolean;
}

const CATEGORIES = [
  { id: "Website Builder", label: "Website", icon: Globe2, hint: "A marketing site, portfolio, or product page" },
  { id: "CRM / Dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "A workspace for data, teams, and operations" },
  { id: "Business Site", label: "Business app", icon: BriefcaseBusiness, hint: "A service business or company website" },
  { id: "E-Commerce", label: "Commerce", icon: ShoppingBag, hint: "A storefront, catalogue, or checkout" },
  { id: "Booking System", label: "Booking", icon: CalendarDays, hint: "Appointments, schedules, and reservations" },
];

export default function StudioDashboardPage() {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState("");
  const [category, setCategory] = React.useState("CRM / Dashboard");
  const [mode, setMode] = React.useState<"guided" | "autonomous">("autonomous");
  const [projects, setProjects] = React.useState<SavedProject[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("studio_recent_projects");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setProjects(parsed);
      }
    } catch (error) { console.warn("Could not load recent projects:", error); }
  }, []);

  function launchProject(event?: React.FormEvent) {
    event?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isSubmitting) return;
    setIsSubmitting(true);
    const projectId = "proj_" + Date.now();
    const firstSentence = cleanPrompt.split(/[.!?\n]/)[0].trim();
    const name = firstSentence.length > 40 ? firstSentence.slice(0, 38).trim() + "…" : firstSentence || category + " app";
    const project: SavedProject = { id: projectId, name, prompt: cleanPrompt, category, mode, createdAt: new Date().toISOString(), isFreshProject: true };
    try {
      localStorage.setItem("studio_project_" + projectId, JSON.stringify(project));
      const updated = [project, ...projects.filter((item) => item.id !== projectId)].slice(0, 12);
      localStorage.setItem("studio_recent_projects", JSON.stringify(updated));
      setProjects(updated);
    } catch (error) { console.warn("Could not save project locally:", error); }
    router.push("/studio/" + projectId + "?prompt=" + encodeURIComponent(cleanPrompt) + "&mode=" + mode + "&category=" + encodeURIComponent(category));
  }

  function deleteProject(event: React.MouseEvent, id: string) {
    event.preventDefault(); event.stopPropagation();
    try {
      localStorage.removeItem("studio_project_" + id);
      const updated = projects.filter((item) => item.id !== id);
      localStorage.setItem("studio_recent_projects", JSON.stringify(updated));
      setProjects(updated);
    } catch (error) { console.warn("Could not remove project:", error); }
  }

  const selectedCategory = CATEGORIES.find((item) => item.id === category) || CATEGORIES[1];

  return (
    <div className="studio-shell">
      <header className="studio-header sticky top-0 z-40">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Studio home">
            <span className="studio-brand-mark"><Layers3 className="h-[17px] w-[17px]" /></span>
            <span className="font-display text-[17px] font-bold tracking-tight">studio<span className="studio-muted">.</span></span>
            <span className="hidden border-l studio-rule pl-3 text-[10px] font-medium uppercase tracking-[.14em] studio-muted sm:inline">Build environment</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a href="#projects" className="hidden text-xs font-semibold studio-muted transition-colors hover:text-foreground sm:inline">Your work</a>
            <Link href="/studio/demo" className="studio-quiet-action"><Layers3 className="h-3.5 w-3.5" /> Open demo <ArrowUpRight className="h-3 w-3" /></Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          <div className="max-w-[850px]">
            <p className="studio-kicker mb-5 flex items-center gap-2"><span className="h-px w-7 bg-current" /> A workspace for making software</p>
            <h1 className="font-display max-w-[780px] text-[clamp(2.7rem,6vw,5.35rem)] font-semibold leading-[.99] tracking-[-.065em]">
              Start with an idea.<br /><span className="studio-muted">Leave with a working app.</span>
            </h1>
            <p className="mt-6 max-w-[590px] text-[15px] leading-7 studio-muted">
              Shape the product, make the interface, and work directly with the code. Studio keeps the whole process in one place — with you in control.
            </p>

            <form onSubmit={launchProject} className="studio-surface mt-9 overflow-hidden rounded-xl shadow-[0_14px_50px_rgba(25,28,26,.06)]">
              <div className="flex items-center justify-between border-b studio-rule px-5 py-3.5">
                <span className="studio-kicker">New project</span>
                <span className="flex items-center gap-1.5 text-[10px] studio-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Ready when you are</span>
              </div>
              <div className="px-5 pt-4 sm:px-6">
                <label htmlFor="project-brief" className="mb-2 block text-xs font-semibold">What are we making?</label>
                <textarea id="project-brief" value={prompt} onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); launchProject(); } }}
                  placeholder={"Describe the product, who it is for, and what it needs to do. For example: " + selectedCategory.hint.toLowerCase() + "…"}
                  rows={4} className="studio-input min-h-[116px] text-[14px] leading-7" aria-describedby="prompt-hint" />
                <div id="prompt-hint" className="mt-2 flex items-center gap-2 text-[10px] studio-muted"><Command className="h-3 w-3" /> Press ⌘ Enter to start building</div>
              </div>
              <div className="mt-5 flex flex-col gap-4 border-t studio-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap gap-1.5" aria-label="Build mode">
                  <button type="button" onClick={() => setMode("guided")} aria-pressed={mode === "guided"} className={"rounded-md px-3 py-2 text-xs font-semibold transition-colors " + (mode === "guided" ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "studio-muted hover:bg-[var(--surface-muted)]")}>Guided review</button>
                  <button type="button" onClick={() => setMode("autonomous")} aria-pressed={mode === "autonomous"} className={"rounded-md px-3 py-2 text-xs font-semibold transition-colors " + (mode === "autonomous" ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "studio-muted hover:bg-[var(--surface-muted)]")}><Zap className="mr-1 inline h-3 w-3" /> Autonomous</button>
                </div>
                <button type="submit" disabled={!prompt.trim() || isSubmitting} className="studio-action">{isSubmitting ? "Preparing workspace…" : "Create project"} <ArrowRight className="h-4 w-4" /></button>
              </div>
            </form>

            <div className="mt-6">
              <p className="mb-3 text-[11px] font-semibold studio-muted">Choose a starting point</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)} className="studio-category flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-5 lg:pt-1">
            <div className="studio-surface rounded-xl p-5">
              <div className="flex items-center justify-between"><span className="studio-kicker">A considered workflow</span><Code2 className="h-4 w-4 studio-muted" /></div>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--surface-muted)] text-xs font-bold">1</span><div><p className="text-sm font-semibold">Plan the product</p><p className="mt-1 text-xs leading-5 studio-muted">Turn the brief into requirements, design direction, and a build plan.</p></div></div>
                <div className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--surface-muted)] text-xs font-bold">2</span><div><p className="text-sm font-semibold">Build in context</p><p className="mt-1 text-xs leading-5 studio-muted">Generate real files and see changes in the live preview.</p></div></div>
                <div className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--surface-muted)] text-xs font-bold">3</span><div><p className="text-sm font-semibold">Refine and ship</p><p className="mt-1 text-xs leading-5 studio-muted">Edit visually or in code, then export or deploy your project.</p></div></div>
              </div>
            </div>
            <div className="studio-surface-muted rounded-xl p-5">
              <p className="studio-kicker">Built for real work</p>
              <p className="mt-3 font-display text-2xl font-semibold leading-tight">Your code stays yours.</p>
              <p className="mt-2 text-xs leading-6 studio-muted">Inspect every generated file, make direct edits, keep checkpoints, and take the project with you.</p>
              <div className="mt-5 flex items-center gap-2 text-[11px] font-semibold"><Check className="h-3.5 w-3.5 text-[var(--accent-strong)]" /> No black-box handoff</div>
            </div>
          </aside>
        </section>

        <section id="projects" className="mt-20 scroll-mt-24">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b studio-rule pb-4">
            <div><p className="studio-kicker">Project library</p><h2 className="mt-2 font-display text-2xl font-semibold">Pick up where you left off</h2></div>
            <span className="text-xs studio-muted">{projects.length} saved project{projects.length === 1 ? "" : "s"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Link href="/studio/demo" className="studio-project-card group">
              <div><div className="flex items-center justify-between"><span className="studio-kicker">Sample workspace</span><ArrowUpRight className="h-4 w-4 studio-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
                <h3 className="mt-8 font-display text-xl font-semibold">Nimbus — product site</h3>
                <p className="mt-2 text-xs leading-6 studio-muted">Explore a working example with live preview, editable components, and visual inspection.</p>
              </div>
              <div className="mt-7 flex items-center justify-between border-t studio-rule pt-4 text-[10px] studio-muted"><span>DEMO PROJECT</span><span>Open workspace ↗</span></div>
            </Link>
            {projects.map((project) => (
              <article key={project.id} className="studio-project-card">
                <div><div className="flex items-center justify-between gap-2"><span className="studio-kicker truncate">{project.category || "Application"}</span><span className="flex shrink-0 items-center gap-1 text-[10px] studio-muted"><Clock3 className="h-3 w-3" />{new Date(project.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span></div>
                  <h3 className="mt-8 truncate font-display text-xl font-semibold">{project.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-6 studio-muted">{project.prompt}</p>
                </div>
                <div className="mt-7 flex items-center justify-between border-t studio-rule pt-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider studio-muted"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />{project.mode}</div>
                  <div className="flex items-center gap-3"><button type="button" onClick={(event) => deleteProject(event,project.id)} className="rounded p-1.5 studio-muted hover:text-red-600" aria-label={"Delete " + project.name}><Trash2 className="h-3.5 w-3.5" /></button><Link href={"/studio/" + project.id} className="text-xs font-semibold text-[var(--accent-strong)] hover:underline">Open project <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>
                </div>
              </article>
            ))}
            {projects.length === 0 && <div className="flex min-h-[210px] flex-col justify-center rounded-xl border border-dashed studio-rule px-6 text-center"><FolderOpen className="mx-auto h-5 w-5 studio-muted" /><p className="mt-3 text-sm font-semibold">Your next project starts here</p><p className="mt-1 text-xs studio-muted">Created projects will appear in this library.</p></div>}
          </div>
        </section>
        <footer className="mt-16 flex flex-col justify-between gap-2 border-t studio-rule pt-5 text-[10px] studio-muted sm:flex-row"><span>STUDIO / BUILD ENVIRONMENT</span><span>Plan clearly. Build deliberately. Keep ownership.</span></footer>
      </main>
    </div>
  );
}
