# Day 3 — React Dashboard: Map, Alerts, Heatmap, Detail Drawer

**Goal:** Build the visual layer field officers will use. End the day with a working dashboard that shows ranked alerts, a feeder topology map, a gap-over-time chart, and a drill-down drawer.

**Time budget:** ~9 hours

---

## Phase 3.1 — Layout & Navigation Shell (1 hour)

### Tasks
1. Replace placeholder `App.jsx` with proper layout:
   - Top bar: GridSense logo + feeder selector dropdown + "Last updated" timestamp
   - Left panel (340px): Alert feed (scrollable list)
   - Center: Map canvas (flex-grow)
   - Right panel (400px, slide-in): Meter detail drawer (closed by default)
2. Set up React state management:
   - `selectedFeeder` (default `F001`)
   - `selectedMeter` (null when nothing selected)
   - `alerts` (fetched from API)
   - `timeRange` (default last 7 days)
3. Add Tailwind theming variables for primary/danger/success colors

### Acceptance criteria
- [ ] Top bar renders with logo and feeder selector
- [ ] Three panels visible without overflow
- [ ] Right panel slides in/out smoothly when meter selected/deselected
- [ ] Layout responsive down to 1280px width

### Test cases — Phase 3.1

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T3.1.1 | Visual | Page renders at 1920×1080 | Three panels visible, no horizontal scroll |
| T3.1.2 | Visual | Page renders at 1280×800 | Layout still works, no overlaps |
| T3.1.3 | Interaction | Click meter → drawer opens | Drawer slides in from right, content area shrinks |
| T3.1.4 | Interaction | Click X on drawer → drawer closes | Drawer slides out, center expands |
| T3.1.5 | State | Refresh page | Default state restored cleanly |

---

## Phase 3.2 — Alert Feed Panel (1.5 hours)

### Tasks
1. Build `src/components/AlertFeed.jsx`:
   - Fetches `/api/alerts` on mount and every 30 seconds
   - Renders sorted list of alert cards
2. Each `AlertCard` shows:
   - Meter ID (prominent)
   - Loss type badge (color-coded: red=bypass, amber=tampering, gray=faulty, blue=billing)
   - Confidence percentage
   - Last anomaly timestamp ("2 hours ago")
   - Total kWh lost
3. Click handler: sets `selectedMeter` in parent state
4. Loading state: skeleton placeholder cards
5. Empty state: "No anomalies detected ✓" with green check
6. Error state: "Could not load alerts. Retry?"

### Acceptance criteria
- [ ] Alerts load on page mount
- [ ] Cards display all required fields
- [ ] Click on a card highlights it and opens drawer
- [ ] Auto-refresh works (verify via network tab)
- [ ] Loading skeleton shown briefly on first load
- [ ] Error state shown when backend is offline

### Test cases — Phase 3.2

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T3.2.1 | Integration | Backend with alerts | List renders with N cards |
| T3.2.2 | Integration | Backend with empty alerts | Empty state displayed |
| T3.2.3 | Integration | Backend offline | Error state displayed with retry button |
| T3.2.4 | Interaction | Click alert card | Card highlighted, drawer opens with that meter |
| T3.2.5 | Interaction | Click retry button | Re-fetches alerts |
| T3.2.6 | Behavior | Wait 30 seconds | Auto-refresh fires (visible in network tab) |
| T3.2.7 | Visual | Loss type badges | Colors match spec (red/amber/gray/blue) |
| T3.2.8 | Performance | List of 50 alerts | Scrolls smoothly, no jank |

---

## Phase 3.3 — Feeder Topology Map (2.5 hours)

### Tasks
1. Build `src/components/FeederMap.jsx` using `react-leaflet`
2. Center map on Bengaluru (12.9716, 77.5946), zoom 14
3. Use OpenStreetMap tiles (free, no API key)
4. Render meter markers:
   - Circle marker per meter
   - Color by risk: green (safe), amber (suspicious), red (high risk)
   - Size by total kWh consumption
5. Render feeder substation as a distinct icon at center of meter cluster
6. Click handler on marker: selects meter, opens drawer
7. Hover: tooltip with meter ID and current status
8. Add legend (bottom-right) explaining color coding
9. Heatmap overlay layer (toggle button) — uses `leaflet.heat` plugin to show risk density

### Acceptance criteria
- [ ] Map loads with all 20 meters visible
- [ ] Marker colors match alert data (M07, M13, M15-M18 are red/amber)
- [ ] Click marker → drawer opens
- [ ] Heatmap toggle works smoothly
- [ ] Legend visible and accurate

### Test cases — Phase 3.3

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T3.3.1 | Visual | Map renders | OSM tiles load, markers visible |
| T3.3.2 | Visual | All 20 meters present | Count of markers = 20 |
| T3.3.3 | Visual | Color coding | M07, M13 are red; M15-M18 amber; rest green |
| T3.3.4 | Interaction | Click marker | Selected state set, drawer opens |
| T3.3.5 | Interaction | Hover marker | Tooltip appears with meter ID |
| T3.3.6 | Interaction | Toggle heatmap on | Heat overlay visible, denser around theft cluster |
| T3.3.7 | Interaction | Toggle heatmap off | Overlay disappears |
| T3.3.8 | Edge case | No alerts data | Map still renders with all-green markers |

---

## Phase 3.4 — Gap Timeline Chart (1.5 hours)

### Tasks
1. Build `src/components/GapTimeline.jsx` using Recharts
2. Render at top of center panel (above map) — collapsible
3. Two lines on a single chart:
   - Blue line: Feeder input (kWh) over time
   - Green line: Sum of meter readings (kWh) over time
4. Shaded area between lines = the "gap" (red shading where gap > threshold)
5. X-axis: timestamps over 7 days
6. Y-axis: kWh
7. Tooltip on hover shows exact values + gap %
8. Add brush/zoom for date range selection

### Acceptance criteria
- [ ] Two lines render with correct values
- [ ] Gap shading visible on theft days (Days 4-7)
- [ ] Tooltip works on hover
- [ ] Brush allows zooming to a specific day

### Test cases — Phase 3.4

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T3.4.1 | Visual | Chart renders | Two lines visible, X/Y axes labeled |
| T3.4.2 | Data | Day 1-3 region | Lines nearly overlap (low gap) |
| T3.4.3 | Data | Day 4-7 region | Visible separation, red shading |
| T3.4.4 | Interaction | Hover data point | Tooltip shows feeder, meter sum, gap kWh, gap % |
| T3.4.5 | Interaction | Drag brush to Day 4 | Chart zooms to that day |
| T3.4.6 | Interaction | Reset zoom | Returns to full 7-day view |
| T3.4.7 | Edge case | No data | Empty state placeholder shown |

---

## Phase 3.5 — Meter Detail Drawer (1.5 hours)

### Tasks
1. Build `src/components/MeterDrawer.jsx`
2. Triggered when `selectedMeter` is set
3. Drawer contents:
   - Header: Meter ID + close button + status badge
   - Section "Risk Assessment": loss type, confidence %, reasoning text (the human-readable explanation from backend)
   - Section "Consumption Pattern": small line chart of last 7 days (using Recharts)
   - Section "Anomaly Score Trend": line chart of anomaly scores over time
   - Section "Recommended Action": text suggestion based on loss type
   - Action buttons: "Mark for Inspection", "Dismiss as False Positive", "Add Notes"
4. Fetches `/api/alerts/{meter_id}` for details
5. Action buttons: stub (no real persistence — log to console for prototype)

### Acceptance criteria
- [ ] Drawer opens when meter clicked
- [ ] All 4 sections render with data
- [ ] Reasoning text is human-readable
- [ ] Charts render meter's actual readings
- [ ] Close button works
- [ ] Action buttons are clickable and provide visual feedback

### Test cases — Phase 3.5

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T3.5.1 | Integration | Click M07 | Drawer opens with M07 data |
| T3.5.2 | Integration | Click M01 (normal) | Drawer shows low-risk state |
| T3.5.3 | Visual | All 4 sections present | Risk, Consumption, Anomaly Trend, Recommended Action |
| T3.5.4 | Visual | Loss type badge color | Matches alert card color |
| T3.5.5 | Interaction | Click "Mark for Inspection" | Toast/visual confirmation appears |
| T3.5.6 | Interaction | Click close button | Drawer closes |
| T3.5.7 | Interaction | Switch from M07 to M13 | Drawer re-renders with M13 data |
| T3.5.8 | Edge case | Network error during fetch | Drawer shows error state, doesn't crash |

---

## Phase 3.6 — Visual Polish & Accessibility (45 min)

### Tasks
1. Consistent spacing (8px grid)
2. Loading spinners that don't jump layout
3. Keyboard navigation: tab through alert list, enter to select
4. Color contrast check (WCAG AA minimum)
5. Hover states on all interactive elements
6. Add favicon and update page title to "GridSense — Loss Intelligence"

### Test cases — Phase 3.6

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T3.6.1 | Accessibility | Tab through page | Focus visible, logical order |
| T3.6.2 | Accessibility | Run axe-core | No critical violations |
| T3.6.3 | Visual | All interactive elements have hover states | Cursor change + visual feedback |
| T3.6.4 | Visual | Page title in browser tab | "GridSense — Loss Intelligence" |

---

## Phase 3.7 — End-of-Day Integration Test (45 min)

### Full demo walk-through
1. Start backend + frontend
2. Open dashboard — verify all panels render
3. Verify alerts are visible in left panel
4. Click M07 → drawer opens with bypass theft details
5. Look at gap timeline → see red shaded region on Day 4+
6. Click map marker for M13 → drawer updates to faulty meter
7. Toggle heatmap → see cluster density
8. Commit: `feat(day3): dashboard with map, alerts, timeline, detail drawer`

### Day 3 regression checklist (cumulative)

| ID | Check | Pass criteria |
|----|-------|---------------|
| R3.1 | All Day 1-2 tests still pass | T1.x and T2.x suites green |
| R3.2 | Backend unchanged | API contract identical |
| R3.3 | All UI components render | No console errors on full nav flow |
| R3.4 | Map + alerts stay in sync | Same meter highlighted in both |
| R3.5 | Auto-refresh doesn't break selection | If M07 selected, refresh keeps drawer open |
| R3.6 | App handles backend offline gracefully | Error states everywhere, no white screens |
| R3.7 | Build still works | `npm run build` succeeds with no warnings |

### Day 3 cross-component integration tests

| Scenario | Steps | Expected behavior |
|----------|-------|-------------------|
| Click flow | Click alert in feed → drawer opens → map marker highlighted | All three components synced |
| Reverse flow | Click map marker → alert in feed scrolls to/highlights it | Bidirectional sync works |
| Time scrub | Drag brush in timeline → map updates risk colors for that period | (Stretch) Map reflects time selection |
| Refresh during interaction | Open drawer → wait for auto-refresh | Drawer stays open, data refreshes silently |
| Multi-tab | Open dashboard in 2 tabs | Both work independently |

---

## Day 3 Definition of Done

- [ ] All Phase 3.x acceptance criteria met
- [ ] All test cases pass (T3.x + R3.x regression)
- [ ] Dashboard is screenshot-able for the README
- [ ] No console errors or warnings
- [ ] Code pushed with proper commits
- [ ] Brief screen recording (30s, no audio) added to `docs/` for early sanity check

## Hand-off to Day 4

Day 3 ends with a working dashboard. Day 4 adds the live "Simulate Theft" demo trigger and polishes everything for recording.
