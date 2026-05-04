# GridSense Demo Script (5 Minutes)

## 0:00–0:30 — Hook + Problem
"India loses ₹26,000 crore yearly to electricity theft. Most goes undetected for months. Why? Existing systems watch one meter at a time—a tampered meter just looks like a low-consumption customer. We need to look at the whole picture."

## 0:30–1:00 — The Insight: "Watch the Gap"
"Theft doesn't disappear. It shows up as a gap between feeder supply and meter aggregate. GridSense doesn't just watch the meter; it watches that gap. When we see consumption drop while the gap increases, we know we've found theft."

## 1:00–1:30 — Architecture Overview
(Show the Mermaid diagram or Architecture PNG)
"Our pipeline combines smart meter data with feeder telemetry. We use Isolation Forest for anomaly scoring and a heuristic classifier to fingerprint specific loss types: bypass, tampering, or faulty hardware."

## 1:30–2:30 — Dashboard Walkthrough
"This is the GridSense Dashboard. On the left, our AI-ranked alerts. Notice M07—it's flagged as 'Bypass Theft' with 85% confidence. On the map, we can see the cluster of alerts in the North Bangalore feeder zone."

## 2:30–3:30 — Live Simulation
"Now, let's see GridSense in action. I'll open the Simulation tool. Let's take M03, which is currently healthy. I'll inject a 'Bypass' theft at 80% intensity."
(Click Run Simulation)
"The theft is injected into the live stream. GridSense is now processing the new gap. Within seconds..."
(Wait for alert)
"...there it is. M03 has moved to the top of our alert feed. The system detected the sudden drop and correlated it with the increased feeder gap."

## 3:30–4:30 — Detail View & Impact
"By clicking the alert, field officers get clear reasoning: 'Significant consumption drop detected, strongly correlated with feeder gap.' This drops investigation time from weeks to hours."

## 4:30–5:00 — Conclusion
"GridSense scales across existing infrastructure with no hardware changes. It's the intelligence layer that turns raw meter data into actionable recovery for utilities. Thank you."
