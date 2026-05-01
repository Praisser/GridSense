# Synthetic Data Generated for GridSense

This dataset contains synthetic smart meter readings for a single feeder (F001) over 7 days at 15-minute intervals. 

## Injected Anomalies

The following events were deliberately injected to simulate theft:

1. **Meter M07**: Bypass theft starting on **Day 4** (consumption drops by 60%).
2. **Meter M13**: Meter tampering starting on **Day 5** (flat-line readings at suspiciously low value of 0.05 kWh).
3. **Meters M15 to M18**: Neighborhood organized theft starting on **Day 6** (clustered drop in readings by 70%).

Because the feeder input continues to reflect true consumption plus 4-7% technical loss, these events will create an observable gap between total metered consumption and feeder supply, triggering alerts.