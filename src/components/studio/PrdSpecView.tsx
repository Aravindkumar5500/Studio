"use client";

import * as React from "react";
import { CheckCircle2, CircleDashed, Database, Layers, Users } from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<string, string> = {
  P0: "border-destructive/30 bg-destructive/10 text-destructive",
  P1: "border-warning/30 bg-warning/10 text-warning",
  P2: "border-border bg-surface text-muted-foreground",
};

export function PrdSpecView() {
  const studio = useStudio();
  const prd = studio.requirements;

  if (!prd) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center bg-canvas">
        <p className="text-sm font-semibold text-foreground">No PRD yet.</p>
        <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
          Switch the Copilot panel to <span className="font-semibold text-foreground">Plan &amp; Build</span> and
          describe your product — the Product Agent writes the PRD here before any code is generated.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-8 sm:px-8 bg-canvas">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 border-b border-border pb-6">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              Product Requirements
            </p>
            <span className="studio-pill border-border bg-surface text-[10px] text-muted-foreground">
              {prd.category === "fullstack_app" ? "Full-stack app" : "Website"}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">{prd.productName}</h1>
          <p className="text-sm text-muted-foreground">{prd.oneLiner}</p>
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{prd.valueProposition}</p>
        </header>

        <Section title="Problem">
          <p className="text-sm leading-relaxed text-foreground">{prd.problemStatement}</p>
        </Section>

        <Section title="Personas" icon={Users}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prd.personas.map((persona) => (
              <article
                key={persona.name}
                className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
              >
                <h3 className="text-xs font-semibold text-foreground">{persona.name}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {persona.description}
                </p>
                {persona.goals.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {persona.goals.map((goal) => (
                      <li key={goal} className="text-[11px] text-muted-foreground">
                        — {goal}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </Section>

        <Section title="Features">
          <div className="space-y-3">
            {prd.features.map((feature) => (
              <article
                key={feature.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                  <span
                    className={cn(
                      "studio-pill text-[10px] uppercase",
                      PRIORITY_STYLE[feature.priority],
                    )}
                  >
                    {feature.priority}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {feature.acceptanceCriteria.map((criterion) => (
                    <li key={criterion} className="flex items-start gap-2 text-xs text-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      {criterion}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Route map" icon={Layers}>
          <div className="space-y-3">
            {prd.pages.map((page) => (
              <article
                key={page.route}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary">{page.route}</span>
                  <span className="text-xs font-semibold text-foreground">{page.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{page.purpose}</p>
                <div className="mt-3 space-y-2 border-l border-border pl-3">
                  {page.sections.map((section) => (
                    <div key={section.id}>
                      <p className="text-[11px] font-medium text-foreground">{section.name}</p>
                      <p className="text-[11px] text-muted-foreground">{section.purpose}</p>
                      {section.interactions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {section.interactions.map((interaction) => (
                            <span
                              key={interaction}
                              className="studio-pill border-border bg-surface text-[9px] text-muted-foreground"
                            >
                              {interaction}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>

        {prd.dataEntities.length > 0 && (
          <Section
            title="Data entities"
            icon={Database}
            action={
              <button
                type="button"
                disabled={studio.busy}
                onClick={() => void studio.generateDatabaseLayer()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-accent px-2.5 py-1 text-[10px] font-semibold text-accent-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors"
              >
                <Database className="h-3 w-3" />
                <span>{studio.busy ? "Generating..." : "Generate DB Layer & Rules"}</span>
              </button>
            }
          >
            <div className="space-y-3">
              {prd.dataEntities.map((entity) => (
                <article
                  key={entity.name}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-xs font-semibold text-foreground">
                      {entity.name}
                    </h3>
                    {entity.persisted && (
                      <span className="studio-pill border-border bg-surface text-[9px] text-muted-foreground">
                        persisted
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{entity.description}</p>
                  <ul className="mt-2 space-y-0.5">
                    {entity.fields.map((field) => (
                      <li key={field.name} className="font-mono text-[11px] text-muted-foreground">
                        {field.name}
                        {field.required ? "" : "?"}:{" "}
                        <span className="text-primary">{field.type}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Section>
        )}

        {prd.userStories.length > 0 && (
          <Section title="User stories">
            <div className="space-y-2">
              {prd.userStories.map((story) => (
                <p key={story.id} className="text-xs leading-relaxed text-foreground">
                  <span className="text-muted-foreground">As a</span> {story.asA}{" "}
                  <span className="text-muted-foreground">I want</span> {story.iWant}{" "}
                  <span className="text-muted-foreground">so that</span> {story.soThat}.
                </p>
              ))}
            </div>
          </Section>
        )}

        {prd.nonFunctional.length > 0 && (
          <Section title="Non-functional requirements">
            <ul className="space-y-1.5">
              {prd.nonFunctional.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-foreground">
                  <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {prd.outOfScope.length > 0 && (
          <Section title="Out of scope">
            <ul className="space-y-1.5">
              {prd.outOfScope.map((item) => (
                <li key={item} className="text-xs text-muted-foreground">
                  — {item}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
