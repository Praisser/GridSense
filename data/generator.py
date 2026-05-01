import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

np.random.seed(42)

def generate_data():
    num_meters = 20
    days = 7
    intervals_per_day = 24 * 4
    total_intervals = days * intervals_per_day
    
    start_date = datetime(2024, 1, 1)
    timestamps = [start_date + timedelta(minutes=15 * i) for i in range(total_intervals)]
    
    base_lat = 12.9716
    base_lng = 77.5946
    
    meter_ids = [f"M{i:02d}" for i in range(1, num_meters + 1)]
    meter_lats = np.random.normal(base_lat, 0.002, num_meters)
    meter_lngs = np.random.normal(base_lng, 0.002, num_meters)
    
    profiles = np.random.choice(['low', 'medium', 'high'], num_meters)
    profile_multipliers = {'low': 0.5, 'medium': 1.0, 'high': 1.8}
    
    records = []
    feeder_totals = {ts: 0.0 for ts in timestamps}
    
    for i, m_id in enumerate(meter_ids):
        mult = profile_multipliers[profiles[i]]
        
        for t_idx, ts in enumerate(timestamps):
            hour = ts.hour
            base_kwh = 0.1 * mult
            
            # Peaks: 6-10 AM and 6-11 PM (18-23)
            if 6 <= hour < 10:
                base_kwh += np.random.normal(0.4, 0.1) * mult
            elif 18 <= hour < 23:
                base_kwh += np.random.normal(0.6, 0.15) * mult
            else:
                base_kwh += np.random.normal(0.05, 0.02) * mult
            
            true_kwh = max(0.0, base_kwh)
            meter_kwh = true_kwh
            
            day_idx = t_idx // intervals_per_day
            
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
        loss_pct = np.random.uniform(0.04, 0.07)
        feeder_kwh = true_total * (1 + loss_pct)
        feeder_records.append({
            'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
            'feeder_id': 'F001',
            'kwh': round(feeder_kwh, 4)
        })
        
    df_meters = pd.DataFrame(records)
    df_feeder = pd.DataFrame(feeder_records)
    
    os.makedirs('data', exist_ok=True)
    df_meters.to_csv('data/meters.csv', index=False)
    df_feeder.to_csv('data/feeder_input.csv', index=False)
    print("Generated meters.csv and feeder_input.csv")

if __name__ == '__main__':
    generate_data()
