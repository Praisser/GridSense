# Day 2 — Core AI Logic: Gap Detection & Loss Fingerprinting

**Goal:** Implement the brain of GridSense. By end of day, the `/api/alerts` endpoint returns a ranked list of suspicious meters with loss type and confidence score, derived from the synthetic data.

**Time budget:** ~8 hours

---

## Phase 2.1 — Gap Detection Engine (2 hours)

### Concept
For each 15-minute time window, compute:
```
gap = feeder_input - sum(all meter readings)
gap_ratio = gap / feeder_input
```
A `gap_ratio` above the technical-loss threshold (~7%) signals theft or fault.

### Tasks
1. Create `backend/app/detection/gap_detector.py`
2. Implement `compute_gaps(feeder_df, meters_df) -> DataFrame`:
   - Aligns timestamps between feeder and aggregated meter data
   - Returns DataFrame with columns: `timestamp, feeder_kwh, meter_sum_kwh, gap_kwh, gap_ratio`
3. Implement `flag_gap_windows(gap_df, threshold=0.07) -> List[GapWindow]`:
   - Returns contiguous time windows where `gap_ratio > threshold`
   - Each window has `start, end, peak_gap_ratio, total_kwh_lost`
4. Add caching: recompute only when underlying data changes

### Acceptance criteria
- [ ] On normal Day 1-3 data, returns 0 flagged windows
- [ ] On theft Day 4+ data, returns at least 1 flagged window for M07
- [ ] On Day 6, detects the M15-M18 cluster anomaly
- [ ] Computation completes in < 2 seconds for 7-day dataset

### Test cases — Phase 2.1

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T2.1.1 | Unit | `compute_gaps` with identical feeder=meter sum | All gap_ratio values ≈ 0 |
| T2.1.2 | Unit | `compute_gaps` with feeder=2× meter sum | All gap_ratio values = 0.5 |
| T2.1.3 | Unit | `flag_gap_windows` with all values < threshold | Returns empty list |
| T2.1.4 | Unit | `flag_gap_windows` with one continuous spike | Returns single window with correct duration |
| T2.1.5 | Unit | `flag_gap_windows` with two separate spikes | Returns 2 windows |
| T2.1.6 | Edge case | Empty input DataFrame | Returns empty list, no exception |
| T2.1.7 | Edge case | Single row input | Handles gracefully, returns valid result |
| T2.1.8 | Integration | Run on full synthetic dataset | Detects all 3 injected theft events |

---

## Phase 2.2 — Per-Meter Anomaly Scoring with Isolation Forest (2 hours)

### Concept
For each meter, train an Isolation Forest on its first 3 days of consumption (assumed clean baseline) and score the remaining days. Higher anomaly score = more suspicious.

### Tasks
1. Create `backend/app/detection/meter_scorer.py`
2. Implement `extract_features(meter_df) -> np.ndarray`:
   - Per-window features: `kwh, hour_of_day, day_of_week, rolling_mean_24h, rolling_std_24h`
3. Implement `train_meter_model(meter_df, train_days=3) -> IsolationForest`
4. Implement `score_meter(model, meter_df) -> DataFrame` with columns: `timestamp, anomaly_score, is_anomaly`
5. Implement `score_all_meters(meters_df) -> Dict[meter_id, DataFrame]`
6. Persist trained models to `backend/models/{meter_id}.joblib` to avoid retraining

### Acceptance criteria
- [ ] M07 has highest cumulative anomaly score after Day 4
- [ ] M13 (flat-line) is detected with high anomaly score
- [ ] Normal meters (M01-M06, M08-M12) have low average anomaly scores
- [ ] All 20 meters can be scored in < 10 seconds total

### Test cases — Phase 2.2

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T2.2.1 | Unit | `extract_features` output shape | 5 columns per row |
| T2.2.2 | Unit | `extract_features` with NaN inputs | Imputes or drops gracefully |
| T2.2.3 | Unit | Train model on identical readings | Model trains without crash |
| T2.2.4 | Unit | Score normal meter against own baseline | Avg anomaly score < 0.1 |
| T2.2.5 | Behavioral | Score M07 (theft) | Avg anomaly score > 0.3 in theft window |
| T2.2.6 | Behavioral | Score M13 (flat) | Anomaly flag triggered on Day 5+ |
| T2.2.7 | Persistence | Save and reload model | Predictions match before/after pickle |
| T2.2.8 | Performance | Score all 20 meters | Completes in < 10s |

---

## Phase 2.3 — Loss Type Classifier (1.5 hours)

### Concept
Once a meter is flagged anomalous, classify the *type* of loss using rule-based fingerprints (deep ML overkill for prototype).

### Loss type rules

| Type | Signature |
|------|-----------|
| `meter_tampering` | Sudden 40-80% drop in consumption from baseline; pattern still has daily rhythm |
| `bypass_theft` | Consumption drops AND coincides with feeder gap appearing |
| `faulty_meter` | Standard deviation of readings drops below 0.1 (flat-line) |
| `billing_anomaly` | Reading aggregation mismatch (skip for prototype, mock it) |

### Tasks
1. Create `backend/app/detection/loss_classifier.py`
2. Implement `classify_loss_type(meter_id, meter_df, gap_df, baseline_df) -> dict`:
   - Returns `{"type": str, "confidence": float, "reasoning": str}`
3. `reasoning` field is a human-readable explanation (used by field officers in the UI)

### Acceptance criteria
- [ ] M07 classified as `bypass_theft` with confidence > 0.7
- [ ] M13 classified as `faulty_meter` with confidence > 0.8
- [ ] M15-M18 classified as `meter_tampering` (clustered)
- [ ] Each classification includes a non-empty `reasoning` string

### Test cases — Phase 2.3

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T2.3.1 | Unit | Flat-line input | Returns `faulty_meter` type |
| T2.3.2 | Unit | 60% drop with feeder gap | Returns `bypass_theft` type |
| T2.3.3 | Unit | 50% drop without feeder gap | Returns `meter_tampering` type |
| T2.3.4 | Unit | Normal meter input | Returns `none` or low-confidence result |
| T2.3.5 | Boundary | Drop of exactly 40% | Returns valid type, confidence around 0.5 |
| T2.3.6 | Output | Reasoning field length | Between 20 and 200 characters |
| T2.3.7 | Output | Confidence value | Always between 0.0 and 1.0 |

---

## Phase 2.4 — Risk Ranking & Alerts API (1.5 hours)

### Tasks
1. Create `backend/app/detection/ranker.py`
2. Implement `rank_meters(scores, classifications, gaps) -> List[Alert]`:
   - Composite score: `0.4 × anomaly_score + 0.4 × classification_confidence + 0.2 × gap_contribution`
   - Sort descending by composite score
3. Wire into `GET /api/alerts` endpoint:
   - Returns top N alerts (default 10, query param `limit`)
   - Each alert: `{meter_id, lat, lng, loss_type, confidence, reasoning, last_anomaly_at, total_kwh_lost}`
4. Add `GET /api/alerts/{meter_id}` for drill-down

### Acceptance criteria
- [ ] `/api/alerts` returns the 3-7 expected anomalous meters in top positions
- [ ] M07, M13 in top 3 results
- [ ] Each alert has all required fields
- [ ] Endpoint responds in < 1 second

### Test cases — Phase 2.4

| Test ID | Type | Description | Expected result |
|---------|------|-------------|-----------------|
| T2.4.1 | Integration | GET `/api/alerts` | 200 with array of alerts |
| T2.4.2 | Integration | Top alert | Is M07 or M13 |
| T2.4.3 | Integration | GET `/api/alerts?limit=5` | Returns exactly 5 alerts |
| T2.4.4 | Integration | GET `/api/alerts/M07` | Returns single alert with details |
| T2.4.5 | Integration | GET `/api/alerts/M01` (normal) | Returns alert with low confidence or 404 |
| T2.4.6 | Validation | Each alert has lat/lng | Coordinates are within expected bounds |
| T2.4.7 | Validation | Each alert has reasoning | Non-empty string |
| T2.4.8 | Performance | Cold start full pipeline | Completes in < 5 seconds |

---

## Phase 2.5 — End-of-Day Integration Test (1 hour)

### Full pipeline test
1. Start backend
2. Hit `/api/alerts` — verify returns ranked list
3. Hit `/api/alerts/M07` — verify drill-down works
4. Sanity-check: do the *reasonings* make sense to a non-technical reader?
5. Compare results to ground truth (M07, M13, M15-M18 should rank highest)
6. Commit: `feat(day2): gap detection, anomaly scoring, loss classification, ranking`

### Day 2 regression checklist (cumulative — Day 1 + Day 2)

| ID | Check | Pass criteria |
|----|-------|---------------|
| R2.1 | All Day 1 tests still pass | Run T1.x suite, all green |
| R2.2 | Pipeline is deterministic | Run alerts API twice, identical output |
| R2.3 | Detection works for all 3 injected theft types | bypass, tampering, faulty |
| R2.4 | No false positives on normal meters | M01-M06, M08-M12 below threshold |
| R2.5 | Pipeline runs in CI-like fresh env | Fresh venv → install → tests pass |
| R2.6 | Memory usage reasonable | Process under 500 MB |
| R2.7 | API still responds to health check | `/health` still works |

### Day 2 integration test scenarios

| Scenario | Setup | Expected behavior |
|----------|-------|-------------------|
| Happy path | All services up, full data | Alerts return in ranked order |
| No anomalies | Replace data with clean version | Alerts list is empty or all low-confidence |
| Stress test | Generate 100 meters × 30 days | Pipeline still completes < 30s |
| Data corruption | Delete random 1% of meter readings | Pipeline handles missing data gracefully |
| Threshold tuning | Lower threshold to 3% | More alerts surface; no crashes |

---

## Day 2 Definition of Done

- [ ] All Phase 2.1-2.5 acceptance criteria met
- [ ] All test cases pass (T2.x suite + R2.x regression)
- [ ] `/api/alerts` returns useful, ranked, explainable results
- [ ] Code pushed with descriptive commits
- [ ] Brief notes added to README under "Detection methodology"

## Hand-off to Day 3

Day 3 takes the working alerts API and builds the visual dashboard. Backend stays frozen; frontend gets all the focus.
