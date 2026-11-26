"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Compass,
  Database,
  ExternalLink,
  FolderKanban,
  Layers,
  LogIn,
  LogOut,
  Moon,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { HeroPreviewComposition } from "@/components/dashboard/HeroPreviewComposition";
import { TemplatePreviewCard } from "@/components/dashboard/TemplatePreviewCard";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { COLLECTIONS, type ProjectDoc } from "@/types/firestore";
import {
  resolveConfigIcon,
  type CategoryConfig,
  type StarterConfig,
  type StudioConfig,
} from "@/config/studio-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface SavedProject {
  id: string;
  name: string;
  prompt: string;
  category: string;
  mode: "guided" | "autonomous";
  createdAt: string;
  isFreshProject?: boolean;
  includeBackend?: boolean;
  source?: "firestore" | "local";
}

const CAPABILITIES = [
  {
    title: "Multi-Agent Workflow",
    description: "Product, design, code and QA agents",
    icon: Layers,
  },
  {
    title: "Production-Ready Code",
    description: "Clean, scalable and maintainable",
    icon: Code2,
  },
  {
    title: "Full-Stack, End-to-End",
    description: "Frontend, backend, DB and deployment",
    icon: Zap,
  },
  {
    title: "Iterate & Improve",
    description: "Refine with natural conversation",
    icon: RefreshCw,
  },
] as const;

export default function StudioDashboardPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const promptInputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = React.useState("");
  const [categories, setCategories] = React.useState<CategoryConfig[]>([]);
  const [starters, setStarters] = React.useState<StarterConfig[]>([]);
  const [category, setCategory] = React.useState("");
  const [mode, setMode] = React.useState<"guided" | "autonomous">("autonomous");
  const [includeBackend, setIncludeBackend] = React.useState(false);
  const [projects, setProjects] = React.useState<SavedProject[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [attachedFileName, setAttachedFileName] = React.useState<string | null>(null);
  const [authUser, setAuthUser] = React.useState<{ uid: string; label: string; isAnon: boolean } | null>(null);

  // Load dynamic categories & starters from backend Studio config API
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { ok?: boolean; config?: StudioConfig } | null) => {
        if (cancelled || !payload?.ok || !payload.config) return;
        const loadedCats = payload.config.categories ?? [];
        setCategories(loadedCats);
        setStarters(payload.config.starters ?? []);
        if (loadedCats.length > 0) {
          setCategory((prev) => prev || loadedCats[0].id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Global Cmd+K / Ctrl+K shortcut for search
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Hydrate recent projects from localStorage and sync with Firestore when authenticated
  React.useEffect(() => {
    let localProjects: SavedProject[] = [];
    try {
      const raw = localStorage.getItem("studio_recent_projects");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localProjects = parsed.map((p) => ({ ...p, source: "local" as const }));
          setProjects(localProjects);
        }
      }
    } catch (e) {
      console.warn("Could not load recent projects:", e);
    }

    const auth = getFirebaseAuth();
    const db = getDb();
    if (!isFirebaseConfigured || !auth || !db) return;

    let unsubscribe: (() => void) | undefined;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setAuthUser(null);
          return;
        }
        setAuthUser({
          uid: user.uid,
          label: user.displayName || user.email || (user.isAnonymous ? "Guest Session" : "Signed In"),
          isAnon: user.isAnonymous,
        });
        try {
          const { collection, getDocs, query, where } = await import("firebase/firestore");
          const snap = await getDocs(
            query(collection(db, COLLECTIONS.projects), where("ownerId", "==", user.uid)),
          );
          const remote: SavedProject[] = snap.docs.map((d) => {
            const data = d.data() as ProjectDoc;
            return {
              id: data.id,
              name: data.name,
              prompt: data.description,
              category: "Workspace",
              mode: data.workflowMode,
              createdAt: data.updatedAt || data.createdAt,
              source: "firestore",
            };
          });
          const mergedMap = new Map<string, SavedProject>();
          for (const lp of localProjects) mergedMap.set(lp.id, lp);
          for (const rp of remote) {
            const existing = mergedMap.get(rp.id);
            mergedMap.set(rp.id, existing ? { ...existing, ...rp, category: existing.category } : rp);
          }
          setProjects(
            Array.from(mergedMap.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
        } catch (err) {
          console.warn("Firestore projects query skipped:", err);
        }
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.warn("Sign-in cancelled or unavailable:", err);
    }
  };

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  };

  const handleSelectCategory = (catObj: CategoryConfig) => {
    setCategory(catObj.id);
    if (!prompt.trim()) {
      setPrompt(catObj.placeholder.replace(/^e\.g\.\s*/, ""));
    }
    promptInputRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAttachSpecFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result.trim() : "";
      if (!text) return;
      setAttachedFileName(file.name);
      setPrompt((prev) => {
        const snippet = text.slice(0, 4000);
        return prev.trim()
          ? `${prev.trim()}\n\n[Attached spec: ${file.name}]\n${snippet}`
          : `[Spec: ${file.name}]\n${snippet}`;
      });
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleLaunchProject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isSubmitting) return;

    setIsSubmitting(true);
    const projectId = `proj_${Date.now()}`;

    const firstSentence = cleanPrompt.split(/[.!?\n]/)[0].trim();
    const derivedName =
      firstSentence.length > 40
        ? firstSentence.slice(0, 38).trim() + "..."
        : firstSentence || `${category || "Studio"} App`;

    const newProject: SavedProject = {
      id: projectId,
      name: derivedName,
      prompt: cleanPrompt,
      category,
      mode,
      includeBackend,
      createdAt: new Date().toISOString(),
      isFreshProject: true,
    };

    try {
      localStorage.setItem(`studio_project_${projectId}`, JSON.stringify(newProject));
      const updatedList = [newProject, ...projects.filter((p) => p.id !== projectId)].slice(0, 12);
      localStorage.setItem("studio_recent_projects", JSON.stringify(updatedList));
      setProjects(updatedList);
    } catch (err) {
      console.warn("Failed saving project locally:", err);
    }

    router.push(
      `/studio/${projectId}?prompt=${encodeURIComponent(cleanPrompt)}&mode=${mode}&category=${encodeURIComponent(category)}${includeBackend ? "&fullstack=1" : ""}`,
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
      const db = getDb();
      const auth = getFirebaseAuth();
      if (db && isFirebaseConfigured && auth?.currentUser) {
        import("firebase/firestore").then(({ deleteDoc, doc }) => {
          void deleteDoc(doc(db, COLLECTIONS.projects, id)).catch(() => {});
        });
      }
    } catch {}
  };

  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const filteredCategories = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.subtitle ?? "").toLowerCase().includes(q) ||
        c.placeholder.toLowerCase().includes(q),
    );
  }, [categories, searchQuery]);

  const userInitials = React.useMemo(() => {
    if (!authUser || authUser.isAnon) return "ST";
    const parts = authUser.label.trim().split(/[\s@.]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return authUser.label.slice(0, 2).toUpperCase();
  }, [authUser]);

  return (
    <div className="min-h-screen bg-canvas text-foreground flex flex-col">
      {/* Horizontal Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Left: Brand + Primary Nav Links */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-foreground">
                Studio
              </span>
            </Link>

            <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
              <a
                href="#build"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors"
              >
                Build
              </a>
              <a
                href="#projects"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              >
                Projects
              </a>
              <a
                href="#templates"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              >
                Templates
              </a>
              <a
                href="#agents"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              >
                Agents
              </a>
            </nav>
          </div>

          {/* Right: Search, Theme Toggle, Profile / Auth */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search projects and templates"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-mono text-[11px]">⌘K</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-surface"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {isFirebaseConfigured ? (
              authUser && !authUser.isAnon ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Account menu for ${authUser.label}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-canvas shadow-sm transition-opacity hover:opacity-90"
                      title={authUser.label}
                    >
                      {userInitials}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2.5 py-2 border-b border-border mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">{authUser.label}</p>
                      <p className="text-[11px] text-muted-foreground">Signed in</p>
                    </div>
                    <DropdownMenuItem onSelect={() => router.push("/studio/demo")}>
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>Open Demo Workspace</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleSignOut()}>
                      <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-semibold text-canvas shadow-sm transition-opacity hover:opacity-90"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </button>
              )
            ) : (
              <Link
                href="/studio/demo"
                aria-label="Open Studio workspace"
                title="Open Nimbus Demo Workspace"
                className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-3 text-xs font-semibold text-canvas shadow-sm transition-opacity hover:opacity-90"
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Workspace</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Two-Column Hero Section */}
        <section id="build" className="mx-auto max-w-7xl px-4 pt-10 pb-12 sm:px-6 lg:px-8 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-10">
            {/* Left Column: Editorial Headline + Prompt Composer + Suggestions */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-4">
                <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                  AI App Studio
                </span>

                <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                  Turn your ideas into{" "}
                  <span className="text-primary">working applications.</span>
                </h1>

                <p className="max-w-xl text-base text-muted-foreground leading-relaxed">
                  Plan, design, code and ship full-stack apps with a team of specialized AI agents.
                </p>
              </div>

              {/* Prompt Composer Card */}
              <form
                onSubmit={handleLaunchProject}
                className="rounded-2xl border border-border bg-card p-3 shadow-card transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20"
              >
                <label htmlFor="studio-prompt-input" className="sr-only">
                  Describe what you want to build
                </label>
                <textarea
                  id="studio-prompt-input"
                  ref={promptInputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleLaunchProject();
                    }
                  }}
                  placeholder={
                    categories.find((c) => c.id === category)?.placeholder ||
                    "Describe what you want to build..."
                  }
                  rows={3}
                  className="w-full resize-none bg-transparent px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
                />

                {attachedFileName && (
                  <div className="mx-2 mb-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
                    <Paperclip className="h-3 w-3 text-primary" />
                    <span>Attached: {attachedFileName}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2.5 px-1">
                  {/* Left composer utility actions */}
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.json"
                      onChange={handleAttachSpecFile}
                      className="sr-only"
                      aria-label="Attach specification file"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach spec or requirements file (.txt, .md, .json)"
                      aria-label="Attach specification file"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIncludeBackend((prev) => !prev)}
                      aria-pressed={includeBackend}
                      title="Include Next.js API routes and Firestore database layer"
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                        includeBackend
                          ? "bg-accent text-accent-foreground border border-primary/30"
                          : "text-muted-foreground hover:bg-surface hover:text-foreground",
                      )}
                    >
                      <Database className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">API + DB</span>
                    </button>

                    <Link
                      href="/studio/demo"
                      title="Open live Nimbus Demo workspace"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Demo</span>
                    </Link>
                  </div>

                  {/* Right mode selector + Generate CTA */}
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Select workflow mode"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          {mode === "autonomous" ? (
                            <Zap className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Compass className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="capitalize">{mode}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => setMode("autonomous")}>
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          <div className="flex-1">
                            <span className="block text-xs font-semibold">Autonomous</span>
                            <span className="block text-[11px] text-muted-foreground">
                              Auto-execute full build pipeline
                            </span>
                          </div>
                          {mode === "autonomous" && <Check className="h-3.5 w-3.5 text-primary" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setMode("guided")}>
                          <Compass className="h-3.5 w-3.5 text-primary" />
                          <div className="flex-1">
                            <span className="block text-xs font-semibold">Guided</span>
                            <span className="block text-[11px] text-muted-foreground">
                              Review PRD &amp; DAG approvals first
                            </span>
                          </div>
                          {mode === "guided" && <Check className="h-3.5 w-3.5 text-primary" />}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                      type="submit"
                      disabled={!prompt.trim() || isSubmitting}
                      aria-label={isSubmitting ? "Orchestrating application" : "Generate application"}
                      title="Generate Application (⌘+Enter)"
                      className={cn(
                        "inline-flex h-9 w-10 items-center justify-center rounded-lg transition-all shadow-sm",
                        !prompt.trim() || isSubmitting
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98]",
                      )}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>

              {/* Suggested Prompts Row */}
              {starters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Try an idea:</span>
                  {starters.map((starter, index) => {
                    const matchedCategory = categories.find((c) => c.id === starter.category);
                    const Icon = resolveConfigIcon(matchedCategory?.icon);
                    return (
                      <button
                        key={`${starter.category}-${index}`}
                        type="button"
                        onClick={() => {
                          setCategory(starter.category);
                          setPrompt(starter.prompt);
                          promptInputRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50"
                      >
                        <span className="text-primary">
                          <Icon className="h-3 w-3" />
                        </span>
                        <span>{starter.prompt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Live Interactive Product Interface Composition */}
            <div className="lg:col-span-6">
              <HeroPreviewComposition
                projectCount={projects.length + 1}
                templateCount={categories.length}
                selectedCategory={
                  categories.find((c) => c.id === category)?.label || category || "App"
                }
                mode={mode}
                includeBackend={includeBackend}
              />
            </div>
          </div>
        </section>

        {/* Visual Template Gallery */}
        <section id="templates" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Start from a template
            </h2>
            <a
              href="#projects"
              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span>View all workspaces</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {categories.map((cat) => (
              <TemplatePreviewCard
                key={cat.id}
                category={cat}
                selected={category === cat.id}
                onSelect={() => handleSelectCategory(cat)}
              />
            ))}
          </div>
        </section>

        {/* My Projects & Workspaces */}
        <section id="projects" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-3.5">
            <div className="flex items-center gap-2.5">
              <FolderKanban className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                My Projects &amp; Workspaces
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {projects.length + 1} workspace{projects.length !== 0 ? "s" : ""} available
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nimbus Interactive Demo Card */}
            <div className="group flex flex-col justify-between rounded-xl border border-primary/30 bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-elevated">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                    <Sparkles className="h-3 w-3" />
                    Interactive Demo
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">v1.0 Ready</span>
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  Nimbus SaaS Landing
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Pre-configured Next.js showcase app with modular components, live color token
                  switching, and AST visual element inspection.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-3.5">
                <span className="font-mono text-[11px] text-muted-foreground">Demo Workspace</span>
                <Link
                  href="/studio/demo"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
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
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary/40 hover:shadow-elevated"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {proj.category || "Application"}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(proj.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h3 className="line-clamp-1 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {proj.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {proj.prompt}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase text-primary">
                      {proj.mode}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Delete project"
                      aria-label={`Delete project ${proj.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Link
                    href={`/studio/${proj.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <span>Open</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Product Capabilities Strip */}
        <section id="agents" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 border-t border-border/70">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-panel/60 py-6 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">Studio</span>
            <span>— AI App Studio</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Next.js 14</span>
            <span>·</span>
            <span>Monaco &amp; Sandpack</span>
            <span>·</span>
            <span>Gemini + Groq</span>
          </div>
        </div>
      </footer>

      {/* Command Search Dialog (⌘K) */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg p-4">
          <DialogHeader className="mb-2">
            <DialogTitle>Search Studio</DialogTitle>
            <DialogDescription>
              Jump to a saved project, open the Nimbus demo, or pick a template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects or templates..."
              autoFocus
            />

            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              <div className="space-y-1">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Workspaces
                </p>
                <Link
                  href="/studio/demo"
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-surface transition-colors"
                >
                  <span className="font-semibold text-foreground">Nimbus SaaS Landing (Demo)</span>
                  <span className="font-mono text-[11px] text-primary">/studio/demo</span>
                </Link>
                {filteredProjects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/studio/${proj.id}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-surface transition-colors"
                  >
                    <span className="truncate font-medium text-foreground">{proj.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground uppercase">
                      {proj.mode}
                    </span>
                  </Link>
                ))}
              </div>

              {filteredCategories.length > 0 && (
                <div className="space-y-1">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Templates
                  </p>
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        handleSelectCategory(cat);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-surface transition-colors"
                    >
                      <span className="font-medium text-foreground">{cat.label}</span>
                      <span className="ml-2 truncate text-[11px] text-muted-foreground">
                        {cat.subtitle || cat.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
