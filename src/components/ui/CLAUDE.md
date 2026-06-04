# Internal Design System (`src/components/ui/`)

Single source of truth for shared UI. Import from the barrel:

```tsx
import { Button, IconButton, Input, Textarea, Select, Label, Card, Callout, Modal, EditableField } from '../components/ui';
```

Every component ships light + dark styling and a focus ring. Prefer these over inline Tailwind. Need a new
look? Extend the component's variant map here — don't fork styles in feature code.

## Components

- **`Button`** — `variant`: `primary` (default) · `secondary` · `danger` · `success` · `ghost` · `soft`
  (soft = the light-blue "Edit" style). `size`: `sm` · `md` (default) · `lg`. Props: `leftIcon`/`rightIcon`
  (pass a lucide element), `loading` (spinner + disabled), `fullWidth`. Renders `<button type="button">` by default.
- **`IconButton`** — square icon-only button. Requires `label` (used for `aria-label` + `title`).
  `variant`: `ghost` (default) · `danger` · `success` · `primary`. `size`: `sm` · `md`. Use for close (X),
  inline edit (pencil), delete (trash). Pass the icon as the child.
- **`Input` / `Textarea` / `Select`** — standardized form controls; spread native props. `mono` for
  monospace (Input, Textarea). `Textarea` defaults to `rows={4}` and `resize-vertical`. They share `FIELD_BASE`.
- **`Label`** — `<label>` with the standard style; `required` adds a red asterisk.
- **`Card`** — bordered surface. `padding`: `none|sm|md|lg` (default `md`). Optional `title`, `description`,
  `actions` render a header row. Use for config sections and list items.
- **`Callout`** — info/warning/success/danger box. `variant`: `info` (default) · `warning` · `success`
  · `danger`. Optional `icon`.
- **`Modal`** — overlay shell. `isOpen`, `onClose`, `title`, optional `headerActions`, `footer`,
  `size` (`sm|md|lg|xl|full`). Closes on Escape and backdrop click (disable via `closeOnOverlayClick={false}`).
  Renders header (title + close), scrollable body (`children`), optional right-aligned footer.
- **`EditableField`** — the platform editing pattern (**Edit-toggle with preview**). You own the value;
  it owns draft/editing/saving state.
  ```tsx
  <EditableField
    label="Summary Prompt"
    description="Used to generate summaries"
    value={config.summaryPrompt}
    onSave={(v) => service.setSummaryPrompt(v)}   // may be async; commits only on Save
    mono rows={12}
    placeholder="Use {CONTENT} as a placeholder"
    tip={<>Use <code>{'{CONTENT}'}</code> where the content goes.</>}
  />
  ```
  `singleLine` swaps the textarea for an input. `emptyText` shows when the value is empty.

## Rules

- Editing text/prompts is **always** `EditableField`. No new "always-editable" textareas or bespoke toggles.
- Don't reintroduce raw `<button>`/inputs/modal scaffolding in feature components.
- Keep dark mode working: extend variants here rather than adding `dark:` ad hoc downstream.
