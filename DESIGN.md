# Design System — Image Mule

## Product Context
- **What this is:** Electron desktop utility that hauls screenshots from your laptop to a remote server via SFTP. Paste, transmit, get the path on your clipboard.
- **Who it's for:** Developers working with remote Claude Code sessions (or any remote tool) who need to share visual context from their local machine.
- **Space/industry:** Developer utilities. Peers: Raycast (launcher), CleanShot X (screenshots), Warp (terminal), Linear (project management).
- **Project type:** Desktop utility app (Electron, single-window, 520x680)

## Aesthetic Direction
- **Direction:** Industrial Utilitarian — "midnight workbench"
- **Decoration level:** Minimal — typography and spacing do all the work. No ornament.
- **Mood:** A compact tool on a desk. Precise, fast, slightly industrial. Not soft, not futuristic, not corporate. The UI of something that moves cargo.
- **Reference sites:** Raycast (clean dark UI, tight spacing), Linear (near-black, professional density), Warp (deep dark, warm accents), CleanShot X (friendly, blue accent — what we're deliberately NOT doing)

## Typography
- **Display/Hero:** Space Grotesk 700 — structured, geometric, not sterile. Has personality without being decorative.
- **Body:** Space Grotesk 400 — clean readability at 14px, pairs naturally with the display weight
- **UI/Labels:** Space Grotesk 600 at 11px, uppercase with 0.5px letter-spacing
- **Data/Tables:** JetBrains Mono 400 — developer lineage, supports tabular-nums, built for paths and filenames
- **Code:** JetBrains Mono 400
- **Status text:** JetBrains Mono 400 at 12-13px
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap`
- **Scale:**
  - Display: 32px (app title, hero)
  - Heading: 18px
  - Body: 14px
  - Label: 11px (uppercase, 0.5px tracking)
  - Mono path: 13px
  - Mono status: 12px
  - Mono hint: 11px

## Color
- **Approach:** Restrained — one amber accent + warm neutrals. Color is rare and meaningful.
- **Dark only.** No light mode. Users live in dark terminals.

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#111110` | Window background, warm near-black |
| `--surface` | `#1a1917` | Cards, drop zone background, input groups |
| `--surface-raised` | `#232120` | Inputs, preview area, elevated elements |
| `--text` | `#ede8df` | Primary text, warm cream (not clinical white) |
| `--text-muted` | `#7a756c` | Labels, hints, secondary text (brown-gray) |
| `--accent` | `#c47a3a` | Primary actions, highlights, active states. Amber = freight, movement, delivery. |
| `--accent-hover` | `#d48a4a` | Hover state for accent elements |
| `--accent-soft` | `rgba(196, 122, 58, 0.12)` | Subtle accent backgrounds (info alerts, drag-over) |
| `--success` | `#6b9b6e` | Transmitted confirmation. Muted forest green, not neon. |
| `--error` | `#c45a4a` | Connection errors. Warm red, not alarm-bell. |
| `--border` | `rgba(237, 232, 223, 0.08)` | Whisper-thin structural borders |
| `--border-strong` | `rgba(237, 232, 223, 0.14)` | Visible borders (inputs, drop zone) |

- **Anti-patterns:** No purple, indigo, or neon-blue anywhere. No navy backgrounds. No glassmorphism.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — compact but not cramped
- **Scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48

## Layout
- **Approach:** Left-weighted poster composition
- **Window:** 520x680, min 420x580
- **Composition:**
  - Drop zone dominates top ~50% of viewport
  - Server config in compact field rows below
  - Wide primary action button anchored at bottom
  - Status line as terse monospace strip at very bottom
- **Border radius:** sm: 4px (inputs), md: 6px (buttons, alerts), lg: 10px (cards, drop zone)
- **Key rules:**
  - Left-aligned labels and text, not centered
  - Tight vertical rhythm
  - No "settings page" feel — this is a tool, not a form

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** ease-out for enter, ease-in for exit
- **Duration:** 150ms for state transitions (hover, focus, border-color)
- **Special:** Subtle amber scan-line on screenshot drop (fast, no bounce, 150ms)
- **Anti-patterns:** No bouncing, no choreography, no decorative animations

## Language
- **Posture:** Utilitarian, operational. Not corporate, not cute.
- **Primary action:** "Transmit" (not "Send to Server" or "Upload")
- **Success:** "Transmitted. Path copied to clipboard." (not "Successfully uploaded!")
- **Drop zone:** "Paste or drop a screenshot" with hint "Cmd+V or drag & drop"
- **Error:** Direct and specific. "Connection refused: check host and port."

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-05 | Initial design system created | Created by /design-consultation. Competitive research (Raycast, Linear, Warp, CleanShot X) + outside design voices (Codex, Claude subagent). All three voices converged on warm amber over purple, utilitarian posture, and warm-black backgrounds. |
| 2026-04-05 | Chose amber accent (#c47a3a) over indigo (#5c6bc0) | The product is called "Mule" and it hauls things. Warm amber = freight, delivery, movement. Every other dev tool reaches for blue/purple. Amber is instantly recognizable. |
| 2026-04-05 | Space Grotesk + JetBrains Mono typography | Space Grotesk gives structured personality without being sterile or decorative. JetBrains Mono is the natural choice for a developer tool showing file paths. |
| 2026-04-05 | Dark-only, no light mode | Target users are developers in dark terminals. Light mode would be wasted effort for this audience. |
