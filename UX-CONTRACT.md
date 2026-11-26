# UX Contract

## Product surface
Studio has two connected registers: the dashboard is an editorial entry point for starting and resuming work; the project workspace is a dense developer-native tool. Both share semantic theme tokens, typography, action vocabulary, focus treatment, and status semantics.

## Dashboard flow
- Create project: prompt + category + workflow mode -> persist local project metadata -> navigate to /studio/:projectId with prompt/mode/category query parameters.
- Resume project: project library card -> /studio/:projectId.
- Demo: sample workspace -> /studio/demo.
- Delete saved project: remove metadata and list entry; keep action local and scoped to selected project.

## Workspace flow
- Preserve generation, task approval, live preview, code editor, file explorer, AI chat, DAG/PRD, checkpoint, export, and deploy flows.
- Theme changes are presentation-only and must not mutate project files or generated preview content.
- Active view and task state remain owned by the Studio store.
- Error banners remain dismissible and retain their current recovery semantics.

## Theme behavior
- Support light and dark themes through the root light/dark class.
- Persist preference in localStorage under studio_theme.
- Default to light for first-time visitors; apply stored preference before rendering.
- Theme switching must not reload the page or alter workspace state.

## Accessibility and responsive behavior
- Use native buttons and links for actions and navigation.
- Icon-only actions require accessible names.
- Category and workflow choices expose aria-pressed.
- Keep keyboard focus visible and respect reduced-motion preferences.
- Dashboard columns collapse on narrow viewports; project library remains readable on mobile.
