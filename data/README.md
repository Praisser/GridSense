# Synthetic Data Generated for GridSense

This dataset contains synthetic smart meter readings for a single feeder (F001) over 7 days at 15-minute intervals. The reading window starts at `2024-01-01 00:00:00` and ends at `2024-01-07 23:45:00`.

## Injected Anomalies

The following events were deliberately injected to simulate theft:

1. **Meter M07**: Bypass theft starts at `2024-01-04 00:00:00` (Day 4). Reported consumption drops by 60%.
2. **Meter M13**: Meter tampering starts at `2024-01-05 00:00:00` (Day 5). Readings flat-line at a suspiciously low value of 0.05 kWh.
3. **Meters M15 to M18**: Neighborhood organized theft starts at `2024-01-06 00:00:00` (Day 6). Clustered readings drop by 70%.

Because the feeder input continues to reflect true consumption plus 4-7% technical loss, these events will create an observable gap between total metered consumption and feeder supply, triggering alerts.
