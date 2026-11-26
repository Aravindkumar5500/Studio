import type { ComponentType } from "react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  FolderKanban,
  Globe,
  LayoutDashboard,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

export interface CategoryConfig {
  id: string;
  label: string;
  subtitle?: string;
  previewVariant?: "landing" | "crm" | "ecommerce" | "booking" | "dataviz" | "business";
  accentTone?: string;
  icon: string;
  placeholder: string;
}

export interface StarterConfig {
  category: string;
  prompt: string;
}

export interface PresetThemeConfig {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  isLight?: boolean;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  previewGradient: string;
}

export interface ColorTokenConfig {
  name: string;
  className: string;
  swatch: string;
}

export interface StageBackgroundConfig {
  id: string;
  label: string;
  name: string;
}

export interface StudioConfig {
  categories: CategoryConfig[];
  starters: StarterConfig[];
  themes: PresetThemeConfig[];
  inspector: {
    spacingSteps: string[];
    fontSizes: { label: string; value: string }[];
    fontWeights: { label: string; value: string }[];
    breakpoints: { id: string; label: string; sub: string }[];
    baseColorTokens: ColorTokenConfig[];
  };
  stageBackgrounds: StageBackgroundConfig[];
  defaultChatPrompts: string[];
  sandboxDependencies: Record<string, string>;
}

const ICON_COMPONENTS: Record<string, ComponentType<{ className?: string }>> = {
  globe: Globe,
  "layout-dashboard": LayoutDashboard,
  briefcase: Briefcase,
  "shopping-cart": ShoppingCart,
  calendar: Calendar,
  "bar-chart": BarChart3,
  folder: FolderKanban,
};

export function resolveConfigIcon(name?: string): ComponentType<{ className?: string }> {
  if (!name) return Sparkles;
  return ICON_COMPONENTS[name.toLowerCase()] ?? Sparkles;
}

export function extractDependenciesFromFiles(
  files: Record<string, string>,
  fallbackDeps: Record<string, string> = {},
): Record<string, string> {
  const pkgRaw = files["package.json"];
  if (!pkgRaw) return fallbackDeps;
  try {
    const parsed = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> };
    return { ...fallbackDeps, ...(parsed.dependencies ?? {}) };
  } catch {
    return fallbackDeps;
  }
}
