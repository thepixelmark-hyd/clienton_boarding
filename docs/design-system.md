# ClientOS — Design System

## Principles

Neutral-first, restrained, information-dense for professional daily use.
Inspiration is the *restraint and hierarchy* of Linear/Stripe/Notion/Apple —
not their visual style copied literally. No gradients, no glassmorphism, no
decorative shadows, no "AI sparkle" iconography, no illustrations that don't
carry information. Every visual element has a job.

## Typography

Inter only, loaded once (`next/font`), variable font. Scale (rem, 16px base):

| Token | Size | Line height | Use |
|---|---|---|---|
| `text-xs` | 0.75 | 1rem | metadata, timestamps |
| `text-sm` | 0.8125 | 1.25rem | body default, table cells |
| `text-base` | 0.9375 | 1.5rem | primary reading text |
| `text-lg` | 1.125 | 1.75rem | section headers |
| `text-xl` | 1.375 | 1.75rem | page titles |
| `text-2xl` | 1.75 | 2.25rem | rare — dashboard hero numbers only |

Body text defaults intentionally smaller than typical marketing-site scales
(§5: avoid oversized typography) because this is a dense professional tool,
not a landing page.

## Color tokens

Defined as CSS variables in `apps/web/src/styles/tokens.css`, consumed via
Tailwind's `theme.extend.colors` pointing at `var(--token-name)` so
light/dark is a single attribute flip (`data-theme`), not two parallel
palettes to keep in sync by hand.

```
--background, --surface, --surface-secondary, --border, --border-strong,
--text-primary, --text-secondary, --text-muted,
--accent, --accent-foreground,
--success, --warning, --danger, --info
```

Light mode: warm-neutral background (`#FAFAF9`-family), not pure white —
reduces the "template SaaS" flatness. Dark mode is authored separately
(desaturated surfaces, not `#000`/inverted-light), per §6.

Accent is a single restrained color used for primary actions and active
states only — never for decoration, never for random card borders.

## Component inventory (this phase)

Built in `apps/web/src/components/ui/`: `Button`, `IconButton`, `Input`,
`Textarea`, `Select`, `Checkbox`, `Switch`, `Badge`/`StatusBadge`, `Avatar`,
`Card`, `Table`, `Tabs`, `Dialog` (modal), `Drawer`, `Toast`/`Toaster`,
`EmptyState`, `Skeleton`, `ConfirmDialog`, `Tooltip`, `DropdownMenu`.

Each supports: keyboard navigation, visible focus ring, `disabled`/`loading`
states, dark mode via tokens (no component hardcodes a color), and is built
on Radix UI primitives for accessibility (focus trapping, ARIA roles) rather
than reimplementing that behavior.

Remaining components in the original inventory (DatePicker, Kanban,
Gantt/Timeline, RichTextEditor, FormBuilder, FilePreview/PDFViewer/
VideoPlayer, AnnotationLayer, CommandMenu) are built incrementally as the
screens that need them ship — a `Kanban`-shaped component exists because the
Projects board view uses it; a full `AnnotationLayer` doesn't exist yet
because creative proofing (Phase 4) isn't built yet. This is the "no
partial implementation" rule applied to the design system itself: no
component ships as a shell that doesn't work.

## Empty / loading / error states

- **Empty**: every list view has a bespoke empty state — a one-line
  explanation of what will appear there, and the primary action to populate
  it. No stock illustrations.
- **Loading**: skeletons matching the eventual content's shape, not a
  full-page spinner, for anything below page-navigation granularity.
- **Error**: `ErrorState` component pattern — what happened, in plain
  language, plus a retry action. Raw error messages/stack traces are never
  shown to end users (see `security.md`, `apps/api` global exception
  filter).
