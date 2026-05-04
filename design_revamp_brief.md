# GridSense — Design Revamp Brief

> **Trigger condition:** All 5 gates in `finalization_checklist.md` are ✅.
>
> **Purpose:** Transform the functional prototype into a visually compelling, smooth, and memorable dashboard that judges remember. Functionality is frozen — only the visual / interaction layer changes.
>
> **Constraint:** Do not modify backend, API contracts, detection logic, or data flow. UI-layer only.

---

## Part 1 — Design Philosophy

GridSense is a **command center for electricity loss intelligence**. Field officers should feel like they're piloting a system that gives them clarity in chaos. The aesthetic should feel:

- **Operational, not decorative.** Like Bloomberg Terminal or Linear, not a generic SaaS landing page.
- **High-signal.** Every pixel earns its place. No filler illustrations, no marketing fluff.
- **Confident in dark.** Default to a dark theme. Power-distribution monitoring is a 24/7 operation; bright UIs are exhausting.
- **Spatially honest.** The map is the hero. It represents the real grid. Everything else supports it.
- **Calm at rest, urgent on alert.** When nothing is wrong, the UI breathes. When theft is detected, the UI reacts visibly.

### Anti-patterns to avoid
- ❌ Gradient backgrounds, glassmorphism, or "AI-product" purple-blue washes
- ❌ Stock dashboard templates (Tailwind UI default look)
- ❌ Excessive iconography or emoji
- ❌ Marketing-style hero sections inside the app
- ❌ Light theme as default
- ❌ Centered cards on empty white backgrounds

---

## Part 2 — Visual Language

### Color System

Replace whatever ad-hoc colors are in the prototype with this disciplined palette:

**Background layers (dark mode default):**
- `--bg-base`: `#0A0E13` — deepest layer (app background)
- `--bg-surface`: `#11161D` — elevated surfaces (cards, panels)
- `--bg-elevated`: `#1A2029` — hovered/active surfaces
- `--bg-overlay`: `rgba(10, 14, 19, 0.85)` — modals, drawers

**Borders:**
- `--border-subtle`: `rgba(255, 255, 255, 0.06)`
- `--border-default`: `rgba(255, 255, 255, 0.10)`
- `--border-emphasis`: `rgba(255, 255, 255, 0.18)`

**Text:**
- `--text-primary`: `#E8EBED` — headings, key numbers
- `--text-secondary`: `#9BA3AB` — body, labels
- `--text-tertiary`: `#5E6770` — hints, metadata
- `--text-disabled`: `#3A4148`

**Status / risk colors (these encode meaning — use consistently):**
- `--risk-critical`: `#FF4D4F` — high-confidence theft, immediate action
- `--risk-high`: `#FF8C42` — strong anomaly, investigate
- `--risk-moderate`: `#FFC53D` — suspicious pattern, monitor
- `--risk-low`: `#52C41A` — normal operation
- `--info`: `#4DABF7` — informational, links, time scrubber
- `--accent`: `#7C4DFF` — brand accent, used sparingly

### Typography

- **Display / numbers:** `JetBrains Mono` or `IBM Plex Mono` — for kWh values, confidence percentages, meter IDs. Monospace makes data scannable and feels operational.
- **UI text:** `Inter` — for labels, body, buttons. 400 / 500 weights only.
- **No serif fonts.** No script fonts.

**Type scale (use only these sizes):**
- `48px / 500` — primary metric (e.g., total kWh lost across grid)
- `28px / 500` — section headers
- `18px / 500` — card titles
- `14px / 400` — body text, labels
- `12px / 400` — metadata, timestamps
- `11px / 500 uppercase tracked` — eyebrow labels (e.g., "RISK LEVEL")

### Spacing

8px base grid. Use only these values: `4, 8, 12, 16, 20, 24, 32, 48, 64`.

### Corner radius
- Cards: `8px`
- Buttons: `6px`
- Pills/badges: `999px` (full)
- Modals/drawers: `12px`

### Motion

All transitions use these timings:
- **Micro** (hover, color change): `120ms ease-out`
- **Short** (drawer open, modal): `200ms cubic-bezier(0.16, 1, 0.3, 1)`
- **Long** (page transitions, big layout shifts): `320ms cubic-bezier(0.16, 1, 0.3, 1)`

The cubic-bezier above is "ease-out-expo" — fast start, slow end. Feels confident.

**Special motion moments:**
- New alert appearing: 320ms slide-in from top + subtle red glow pulse (peaks at 240ms, fades by 800ms)
- Risk level changing on map marker: 200ms color crossfade + 1.2s outward ripple ring
- Number changes: count-up animation (300ms) for kWh values
- Drawer open: 200ms slide + content fades in at 80ms offset

---

## Part 3 — Component Redesign

### 3.1 Top Bar (Header)

**Current:** Logo + feeder selector + last updated.

**Redesigned:**
- Left: GridSense wordmark in mono font, with a small live status indicator (green pulsing dot for "monitoring active")
- Center: Feeder selector as a pill-style dropdown with current feeder + meter count badge
- Right cluster:
  - Live system metrics in mono: `ALERTS: 4` `LOSS: 18.2 kWh` `UPTIME: 100%`
  - Settings icon
  - "Simulate" button (kept prominent for demo)

**Height:** 56px. Border-bottom only, no shadow.

### 3.2 Left Panel — Alert Feed

**Redesigned card structure:**

```
┌─────────────────────────────────────────┐
│ [risk-bar]  M07              CRITICAL   │
│             Bypass theft     ████░ 87%  │
│             ─────────────                │
│             Detected 2 hours ago         │
│             ↓ 14.2 kWh lost              │
└─────────────────────────────────────────┘
```

Where `[risk-bar]` is a 3px vertical bar on the left edge, colored by risk level. The card:
- Background: `--bg-surface`
- On hover: lifts to `--bg-elevated`, risk bar widens to 4px
- On click: persistent `--bg-elevated` + 1px border in risk color
- Padding: 16px
- Stack with 8px gap between cards

**Header of feed:**
- "Active Alerts" title + count pill
- Filter chips: `All` `Critical` `High` `Moderate` (toggle-able)
- Sort dropdown: `By Risk ↓` `By Time` `By Loss kWh`

**Empty state (no alerts):**
- Calm illustration: simple horizontal line graph SVG with all-green points
- Text: "All clear. Grid is operating normally." in `--text-secondary`

### 3.3 Center — Map (the Hero)

**Redesigned map:**
- Use **dark map tiles** — Carto Dark Matter or Stadia Alidade Smooth Dark (free, attribution required)
- Custom marker design: replace default Leaflet markers with custom SVG circles
  - Outer ring: 24px diameter, stroke 2px in risk color
  - Inner fill: 12px solid, semi-transparent risk color
  - On the highest-risk markers: animated outward pulse ring (CSS keyframe, 1.6s loop)
- Cluster lines connecting meters to feeder substation: thin (0.5px) lines in `--border-emphasis`
- Substation icon: distinct hexagon shape in `--accent`
- **Heatmap overlay:** when toggled, use a smooth red→amber→transparent gradient with reduced opacity so markers stay visible

**Map controls (top-left corner of map):**
- Zoom in/out buttons in matching dark style (no default Leaflet chrome)
- Layer toggle: `Markers` / `Heatmap` / `Both`
- Time slider button (opens timeline below)

**Map legend (bottom-right):**
- Floating card with risk color swatches and meaning
- Auto-collapses to icon after 5 seconds, expands on hover

### 3.4 Gap Timeline Chart

**Redesigned:**
- Position: collapsible band above the map (default: 180px tall)
- Two area charts, stacked:
  - Top: Feeder input (filled with `--info` at 30% opacity, 1.5px stroke)
  - Bottom: Meter sum (filled with `--text-secondary` at 30% opacity)
- Gap regions: when feeder > meters by >7%, shade red with subtle stripe pattern
- X-axis: minimal — only show day boundaries with thin vertical guides
- Y-axis: minimal — small mono numbers, no gridlines
- Tooltip: dark card with mono numbers, follows cursor
- Brush/scrub: thin 4px handle bar at bottom, drag to zoom

**The headline number above the chart:**
- Large mono display: "₹47,200" (estimated loss in INR)
- Subtitle: "Estimated loss this week" in `--text-tertiary`
- Updates with count-up animation when data refreshes

### 3.5 Right Panel — Detail Drawer

**Redesigned drawer:**
- Width: 440px
- Slides in from right with 200ms ease-out
- Inside has 5 distinct sections separated by 24px gaps, no visible dividers — just whitespace

**Section 1 — Header:**
- Meter ID in 28px mono: `M07`
- Risk badge (pill) in 12px uppercase: `CRITICAL · BYPASS THEFT`
- Close button (×) top-right, hover shows red

**Section 2 — Risk Assessment:**
- Confidence gauge: horizontal bar, segmented into 10 cells, fills based on confidence %
- Reasoning text in `--text-secondary`, 14px, line-height 1.6
- Three small stat tiles in a row:
  - `LOSS · 14.2 kWh`
  - `DURATION · 18 hrs`
  - `STARTED · 2 hrs ago`

**Section 3 — Consumption Pattern (mini chart):**
- 7-day sparkline-style chart, 80px tall
- Highlighted area shows where anomaly began
- Compare line: "expected baseline" in dashed `--text-tertiary`

**Section 4 — Anomaly Score Trend (mini chart):**
- Similar style, but plots anomaly score with red-tinted area
- Threshold line in `--risk-moderate`

**Section 5 — Recommended Action:**
- Card with `--bg-elevated` background
- Action title: "Dispatch field officer for inspection"
- Body: 1-2 sentences of guidance
- Sub-actions:
  - Primary button: `Mark for Inspection` (filled in `--accent`)
  - Secondary button: `Dismiss as False Positive` (ghost style)
  - Tertiary: `Add Notes` (text-only)

### 3.6 Simulate Modal

**Redesigned:**
- Centered modal at 480px wide, dark surface, 12px corners
- Subtle blur on backdrop (`backdrop-filter: blur(8px)`)
- Title: "Simulate Loss Event" with `--accent` underline
- Form fields use floating labels (label rises on focus)
- "Run Simulation" button: `--accent` filled, full width at bottom
- After click: modal smoothly fades out, toast appears top-right

### 3.7 Toast Notifications

- Position: top-right, 16px from edges
- Width: 360px max
- Background: `--bg-elevated` with risk-color left border (4px)
- Auto-dismiss: 5 seconds, with progress bar at bottom edge
- Stack: max 3 visible, older ones fade out

---

## Part 4 — Layout Adjustments

### 4.1 Grid System

```
┌────────────────────────────────────────────────────────────┐
│                       Top Bar (56px)                        │
├──────────────┬─────────────────────────────────┬───────────┤
│              │   Gap Timeline (180px collapsible)          │
│  Alert Feed  ├─────────────────────────────────┤  Detail   │
│   (340px)    │                                  │  Drawer   │
│              │       Map (flex-grow)            │  (440px,  │
│              │                                  │  slide-in)│
│              │                                  │           │
└──────────────┴─────────────────────────────────┴───────────┘
```

**At < 1280px width:**
- Left panel narrows to 280px
- Drawer overlays on top instead of pushing layout

**At < 768px (mobile):**
- Stack vertically: Alert feed (collapsible) → Map → Drawer (full-screen modal)
- Don't optimize heavily for mobile — judges will use desktop

---

## Part 5 — Polish Details

### 5.1 Loading states
- Replace any `Loading...` text with skeleton shimmer effects
- Skeleton blocks match final layout (so transition is invisible)
- Shimmer: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)`, 1.5s loop

### 5.2 Empty states
- Every empty state has:
  - Simple monochrome SVG illustration (line drawing style, 80px square)
  - Heading in `--text-primary`
  - Helper text in `--text-secondary`
  - Optional CTA button

### 5.3 Error states
- Inline errors with `--risk-high` left border
- Retry buttons always offered
- Error messages are human ("Couldn't reach the backend. Try again?") not technical

### 5.4 Focus & accessibility
- Focus rings: 2px `--accent` outline with 2px offset
- All interactive elements have visible focus states
- Color is never the only signal (always pair with icon, label, or pattern)
- Pulsing animations respect `prefers-reduced-motion`

### 5.5 Sound (optional, off by default)
- Subtle "ping" when new critical alert appears
- Toggle in settings, off by default
- If kept off for the demo: skip implementing

---

## Part 6 — Asset Checklist

Items to design or generate before/during implementation:

- [ ] GridSense wordmark (SVG, light + dark versions)
- [ ] App favicon (32×32, 16×16)
- [ ] Open Graph banner (1200×630, for repo + video link previews)
- [ ] 3 dashboard screenshots in dark mode (for README)
- [ ] Architecture diagram redrawn in dark theme using consistent palette
- [ ] Simple SVG empty-state illustrations (3-4 variants)
- [ ] Custom map markers (SVG, 4 risk levels)
- [ ] Substation icon (SVG, hexagon shape)

---

## Part 7 — Implementation Order

When Claude executes this revamp, follow this order to keep work testable:

### Phase R.1 — Design Tokens (1 hour)
- Set up CSS custom properties for the full color/spacing/typography system
- Update Tailwind config to use these tokens
- Verify dark theme is applied globally

### Phase R.2 — Top Bar + Layout Frame (1 hour)
- Redesign header
- Adjust grid layout proportions
- Verify everything still functions

### Phase R.3 — Alert Feed (1.5 hours)
- New card design
- Risk bar accent
- Filter chips
- Empty state

### Phase R.4 — Map Redesign (2 hours)
- Switch to dark tiles
- Custom SVG markers with pulse animation
- Heatmap restyling
- Custom map controls
- Legend card

### Phase R.5 — Gap Timeline Chart (1 hour)
- Recharts theme override
- Headline number with count-up
- Gap shading with pattern

### Phase R.6 — Detail Drawer (1.5 hours)
- 5-section redesign
- Confidence gauge component
- Sparkline mini-charts
- Action button styles

### Phase R.7 — Simulate Modal + Toasts (1 hour)
- Modal redesign with backdrop blur
- Toast component with risk-color border
- Animation timings

### Phase R.8 — Motion Polish (1 hour)
- New alert slide-in + glow
- Map marker color transitions + ripple
- Drawer slide-out timing
- Number count-ups

### Phase R.9 — Loading + Empty + Error States (1 hour)
- Skeleton shimmer system
- Empty state illustrations
- Error retry components

### Phase R.10 — Final Visual Pass (1 hour)
- Take screenshots in 3 states (idle / alert active / drawer open)
- Compare against design philosophy checklist
- Tweak spacing, contrast, micro-details
- Update README with new screenshots

---

## Part 8 — Acceptance Criteria for the Revamp

Before declaring the design revamp complete:

- [ ] No light-theme remnants visible anywhere
- [ ] Every interactive element has hover, focus, and active states
- [ ] Every animation respects `prefers-reduced-motion`
- [ ] Color contrast passes WCAG AA on all text
- [ ] No element uses gradients, glassmorphism, or generic SaaS-template aesthetics
- [ ] The demo experience visibly improves: simulate-theft moment now has a "wow" beat (animated alert + map ripple + drawer auto-flash)
- [ ] All previous functionality still works (no regressions in T1-T4 test suites)
- [ ] Three new screenshots taken for README and video thumbnails
- [ ] Total bundle size hasn't bloated more than +15% vs pre-revamp

---

## Part 9 — Hand-off Back to Day 5

Once Section 8 acceptance criteria are met:

1. Re-record any video segments where the UI is visible (the dashboard sections will look noticeably better)
2. Update README screenshots with the new dark-theme designs
3. Tag a new release: `v0.2.0-prototype-revamped`
4. Proceed to Day 5 video recording with the polished UI

---

## Closing Note

The revamp's job is not to add features. It's to make the prototype look like a product judges trust to be deployed in BESCOM tomorrow. Every visual decision should answer: **"Does this make GridSense feel more like a tool used by professionals managing a real grid?"**

If yes, ship it. If no, cut it.
