"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Layers,
  LayoutDashboard,
  Globe,
  Briefcase,
  ShoppingCart,
  Calendar,
  Play,
  Trash2,
  Clock,
  Zap,
  FolderKanban,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SavedProject {
  id: string;
  name: string;
  prompt: string;
  category: string;
  mode: "guided" | "autonomous";
  createdAt: string;
  isFreshProject?: boolean;
}

const CATEGORIES = [
  { id: "Website Builder", label: "Website Builder", icon: Globe, placeholder: "e.g. Modern landing page with hero, features grid, pricing table, and testimonials" },
  { id: "CRM / Dashboard", label: "CRM / Dashboard", icon: LayoutDashboard, placeholder: "e.g. Build a clean Sales CRM dashboard with leads table and pipeline stats" },
  { id: "Business Site", label: "Business Site", icon: Briefcase, placeholder: "e.g. Digital consulting agency site with services breakdown, case studies, and contact modal" },
  { id: "E-Commerce", label: "E-Commerce", icon: ShoppingCart, placeholder: "e.g. Minimalist storefront with product catalog, filter tabs, cart drawer, and checkout summary" },
  { id: "Booking System", label: "Booking System", icon: Calendar, placeholder: "e.g. Salon appointment booking SaaS with specialist picker, calendar slots, and confirmation flow" },
];

const QUICK_STARTERS = [
  {
    category: "CRM / Dashboard",
    prompt: "Build a clean Sales CRM dashboard with leads table and pipeline stats",
  },
  {
    category: "Booking System",
    prompt: "Salon & spa appointment booking app with staff selector, calendar slots, and service tiers",
  },
  {
    category: "Business Site",
    prompt: "Creative design agency business website with portfolio showcase, client logos, and contact section",
  },
  {
    category: "E-Commerce",
    prompt: "Modern sneaker e-commerce shop with product grid, interactive cart drawer, and review ratings",
  },
];

export default function StudioDashboardPage() {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState("");
  const [category, setCategory] = React.useState("CRM / Dashboard");
  const [mode, setMode] = React.useState<"guided" | "autonomous">("autonomous");
  const [projects, setProjects] = React.useState<SavedProject[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Hydrate recent projects from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("studio_recent_projects");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setProjects(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not load recent projects:", e);
    }
  }, []);

  const handleSelectCategory = (catId: string) => {
    setCategory(catId);
    const catObj = CATEGORIES.find((c) => c.id === catId);
    if (!prompt.trim() && catObj) {
      setPrompt(catObj.placeholder.replace(/^e\.g\.\s*/, ""));
    }
  };

  const handleLaunchProject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isSubmitting) return;

    setIsSubmitting(true);
    const projectId = `proj_${Date.now()}`;

    // Derive a clean short title
    const firstSentence = cleanPrompt.split(/[.!?\n]/)[0].trim();
    const derivedName =
      firstSentence.length > 40
        ? firstSentence.slice(0, 38).trim() + "..."
        : firstSentence || `${category} App`;

    const newProject: SavedProject = {
      id: projectId,
      name: derivedName,
      prompt: cleanPrompt,
      category,
      mode,
      createdAt: new Date().toISOString(),
      isFreshProject: true,
    };

    try {
      // Save specific project info
      localStorage.setItem(`studio_project_${projectId}`, JSON.stringify(newProject));
      // Update recent projects list
      const updatedList = [newProject, ...projects.filter((p) => p.id !== projectId)].slice(0, 12);
      localStorage.setItem("studio_recent_projects", JSON.stringify(updatedList));
      setProjects(updatedList);
    } catch (err) {
      console.warn("Failed saving project locally:", err);
    }

    // Redirect to studio workspace
    router.push(
      `/studio/${projectId}?prompt=${encodeURIComponent(cleanPrompt)}&mode=${mode}&category=${encodeURIComponent(category)}`,
    );
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.removeItem(`studio_project_${id}`);
      const updated = projects.filter((p) => p.id !== id);
      localStorage.setItem("studio_recent_projects", JSON.stringify(updated));
      setProjects(updated);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-canvas text-foreground flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-panel/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5 text-zinc-950" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">Studio</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 font-mono">
                v2.0
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <a
              href="#my-projects"
              className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              My Projects
            </a>
            <Link
              href="/studio/demo"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-zinc-900/80 px-3.5 text-xs font-medium text-zinc-200 shadow-sm transition-all hover:bg-zinc-800 hover:text-white hover:border-white/[0.2]"
            >
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>Open Demo (Nimbus)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero & Prompt Builder */}
      <main className="flex-1 flex flex-col items-center px-6 pt-12 pb-20">
        <section className="w-full max-w-3xl flex flex-col items-center text-center gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-sm shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Prompt-First AI App Builder · Next.js 14 + Sandpack</span>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              What do you want to build today?
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Describe your application in plain language. Studio orchestrates AI agents to plan the architecture and write live, production-grade Next.js components.
            </p>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                    isSelected
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-sm shadow-emerald-500/20"
                      : "border-white/[0.08] bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isSelected ? "text-emerald-400" : "text-zinc-500")} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Prompt Box Card */}
          <form
            onSubmit={handleLaunchProject}
            className="w-full rounded-2xl border border-white/[0.12] bg-zinc-950/80 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-white/[0.05] flex flex-col gap-3 text-left transition-all focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleLaunchProject();
                }
              }}
              placeholder={
                CATEGORIES.find((c) => c.id === category)?.placeholder ||
                "e.g. Real Estate CRM with leads pipeline, Salon Booking SaaS, Agency Business Site..."
              }
              rows={4}
              className="w-full resize-none rounded-xl bg-transparent p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 px-1">
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-zinc-900/90 p-1">
                <button
                  type="button"
                  onClick={() => setMode("guided")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                    mode === "guided"
                      ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.08]"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                  title="Review PRD spec & architecture approvals before generating code"
                >
                  <span>Guided</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("autonomous")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                    mode === "autonomous"
                      ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-200 ring-1 ring-emerald-500/40"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                  title="Auto-execute all build tasks directly into Sandpack live preview"
                >
                  <Zap className="h-3 w-3 text-emerald-400" />
                  <span>Autonomous</span>
                </button>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={!prompt.trim() || isSubmitting}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-xs font-bold transition-all shadow-md",
                  !prompt.trim() || isSubmitting
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/[0.05]"
                    : "bg-emerald-500 text-zinc-950 shadow-emerald-500/25 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]",
                )}
              >
                <span>{isSubmitting ? "Orchestrating..." : "Generate Application"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>

          {/* Quick Starter Suggestions */}
          <div className="w-full flex flex-col items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Popular Starters
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {QUICK_STARTERS.map((starter, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setCategory(starter.category);
                    setPrompt(starter.prompt);
                  }}
                  className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left"
                >
                  {starter.prompt}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* My Projects & Showcase Section */}
        <section id="my-projects" className="w-full max-w-5xl pt-20 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2.5">
              <FolderKanban className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold tracking-tight text-white">My Projects & Workspaces</h2>
            </div>
            <span className="text-xs text-zinc-500">
              {projects.length + 1} workspace{projects.length !== 0 ? "s" : ""} available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Nimbus Interactive Demo Card (Always Prominent) */}
            <div className="group relative rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-zinc-950/90 p-5 shadow-lg backdrop-blur-md flex flex-col justify-between transition-all hover:border-emerald-500/60 hover:shadow-emerald-500/10">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <Sparkles className="h-2.5 w-2.5" />
                    Interactive Demo
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">v1.0 Ready</span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Nimbus SaaS Landing
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Pre-configured Next.js showcase app with 9 modular components, live color token switching, and AST visual element inspection.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono">Demo Workspace</span>
                <Link
                  href="/studio/demo"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-sm hover:bg-emerald-400 transition-all"
                >
                  <span>Open Demo</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* User Saved Projects */}
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="group relative rounded-2xl border border-white/[0.08] bg-zinc-950/70 p-5 shadow-md backdrop-blur-md flex flex-col justify-between transition-all hover:border-white/[0.2] hover:bg-zinc-900/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      {proj.category || "Application"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(proj.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {proj.name}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {proj.prompt}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-emerald-400/90 font-mono uppercase">
                      {proj.mode}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <Link
                    href={`/studio/${proj.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all"
                  >
                    <span>Open</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-panel/40 py-8 px-6 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-zinc-300">Studio</span>
            <span>— Prompt-First Autonomous App Builder</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Next.js 14 App Router</span>
            <span>•</span>
            <span>Monaco & Sandpack</span>
            <span>•</span>
            <span>Gemini + Groq</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
