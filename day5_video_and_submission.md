# Day 5 — Video Recording, Editing, Final Submission

**Goal:** Capture, edit, and publish the 5-minute video walkthrough. Verify all 3 deliverables are accessible and submit.

**Time budget:** ~7 hours (front-loaded so there's buffer for re-takes)

---

## Phase 5.1 — Recording Environment Setup (45 min)

### Tasks
1. **Display setup**:
   - Use single monitor at 1920×1080 (consistent for editing)
   - Hide desktop icons, close all unrelated apps
   - Browser: clean profile or incognito, no extensions visible
   - Set browser zoom to 100%
2. **Audio setup**:
   - Use a decent mic (headset or USB mic)
   - Quiet room, close windows, turn off fans
   - Test recording: 30 seconds, listen back for noise/echo
3. **Recording software**: OBS Studio (free, reliable)
   - Settings: 1920×1080, 30 fps, MP4 output
   - Audio: monitor levels, set gain so peaks hit -12 dB
   - Test recording: confirm both screen and mic captured
4. **Backup recording option**: Loom (cloud, easier) as Plan B

### Acceptance criteria
- [ ] Test recording plays back cleanly with audible voice
- [ ] No background noise audible
- [ ] Screen capture is sharp (text legible)
- [ ] Recording software writes file successfully

### Test cases — Phase 5.1

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T5.1.1 | Recording | 30-second test capture | File saves, plays back |
| T5.1.2 | Audio | Listen to test playback | Voice clear, no echo, no peaking |
| T5.1.3 | Video | Inspect test playback | Sharp at 1080p, no dropped frames |
| T5.1.4 | Sync | Speak while clicking | Audio and video aligned |

---

## Phase 5.2 — Application Pre-Recording Setup (30 min)

### Tasks
1. Restart backend with fresh data: `python data/generator.py && uvicorn app.main:app`
2. Restart frontend: `npm run dev`
3. Open browser to dashboard
4. Verify:
   - All alerts loaded
   - Map renders correctly
   - Simulate button accessible
5. Pre-position the dashboard:
   - Map zoomed to show all 20 meters
   - Time range showing full 7 days
   - Drawer closed
6. Have a "demo cheat sheet" open on phone or second monitor:
   - Key talking points
   - Order of clicks
   - Backup numbers (₹26,000 crore, etc.)

### Acceptance criteria
- [ ] App in clean, predictable state
- [ ] No console errors
- [ ] All demo interactions verified working

---

## Phase 5.3 — First Take Recording (1 hour)

### Approach
Record the full 5 minutes in **one continuous take**. Multiple takes will be needed; budget for 3-5 attempts.

### Recording protocol
1. Click record in OBS
2. Wait 3 seconds of silence (gives editing buffer at start)
3. Begin narration following the script
4. If you stumble badly, **don't stop** — pause, take a breath, restart that sentence cleanly. Editing can cut.
5. Wait 3 seconds of silence at the end
6. Stop recording
7. Save with descriptive filename: `gridsense_demo_take1_v0.mp4`
8. Quick playback first 30 seconds to confirm capture worked

### Common issues to watch
- Microphone too quiet (peak meter shows below -18 dB)
- Browser tab notifications interrupting
- Forgetting to start recording (most common!)
- Talking too fast (breathe between sections)

### Acceptance criteria
- [ ] At least 2 successful takes captured
- [ ] Best take has clear audio and smooth flow
- [ ] No critical errors in best take

### Test cases — Phase 5.3

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T5.3.1 | Take review | Watch each take | Identify best continuous performance |
| T5.3.2 | Audio quality | Best take audio | No clipping, consistent volume |
| T5.3.3 | Pacing | Best take total length | Between 4:30 and 5:15 |
| T5.3.4 | Demo accuracy | Simulate moment in best take | Anomaly visibly appears as discussed |
| T5.3.5 | Visual clarity | Text in dashboard | Legible at viewing size |

---

## Phase 5.4 — Editing (1.5 hours)

### Tools
- **Free options**: DaVinci Resolve, OpenShot, Shotcut
- **Paid**: Premiere Pro, Final Cut
- **Quick option**: CapCut (decent, free, fast)

### Editing tasks
1. Import the best raw take
2. **Trim**: Cut the 3-second silence buffers at start/end down to ~0.5s
3. **Cut filler**: Remove "ums", long pauses, false starts
4. **Add intro card** (3-5s): GridSense logo + tagline + "Prototype Demo"
5. **Add outro card** (3-5s): Team names + repo link + "Thank you"
6. **Lower-thirds** (optional): Title bars when introducing sections (e.g., "The Insight", "Live Demo")
7. **Audio cleanup**:
   - Apply noise reduction if needed
   - Normalize audio to -16 LUFS
   - Compressor for consistent level
8. **No background music** (or very subtle if used) — clarity first
9. **Subtitles** (highly recommended, optional): auto-generate via CapCut or Whisper, then proofread
10. **Final check pass**: watch all the way through with fresh ears

### Acceptance criteria
- [ ] Final length: 4:30–5:15 (ideally exactly 5:00)
- [ ] No awkward cuts or audio glitches
- [ ] Audio level consistent throughout
- [ ] Intro and outro cards added
- [ ] Final export at 1080p MP4, ~50-150 MB file size

### Test cases — Phase 5.4

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T5.4.1 | Length | Final cut duration | Within 4:30–5:15 |
| T5.4.2 | Audio | Listen with headphones | Clean, no artifacts |
| T5.4.3 | Cuts | Watch transitions | No jarring jumps |
| T5.4.4 | Export | Final MP4 file | Plays in VLC, Quicktime, browser |
| T5.4.5 | Subtitles | (If added) accuracy | All technical terms spelled correctly |

---

## Phase 5.5 — Hosting & Linking (45 min)

### Tasks
1. **Upload video to YouTube**:
   - Title: "GridSense — AI-Powered Electricity Loss Intelligence (5-min Prototype Demo)"
   - Description: brief problem + tech + GitHub link
   - Visibility: Unlisted (recommended) or Public
   - Tags: "smart grid", "anomaly detection", "AI", "FastAPI", "React"
   - Custom thumbnail: dashboard screenshot with "GridSense" overlay
2. **Backup uploads**:
   - Upload same MP4 to Google Drive (shareable link)
   - Add MP4 directly to repo `docs/demo.mp4` if size permits (< 100MB) or use Git LFS
3. **Update README**:
   - Replace placeholder with real video link/embed
   - Add YouTube thumbnail image linking to video
4. **Update GitHub repo**:
   - Repo description includes link to video
   - Pin the video in the project's "About" sidebar

### Acceptance criteria
- [ ] Video accessible via YouTube link
- [ ] Backup link works
- [ ] README updated with embedded thumbnail
- [ ] Both video and repo discoverable from a single starting point

### Test cases — Phase 5.5

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T5.5.1 | Access | Open YouTube link in incognito | Video plays |
| T5.5.2 | Access | Open backup Drive link | Video plays |
| T5.5.3 | README | Click video thumbnail in README | Goes to YouTube |
| T5.5.4 | Mobile | Open repo on mobile | Video link still works |

---

## Phase 5.6 — Final Deliverable Verification (1 hour)

### Three-deliverable checklist

#### Deliverable 1: Working prototype/demo
- [ ] Repo can be cloned and run locally in < 10 minutes
- [ ] All features described in video actually work
- [ ] No environmental dependencies that judges won't have
- [ ] README's quick start instructions verified by a third party

#### Deliverable 2: 5-minute video walkthrough
- [ ] Video is between 4:30 and 5:15
- [ ] Hosted at a stable, accessible URL
- [ ] Linked from README
- [ ] Audio + visuals are clear

#### Deliverable 3: Code repository
- [ ] Public on GitHub/GitLab
- [ ] MIT license present
- [ ] Clean commit history
- [ ] CI passing
- [ ] No secrets committed
- [ ] Architecture diagram present
- [ ] Tagged release `v0.1.0-prototype`

### Submission package
Create `SUBMISSION.md` at repo root:
```markdown
# GridSense — Prototype Submission

## Deliverable Links
- **Live Demo Video (5 min):** [YouTube link]
- **Code Repository:** [GitHub link]
- **Quick Start Instructions:** See [README.md](./README.md)

## Team
- [Names + roles]

## What we built
[1-paragraph executive summary]

## Stack
[Brief stack mention]
```

### Test cases — Phase 5.6

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T5.6.1 | E2E | Fresh clone + setup + run | Works end-to-end in <10 min |
| T5.6.2 | E2E | Simulate theft from fresh start | Detection works first try |
| T5.6.3 | Submission | All 3 deliverable links from SUBMISSION.md | All accessible |
| T5.6.4 | Stress | Open repo on slow network | Page still loads, video works |
| T5.6.5 | Mobile | View repo + video on phone | Both functional |

---

## Phase 5.7 — Final Regression Sweep (1 hour)

### Full test suite
Run **every test from Days 1-4** one final time:

| Suite | Status |
|-------|--------|
| Day 1 (T1.x): Scaffolding, data, backend, frontend shells | [ ] All pass |
| Day 2 (T2.x): Detection, scoring, classification, ranking | [ ] All pass |
| Day 3 (T3.x): UI components, layout, integration | [ ] All pass |
| Day 4 (T4.x): Simulation, polish, docs, CI | [ ] All pass |
| Day 5 (T5.x): Recording, editing, hosting | [ ] All pass |

### Final cross-cutting regression checklist

| ID | Check | Pass criteria |
|----|-------|---------------|
| RF.1 | Anyone can clone, install, run | Following only README, in <15 min |
| RF.2 | Anyone can find the video in <30 sec | From repo homepage |
| RF.3 | Demo is reproducible | Simulate works the same way every time |
| RF.4 | All test suites still pass | Run pytest + npm tests one last time |
| RF.5 | CI is green on latest commit | Green check on GitHub |
| RF.6 | No leftover dev artifacts | No `.DS_Store`, `node_modules`, `__pycache__` committed |
| RF.7 | All links in README work | Click through every one |
| RF.8 | Video plays on Chrome, Firefox, Safari, mobile | All 4 browsers tested |
| RF.9 | Architecture diagram still accurate | Reflects actual implementation |
| RF.10 | Repo is publicly visible | Verify in incognito browser |

### Final user-acceptance scenarios

| Persona | Test scenario | Expected experience |
|---------|---------------|---------------------|
| Judge | Land on repo, watch video, skim README | Understands product in <7 min |
| Technical evaluator | Clone repo, run locally | Works, sees same demo as in video |
| BESCOM stakeholder | Watch only the video | Understands the value prop without code |
| Open source contributor | Browse codebase | Code is readable, structure is clear |

---

## Phase 5.8 — Submit & Document (15 min)

### Tasks
1. Submit deliverables via the official channel (Devfolio, Google Form, email — whichever was instructed)
2. Include in submission:
   - Repository URL
   - Video URL (primary + backup)
   - Brief 100-word abstract
   - Team contact info
3. Take a confirmation screenshot
4. Send team a "shipped" message with all links
5. Tag the moment: `git tag submission-final && git push --tags`

### Acceptance criteria
- [ ] Submission confirmed received (screenshot saved)
- [ ] Backup of all materials in shared drive
- [ ] Team notified

---

## Day 5 Definition of Done

- [ ] All 3 deliverables submitted and verified accessible
- [ ] Video is high-quality and on-message
- [ ] Repo passes all regression tests
- [ ] Submission confirmation received
- [ ] Team has shared access to all materials

---

## Post-Submission

### Immediate
- Celebrate. Seriously, take a break.
- Tag any lessons learned for the next round

### Within 48 hours (if selected for next round)
- Review judges' feedback
- Plan what to expand in Final Round (real meter integration? scaling tests? UI improvements?)

### Future-proofing
- Keep the demo URL active for 90 days minimum
- Don't push breaking changes to `main` until results announced
- Consider creating a `v0.1.0-prototype` branch to freeze the submitted state
