# Gmail Reader — Project Guide

Frontend-only React app that reads Gmail, summarizes emails/links with AI (Ollama local or Gemini),
and manages rules, flash cards and newsletter ratings. All state lives in the browser; there is no
backend of our own. Versions live in `package.json` — don't hardcode them in docs.

## Stack & tooling

- React + TypeScript + Vite, styled with Tailwind (`darkMode: 'class'`, toggled on `<html>` by `themeService`).
- Icons: `lucide-react`. Markdown: `react-markdown` + `rehype-*`.
- Commands: `npm run dev`, `npm run build` (runs `tsc -b` then `vite build`), `npm run lint`.
- **Always run `npx tsc -b` after changes** — it's the cheapest correctness gate and the build depends on it.

## Architecture

- `src/components/` — UI. `*ConfigPanel.tsx` are settings panels (mostly mounted inside `ConfigurationModal`);
  `*Modal.tsx` are full overlays. `Dashboard.tsx` and `EmailModal.tsx` are the big screens.
- `src/components/ui/` — **the internal design system**. See its own `CLAUDE.md`. Use it (details below).
- `src/services/` — singletons exported as instances (e.g. `export const ollamaService = new ...`).
  They own persistence (localStorage / IndexedDB) and external calls. Components read/write through them,
  never touch storage directly.
- `src/types/` — shared types. `src/utils/` — pure helpers.

## UI conventions — use the design system

Historically every component wrote its own inline Tailwind, which drifted (button padding, radius, focus
rings, dark-mode coverage, three different "edit" patterns). The fix is `src/components/ui/`. **Default to it.**

- **Don't** hand-roll `<button className="bg-blue-600 ...">`, raw `<input>`/`<textarea>`/`<select>`,
  modal scaffolding, or info/warning boxes. Use `Button`, `IconButton`, `Input`, `Textarea`, `Select`,
  `Label`, `Card`, `Callout`, `Modal`.
- **Editing text/prompts → `EditableField`.** The platform-wide pattern is **Edit-toggle with preview**:
  read-only preview → "Edit" → editor → Save / Cancel. Do not add "always-editable" textareas or bespoke
  edit toggles. `EditableField` owns its own draft/editing/saving state; you pass `value` + `onSave`.
- Import from the barrel: `import { Button, Modal, EditableField } from '../components/ui';`
- Every primitive already ships light + dark styling and a focus ring. New UI must work in dark mode — if you
  must write raw Tailwind, always pair a light class with its `dark:` variant.
- Need a variant that doesn't exist? Add it to the `ui/` component (extend the variant map), don't fork
  styles inline. Keep the design system the single source of truth.

## Code standards

- Match surrounding code; services are singletons, components are function components.
- Make only the change requested or clearly necessary — no speculative abstractions or unrequested refactors.
- Never commit or push unless explicitly asked.
