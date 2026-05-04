# Day 4 — Demo Polish, Live Simulation Trigger, Repo Cleanup

**Goal:** Make GridSense demo-ready. Add the "Simulate Theft" feature for live recording, write polished documentation, and prepare the repo for judges.

**Time budget:** ~8 hours

---

## Phase 4.1 — "Simulate Theft" Live Demo Trigger (2.5 hours)

### Why this matters
A 5-minute video walkthrough lives or dies on whether something visibly *happens* during recording. Pre-baked anomalies are fine, but a button that injects theft and shows the alert appearing in real-time is dramatically more compelling.

### Tasks

#### Backend
1. Add `POST /api/simulate/theft` endpoint
2. Body: `{"meter_id": "M03", "type": "bypass", "intensity": 0.6}`
3. Effect:
   - Inject anomaly into in-memory data for the next N readings
   - Trigger immediate re-detection
   - Return updated alert for that meter
4. Add `POST /api/simulate/reset` to clear injected anomalies
5. Add safeguard: log every simulation event for repeatability

#### Frontend
1. Add "Simulate" button in top bar (icon: lightning bolt, color: amber)
2. Click opens modal:
   - Dropdown: select meter (default: a normal one like M03)
   - Radio: theft type (bypass / tampering / faulty)
   - Slider: intensity (0.3 to 0.9)
   - Buttons: "Run Simulation" + "Reset All"
3. After clicking Run:
   - Modal closes
   - Toast notification: "Theft injected on M03. Watching for detection..."
   - Within 5 seconds, alert appears in feed AND map marker turns red
   - Animate the new alert card sliding in (top of list)

### Acceptance criteria
- [ ] Simulate modal opens cleanly
- [ ] Submitting injection triggers backend update
- [ ] New alert appears within 5 seconds without manual refresh
- [ ] Animation draws attention to the new alert
- [ ] Reset button restores original state
- [ ] Repeatable: works multiple times in a row

### Test cases — Phase 4.1

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T4.1.1 | Integration | POST `/api/simulate/theft` with M03 | 200 response, alert created |
| T4.1.2 | Integration | GET `/api/alerts` after sim | M03 now in alert list |
| T4.1.3 | Integration | POST `/api/simulate/reset` | M03 removed from alerts |
| T4.1.4 | Behavior | Run simulation 3 times | Each time alert reappears correctly |
| T4.1.5 | UI | Click Simulate → modal | Modal renders with all controls |
| T4.1.6 | UI | Submit form | Modal closes, toast appears |
| T4.1.7 | UI | Wait after submit | Alert card animates in within 5s |
| T4.1.8 | UI | Map marker for simulated meter | Color updates from green to red |
| T4.1.9 | Edge case | Simulate on already-anomalous meter | Handles gracefully (overrides or warns) |
| T4.1.10 | Edge case | Reset when nothing simulated | No-op, no error |

---

## Phase 4.2 — UI Polish & Demo Mode (1.5 hours)

### Tasks
1. **Demo mode toggle** in settings:
   - Speeds up auto-refresh from 30s → 3s
   - Pre-zoom map to relevant area
2. **Branded loading screen**: GridSense logo with subtle pulse animation while data loads
3. **Smooth transitions everywhere**:
   - Alert cards fade in/out
   - Drawer slides with easing
   - Map marker color changes have transition
4. **Empty state illustrations**: Replace "No alerts" text with a small SVG of a calm grid
5. **Tooltips on all icons**: especially the simulate button and heatmap toggle
6. **Confidence visualization**: progress bar instead of just %
7. **Dark mode** (stretch): simple light/dark toggle

### Acceptance criteria
- [ ] All transitions feel smooth (no janky jumps)
- [ ] Empty states never look broken
- [ ] Demo mode visibly speeds up updates
- [ ] All interactive elements have hover/active states

### Test cases — Phase 4.2

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T4.2.1 | Visual | Toggle demo mode | Auto-refresh interval visibly faster |
| T4.2.2 | Visual | Loading state | Branded spinner visible during fetches |
| T4.2.3 | Visual | Hover all icons | Tooltips appear after 500ms |
| T4.2.4 | Visual | Confidence bars | Render correctly for 0%, 50%, 100% |
| T4.2.5 | Interaction | Toggle dark mode (if implemented) | Colors invert cleanly, no broken contrast |

---

## Phase 4.3 — README & Documentation (1.5 hours)

### Required README sections
```markdown
# GridSense — AI-Powered Loss Intelligence Platform

[Banner image / dashboard screenshot]

## The Problem
[Concise version of ATC loss problem — 3-4 sentences]

## The Insight
"Don't watch the meter. Watch the gap." [+1 paragraph]

## How It Works
[Architecture diagram image]

1. **Gap Detection** — ...
2. **Loss Fingerprinting** — ...
3. **Neighborhood Correlation** — ...
4. **Risk Ranking** — ...

## Demo
[Embedded video link or thumbnail linking to YouTube]

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React, Vite, Tailwind, Recharts, Leaflet |
| Backend | Python, FastAPI, scikit-learn |
| Data | Pandas, synthetic generator (prototype) |
| Production | Kafka, TimescaleDB, PostGIS (planned) |

## Quick Start
[Step-by-step run instructions]

## Project Structure
[Tree diagram of folders]

## Detection Methodology
[Brief explanation of the algorithms]

## Roadmap to Production
[How prototype scales to real BESCOM infra]

## Team
[Names + roles]

## License
MIT
```

### Tasks
1. Write all sections following the template above
2. Take 3 polished screenshots:
   - Full dashboard with alerts visible
   - Map with heatmap overlay
   - Detail drawer for M07
3. Create architecture diagram (use draw.io or Excalidraw, save as PNG)
4. Add a `CONTRIBUTING.md` (lightweight)
5. Add a `.env.example` file showing config (even if minimal)

### Acceptance criteria
- [ ] README is well-formatted and renders cleanly on GitHub
- [ ] Screenshots are high-resolution and meaningful
- [ ] Architecture diagram is included
- [ ] Quick Start instructions actually work on a fresh machine

### Test cases — Phase 4.3

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T4.3.1 | Documentation | Follow Quick Start on clean machine | Can run app within 5 minutes |
| T4.3.2 | Documentation | All links in README | All resolve (no 404s) |
| T4.3.3 | Documentation | Architecture diagram visible | Renders on GitHub README |
| T4.3.4 | Documentation | Screenshots load | All images visible inline |

---

## Phase 4.4 — Demo Script (1 hour)

### Goal
A second-by-second script for the 5-minute video. Internalizing this avoids stumbling during recording.

### Recommended structure (5:00 total)

| Time | Section | Talking points |
|------|---------|----------------|
| 0:00–0:30 | Hook + problem | "India loses ₹26,000 crore yearly to electricity theft. Most goes undetected for months. Why? Existing systems watch one meter at a time — a tampered meter just looks low-consumption." |
| 0:30–1:00 | The insight | "Theft doesn't disappear. It shows up as a gap between feeder supply and meter aggregate. We watch that gap." |
| 1:00–1:30 | Architecture overview | Show diagram. Walk through: smart meters → gap detector → AI classifier → ranked alerts. |
| 1:30–4:00 | Live demo | Start dashboard → point to alerts → click M07, explain bypass detection → show gap timeline → trigger live simulation → new alert appears → click new alert. |
| 4:00–4:30 | Impact | "Field officers get ranked, explainable alerts. Investigation time drops from weeks to hours. Scales across BESCOM with no hardware changes." |
| 4:30–5:00 | What's next | Production stack, real meter integration, expansion roadmap. |

### Tasks
1. Write full script in `docs/demo_script.md`
2. Practice once end-to-end with a stopwatch
3. Identify any moments where pace feels off
4. Rehearse the simulate-theft moment specifically — it must be smooth

### Test cases — Phase 4.4

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T4.4.1 | Rehearsal | Record dry run | Total time within 4:30–5:15 |
| T4.4.2 | Rehearsal | Simulate theft moment | New alert appears within natural pause in narration |
| T4.4.3 | Rehearsal | Watch dry run back | No "ums" in critical 60-second windows |

---

## Phase 4.5 — Repo Cleanup & CI Sanity (1 hour)

### Tasks
1. **Lint + format**: run `black backend/`, `ruff backend/`, `prettier frontend/`
2. **Pre-commit hook**: install `pre-commit` with black, ruff, eslint
3. **Add basic GitHub Actions workflow** (`.github/workflows/ci.yml`):
   - On push: run backend pytest, run frontend `npm run build`
4. **Verify no secrets**: scan for `.env`, API keys, tokens
5. **Tag a release**: `git tag v0.1.0-prototype && git push --tags`
6. **Add license**: confirm MIT
7. **Update repo description and topics** on GitHub: "ai", "energy", "iot", "fastapi", "react", "anomaly-detection"
8. **Pin a polished README screenshot** to top of repo

### Acceptance criteria
- [ ] CI workflow passes on push
- [ ] No lint warnings
- [ ] No secrets in commits (use `git log -p | grep -i secret` or similar)
- [ ] Repo looks professional at a glance

### Test cases — Phase 4.5

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T4.5.1 | CI | Push trivial commit | GitHub Actions workflow runs and passes |
| T4.5.2 | Lint | Run black/ruff | No errors |
| T4.5.3 | Lint | Run prettier | No formatting changes needed |
| T4.5.4 | Build | `npm run build` | Produces dist/ without warnings |
| T4.5.5 | Tests | Run all pytest | All pass |
| T4.5.6 | Security | Search for committed secrets | None found |

---

## Phase 4.6 — End-of-Day Final Integration Test (45 min)

### Full demo dry run (no recording yet)
1. Fresh terminal sessions
2. Start backend + frontend from scratch
3. Walk through the demo script in real time
4. Click through every interaction the video will show
5. Trigger simulate theft 2-3 times to confirm reliability
6. Identify any rough edges → fix immediately

### Day 4 regression checklist (cumulative)

| ID | Check | Pass criteria |
|----|-------|---------------|
| R4.1 | All Day 1-3 tests still pass | T1, T2, T3 suites green |
| R4.2 | Simulate endpoint works in isolation | curl test passes |
| R4.3 | Simulate doesn't break normal alerts | After reset, system back to baseline |
| R4.4 | All polish changes don't break tests | Full T-suite green |
| R4.5 | README instructions verified | Followed by another team member if possible |
| R4.6 | CI green | Last commit shows green check on GitHub |
| R4.7 | Demo can be repeated 3 times consecutively | No state corruption between runs |

### Day 4 critical-path test scenarios

| Scenario | Steps | Pass criteria |
|----------|-------|---------------|
| Cold start demo | Fresh clone → install → start → demo | Works without manual fixes |
| Repeated simulation | Simulate 5 times in a row | All 5 detected, no degradation |
| Reset reliability | Simulate → reset → simulate again | Each cycle clean |
| Long-running session | Leave running for 30 min | No memory leaks, still responsive |
| Recording rehearsal | Record screen during demo | Captures clearly, no flicker |

---

## Day 4 Definition of Done

- [ ] Simulate Theft works flawlessly
- [ ] README is publication-quality
- [ ] Architecture diagram included
- [ ] Demo script written and rehearsed
- [ ] CI workflow passing
- [ ] All cumulative tests green
- [ ] Repo looks polished from a stranger's perspective

## Hand-off to Day 5

Day 5 is purely recording, editing, uploading, and final verification. The product is frozen.
