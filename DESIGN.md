---
version: alpha
colors:
  background: "#F5F3EE"
  foreground: "#252927"
  primary: "#B95535"
  surface: "#FFFFFF"
  surface-muted: "#EEECE6"
  border: "#DCD9D1"
  dark-background: "#151918"
  dark-surface: "#1D2020"
  dark-foreground: "#F0EEE8"
typography:
  sans:
    fontFamily: "'DM Sans', system-ui, sans-serif"
  display:
    fontFamily: "'Space Grotesk', 'DM Sans', sans-serif"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
rounded:
  sm: "6px"
  md: "9px"
  lg: "12px"
spacing:
  unit: "4px"
components:
  primary-action:
    background: "#B95535"
    foreground: "#FFFFFF"
    radius: "9px"
  surface:
    background: "#FFFFFF"
    border: "1px solid rgba(35,38,36,.12)"
    radius: "12px"
---
# Overview
Studio is a working environment for people building real software. The interface should feel like a well-made creative tool: composed, legible, quiet, and technically capable. The visual identity combines editorial restraint with the precision of a developer workbench.

The signature is a restrained oxide/rust action color against warm mineral neutrals. It is used for meaningful actions and selected states, never as ambient decoration. Product surfaces prioritize task clarity and information hierarchy over brand theatrics.

## Colors
Light mode uses warm paper, graphite text, mineral dividers, and oxide for primary actions. Dark mode is charcoal with warm off-white text and a brighter oxide accent. Semantic success, warning, and error colors remain independent of the brand accent.

Avoid blue-purple gradients, glowing orbs, decorative grid backgrounds, excessive glass effects, and repeated oversized rounded cards.

## Typography
Space Grotesk is reserved for headings and short editorial statements. DM Sans carries interface copy and controls. IBM Plex Mono is used for file paths, technical metadata, and compact labels.

## Layout
The dashboard uses a wide editorial work area: project creation on the left, a compact workflow explanation on the right, and a project library below. The workspace remains tool-first and dense, with persistent navigation and clearly separated panels. Use an 8px base rhythm with 4px optical adjustments.

## Elevation & Depth
Prefer borders and surface contrast over shadows. Elevation is reserved for active overlays and the main creation surface.

## Shapes
Use 6–12px radii for functional surfaces. Avoid pill-shaped cards and controls except compact status indicators.

## Components
Primary actions use oxide with white text. Secondary actions use transparent surfaces with a visible border. Selected category controls use a tinted oxide background and border. Every interactive element has hover, focus-visible, active, and disabled states.

## Do's and Don'ts
- Keep navigation, editor, preview, and inspector visually related.
- Use real project names, concise descriptions, and honest state labels.
- Preserve generated source code as a first-class product artifact.
- Never make the product look like an AI demo landing page.
- Don't use gradients, blur, or animation as the main source of visual interest.
