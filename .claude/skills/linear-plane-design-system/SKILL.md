---
name: linear-plane-design-system
description: UI/UX design rules for TrackFlow's Next.js frontend (apps/web) — the PRD's target quality bar is "setara Linear/Plane" using Shadcn UI. Load this before building, reviewing, or giving feedback on any screen/component in apps/web.
---

# Linear/Plane-grade Design System — TrackFlow Web

## Source of truth

- `PRD_Lean_Internal.md` §3 Tujuan Produk, poin 5: **"Pengalaman UI/UX modern setara Linear/Plane."**
- `SDD_Lean_Internal.md` §5 Arsitektur Frontend Web: Next.js App Router, **Shadcn UI + TanStack Table**, Socket.io + TanStack Query for realtime cache invalidation, issue views (List/Kanban/Calendar) from one endpoint.
- `apps/web/components.json` is already configured (`style: base-nova`, `baseColor: neutral`, `iconLibrary: lucide`, `cssVariables: true`). Don't fork a second design system or change these without a stated reason — everything below builds on top of this config, it doesn't replace it.

This rule is easy to forget because it's a one-line aspiration in the PRD, not a component spec. Treat every item below as the concrete, checkable version of that one line.

## Visual language

- **Density over whitespace.** Default to compact rows/tables, not marketing-page spacious cards. Linear and Plane pack a lot of information per screen — TrackFlow's issue lists, time book, and reports should too.
- **Neutral + one accent.** Base palette stays monochrome/neutral (per `components.json`). Reserve color for one primary accent (primary actions, active nav item) and muted status colors (priority/status pills) — never bright saturated "candy" colors.
- **Typography hierarchy, not size.** Small body text (13–14px) for dense data, medium weight (not large size) to distinguish headers. Avoid oversized display headings on app screens (that's marketing-site language, not product-app language).
- **Subtle depth.** Thin 1px borders/dividers over heavy drop shadows or gradients. Motion is fast and small (150–200ms transitions) — no flourish animations.
- **Dark mode is first-class.** `cssVariables: true` is already on — every new component must be checked in both themes, not just light.

## Navigation & interaction patterns

- **Persistent collapsible sidebar**: project switcher + sections (Issues, Time Book, Reports, Settings), not a top navbar mega-menu.
- **Inline editing over page navigation.** Status/assignee/priority change via inline dropdown/popover on the row, not a full edit page. Pair with optimistic updates through TanStack Query so the UI reacts before the server confirms.
- **Hover-reveal row actions** on lists/tables instead of always-visible action columns.
- **Command palette (Cmd/Ctrl+K)** for quick navigation/actions is the kind of affordance that reads as "Linear-grade" — worth it if it doesn't add real backend complexity (this is a Lean Internal product, don't over-build it).

## Module-specific guidance

- **Issues (FR-025):** List is the default and densest view (Linear-style rows: key, title, status pill, assignee avatar, priority icon, due date — all inline-editable). Kanban mirrors Plane's board (compact cards, drag-drop, subtle card shadows). Calendar is the lightest-weight view. All three read from the same issues endpoint — don't fork data-fetching per view.
- **Data tables:** Always TanStack Table + Shadcn table primitives (per SDD §5). Never hand-roll a raw `<table>` in feature code.
- **Workflow/status settings (FR-022, FR-023):** drag-drop reorder list, inline rename, per-status "restricted to role" toggle — an admin settings screen, so density and clarity beat decoration here too.
- **Time Book (FR-050–052):** screenshot gallery + activity graph is closer to a media/analytics view — still keep it dense (grid of thumbnails, not one-per-row), muted activity-level colors (Tinggi/Sedang/Rendah/Tidak Ada), no oversized hero imagery.
- **Loading & empty states:** every list/table needs a skeleton loading state (not a bare spinner) and a consistent, low-key empty state — not an illustration-heavy placeholder.

## Guardrails — don't do this

- Don't introduce a second component library (no MUI/Ant/Bootstrap) alongside Shadcn.
- Don't use icons outside `lucide-react` — it's already the configured `iconLibrary`.
- Don't build spacious "SaaS marketing" layouts (big padding, hero sections, oversized headings) for internal product screens.
- Don't skip dark-mode verification on new components.
- Don't change `components.json` (style/baseColor/aliases) without flagging it — it's the shared contract all Shadcn components are generated against.

## Dark Mode
- SELALU pakai token warna semantik (`bg-background`, `text-foreground`, `border-border`, dst), TIDAK PERNAH hardcode hex atau warna Tailwind mentah (`bg-blue-500`) tanpa varian `dark:`.
- Komponen baru wajib diuji visual di kedua mode sebelum dianggap selesai.