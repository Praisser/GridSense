import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path


def generate_data(seed=42, output_dir=None):
    rng = np.random.default_rng(seed)
    num_meters = 20
    days = 7
    intervals_per_day = 24 * 4
    total_intervals = days * intervals_per_day
    
    start_date = datetime(2024, 1, 1)
    timestamps = [start_date + timedelta(minutes=15 * i) for i in range(total_intervals)]
    
    base_lat = 12.9716
    base_lng = 77.5946
    
    meter_ids = [f"M{i:02d}" for i in range(1, num_meters + 1)]
    cluster_half_width_m = 240
    lat_delta = cluster_half_width_m / 111_320
    lng_delta = cluster_half_width_m / (111_320 * np.cos(np.radians(base_lat)))
    meter_lats = base_lat + rng.uniform(-lat_delta, lat_delta, num_meters)
    meter_lngs = base_lng + rng.uniform(-lng_delta, lng_delta, num_meters)
    
    profiles = np.array([
        'low', 'medium', 'low', 'medium', 'medium',
        'low', 'high', 'medium', 'low', 'medium',
        'low', 'medium', 'medium', 'low', 'medium',
        'medium', 'low', 'medium', 'low', 'high'
    ])
    profile_multipliers = {'low': 0.55, 'medium': 1.0, 'high': 2.8}
    
    records = []
    feeder_totals = {ts: 0.0 for ts in timestamps}
    
    for i, m_id in enumerate(meter_ids):
        mult = profile_multipliers[profiles[i]]
        
        for t_idx, ts in enumerate(timestamps):
            hour = ts.hour + ts.minute / 60
            day_idx = t_idx // intervals_per_day

            daily_wave = 0.12 * np.sin(2 * np.pi * (hour - 6) / 24)
            weekly_wave = 0.05 * np.sin(2 * np.pi * day_idx / 7)
            morning_peak = np.exp(-((hour - 8) ** 2) / (2 * 1.35 ** 2))
            evening_peak = np.exp(-((hour - 20.5) ** 2) / (2 * 1.9 ** 2))

            base_kwh = 0.12 * mult
            pattern = 0.72 + daily_wave + weekly_wave + 1.55 * morning_peak + 2.1 * evening_peak
            true_kwh = max(0.0, base_kwh * pattern + rng.normal(0, 0.015 * mult))
            meter_kwh = true_kwh
            
            # Anomalies
            # M07 bypass Day 4 (Day idx 3)
            if m_id == 'M07' and day_idx >= 3:
                meter_kwh *= 0.4
                
            # M13 tampered Day 5 (Day idx 4)
            if m_id == 'M13' and day_idx >= 4:
                meter_kwh = 0.05
                
            # M15-M18 theft Day 6 (Day idx 5)
            if m_id in ['M15', 'M16', 'M17', 'M18'] and day_idx >= 5:
                meter_kwh *= 0.3
                
            records.append({
                'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
                'meter_id': m_id,
                'kwh': round(meter_kwh, 4),
                'lat': round(meter_lats[i], 6),
                'lng': round(meter_lngs[i], 6)
            })
            
            # Feeder supplies the TRUE consumption
            feeder_totals[ts] += true_kwh
            
    # Feeder data
    feeder_records = []
    for ts in timestamps:
        true_total = feeder_totals[ts]
        # add 4-7% technical loss
        loss_pct = rng.uniform(0.04, 0.07)
        feeder_kwh = true_total * (1 + loss_pct)
        feeder_records.append({
            'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
            'feeder_id': 'F001',
            'kwh': round(feeder_kwh, 4)
        })
        
    df_meters = pd.DataFrame(records)
    df_feeder = pd.DataFrame(feeder_records)
    
    data_dir = Path(output_dir) if output_dir else Path(__file__).resolve().parent
    data_dir.mkdir(parents=True, exist_ok=True)
    df_meters.to_csv(data_dir / 'meters.csv', index=False)
    df_feeder.to_csv(data_dir / 'feeder_input.csv', index=False)
    print("Generated meters.csv and feeder_input.csv")

if __name__ == '__main__':
    generate_data()
