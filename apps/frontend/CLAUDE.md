# Fuse frontend: design guide

Next.js 16 (App Router) + Tailwind v4 + shadcn-style components. The look is a dark infra console in the style of E2B and Daytona: black background, hairline borders, monospace controls, square corners, and one ember accent. Keep every change inside this system.

## Tokens (`app/globals.css`)

Dark only. `ThemeProvider` forces `dark` and `<html>` has `class="dark"`; there is no light theme.

| Token | Value | Use |
|---|---|---|
| `bg-background` | `#0a0a0a` | page |
| `bg-card` | `#0e0e0e` | raised panels, dialogs |
| `bg-panel` | `#121212` | selected rows, side panels |
| `bg-muted` | `#171717` | skeletons, empty meter segments, active tab |
| `border` / `border-border-strong` | `#222` / `#333` | hairlines / outlined controls and code windows |
| `text-foreground` | `#ededed` | primary text |
| `text-muted-foreground` | `#8f8f8f` | body copy |
| `text-dim` | `#5e5e5e` | secondary lines, brackets, metadata |
| `bg-ember` / `text-ember` / `bg-primary` | `#ff6b1a` | the only accent: primary button, `$` prompts, active markers |
| `text-ok` `text-idle` `text-busy` `text-bad` | green / blue / amber / red | VM status only |

The radius tokens are 2–4px; treat everything as square. Don't add `rounded-*` beyond `rounded-full` on tiny dots.

## Type

- Inter (`font-sans`) for headings and body; JetBrains Mono (`font-mono`) for labels, buttons, nav, IDs, IPs and code.
- Headings: `font-medium` with tight tracking (`tracking-[-0.03em]` to `-0.035em`), always two-tone: first line in `text-foreground`, second line in `<span className="text-dim">`. See `SectionHead` in `app/page.tsx`.
- Labels: the `label-mono` utility (mono, 0.72rem, uppercase, muted). Section markers use `<Bracket>` from `components/brand.tsx`, which renders `[ LABEL ]`; pass `tone="ember"` for the hero.

## Utilities (defined in `globals.css`)

- `frame`: centred 1200px column with left and right hairline rails. Every section is `<section className="border-b"><div className="frame">…</div></section>`.
- `dot-grid`: faint dot-matrix background. Put it on an absolutely positioned layer with a `mask-image` radial gradient (see the hero and CTA).
- `label-mono`: small mono caps label.
- `.term-line`, `.caret`, `.status-pulse`: terminal and status motion. All are disabled under `prefers-reduced-motion`.

## Layout rules

- Grids of cells share borders instead of gaps: wrap them in `grid gap-px bg-border` and give each cell `bg-background` (see the Platform grid), or use `divide-x` / `divide-y` / `border-l`.
- Don't use floating rounded cards with shadows. The only shadow is the ember glow under the hero terminal.
- Code windows: a `bg-[#0c0c0c]` or `bg-card` body, plus a `h-10 border-b` title bar holding a mono filename and a COPY button on the right.
- Horizontal padding is `px-5 sm:px-8` everywhere so edges line up with the rails.

## Components

| File | What it is |
|---|---|
| `components/ui/button.tsx` | Square mono uppercase buttons. Variants: `default` (ember), `light` (white, for Sign in / Dashboard), `outline`, `ghost`, `secondary`, `destructive`, `link`. Sizes: `sm` `default` `lg` `icon`. |
| `components/ui/dialog.tsx` | Radix dialog, square, `border-border-strong`. |
| `components/brand.tsx` | `FuseMark` (ember tile logo), `Wordmark`, `Bracket`. |
| `components/site-header.tsx` | Sticky header with mono nav links (server component; uses `auth()`). |
| `components/hero-terminal.tsx` | Client component: the hero terminal. It auto-plays the scenes in `SCENES` (Create / Exec / Expose / Pause) line by line and stops auto-play once someone clicks a tab. The responses match the backend's real JSON. Keep lines under ~52 chars so they don't clip. |
| `components/api-explorer.tsx` | Client component: Daytona-style feature list on the left and a request/response code window on the right. Edit the `ITEMS` array. |
| `app/page.tsx` | Landing page: hero, spec strip, Platform grid (`Cell` plus small `*Viz` diagrams), API explorer, Internals (create sequence and teardown), CTA, footer. |
| `app/dashboard/page.tsx` | Client console: title row, stats strip (slots meter, running, live vCPU/RAM, API key), sandbox table (`VmRow`, `StatusTag`), quickstart snippet, dialogs. Polls every 2.5s while any VM is transitional. |
| `app/sign-in/page.tsx` | Split screen: Google sign-in on the left, `HeroTerminal` on the right. |

`components/boot-trace.tsx` and `components/themes/theme-toggle.tsx` are leftovers from an earlier design. Nothing imports them and they can be deleted.

## Data

- Dashboard data comes from the server actions in `actions/`: `getUserInfo` returns `{ user, vms, limits }`, and VM actions call the backend server-to-server.
- Public limits (slots, auto-pause minutes) come from `lib/limits.ts` (`getLimits`, `describeLimits`).
- Copy and diagrams must match what the backend really does (see the root `README.md`). Don't invent metrics, customers or benchmark numbers.

## Writing

- Sentence case for headings and body; uppercase only through `label-mono` and buttons.
- Buttons name the action ("New sandbox", "Rotate key", "Delete sandbox"), and the same word is used throughout the flow.
- Errors say what failed and what to do next.

## Checks before you finish

```bash
cd apps/frontend
npx tsc --noEmit -p .
npx eslint app components lib actions
pnpm dev   # look at /, /sign-in and /dashboard at desktop and ~390px width
```
