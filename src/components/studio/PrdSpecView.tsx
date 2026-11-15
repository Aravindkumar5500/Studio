"use client";

import * as React from "react";
import { CheckCircle2, CircleDashed, Database, Layers, Users } from "lucide-react";
import { useStudio } from "@/store/studio-store";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<string, string> = {
  P0: "border-red-800/60 bg-red-500/10 text-red-300",
  P1: "border-amber-800/60 bg-amber-500/10 text-amber-300",
  P2: "border-slate-700 bg-slate-800/60 text-slate-300",
};

export function PrdSpecView() {
  const studio = useStudio();
  const prd = studio.requirements;

  if (!prd) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-slate-400">No PRD yet.</p>
        <p className="max-w-sm text-xs text-slate-500">
          Switch the chat panel to <span className="text-slate-300">Plan Build</span> and describe
          your product — the Product Agent writes the PRD here before any code is generated.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-wide text-indigo-400">
              Product Requirements
            </p>
            <span className="studio-pill border-slate-800 bg-slate-900 text-[10px] text-slate-400">
              {prd.category === "fullstack_app" ? "Full-stack app" : "Website"}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">{prd.productName}</h1>
          <p className="text-sm text-slate-400">{prd.oneLiner}</p>
          <p className="pt-1 text-xs leading-relaxed text-slate-500">{prd.valueProposition}</p>
        </header>

        <Section title="Problem">
          <p className="text-sm leading-relaxed text-slate-300">{prd.problemStatement}</p>
        </Section>

        <Section title="Personas" icon={Users}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prd.personas.map((persona) => (
              <article
                key={persona.name}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
              >
                <h3 className="text-xs font-semibold text-slate-100">{persona.name}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {persona.description}
                </p>
                {persona.goals.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {persona.goals.map((goal) => (
                      <li key={goal} className="text-[11px] text-slate-500">
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
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">{feature.title}</h3>
                  <span
                    className={cn(
                      "studio-pill text-[10px] uppercase",
                      PRIORITY_STYLE[feature.priority],
                    )}
                  >
                    {feature.priority}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {feature.description}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {feature.acceptanceCriteria.map((criterion) => (
                    <li key={criterion} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
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
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-300">{page.route}</span>
                  <span className="text-xs font-semibold text-slate-100">{page.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{page.purpose}</p>
                <div className="mt-3 space-y-2 border-l border-slate-800 pl-3">
                  {page.sections.map((section) => (
                    <div key={section.id}>
                      <p className="text-[11px] font-medium text-slate-200">{section.name}</p>
                      <p className="text-[11px] text-slate-500">{section.purpose}</p>
                      {section.interactions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {section.interactions.map((interaction) => (
                            <span
                              key={interaction}
                              className="studio-pill border-slate-800 bg-slate-950 text-[9px] text-slate-400"
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
          <Section title="Data entities" icon={Database}>
            <div className="space-y-3">
              {prd.dataEntities.map((entity) => (
                <article
                  key={entity.name}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-xs text-slate-100">{entity.name}</h3>
                    {entity.persisted && (
                      <span className="studio-pill border-slate-800 bg-slate-950 text-[9px] text-slate-400">
                        persisted
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{entity.description}</p>
                  <ul className="mt-2 space-y-0.5">
                    {entity.fields.map((field) => (
                      <li key={field.name} className="font-mono text-[11px] text-slate-400">
                        {field.name}
                        {field.required ? "" : "?"}:{" "}
                        <span className="text-indigo-300">{field.type}</span>
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
                <p key={story.id} className="text-xs leading-relaxed text-slate-300">
                  <span className="text-slate-500">As a</span> {story.asA}{" "}
                  <span className="text-slate-500">I want</span> {story.iWant}{" "}
                  <span className="text-slate-500">so that</span> {story.soThat}.
                </p>
              ))}
            </div>
          </Section>
        )}

        {prd.nonFunctional.length > 0 && (
          <Section title="Non-functional requirements">
            <ul className="space-y-1.5">
              {prd.nonFunctional.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-300">
                  <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
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
                <li key={item} className="text-xs text-slate-500">
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
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h2>
      {children}
    </section>
  );
}
