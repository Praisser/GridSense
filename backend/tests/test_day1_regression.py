import hashlib
import math
import sys
import unittest
from pathlib import Path

import pandas as pd
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from app.data_loader import data_loader
from app.main import app, get_alerts, get_feeder_readings
from data import generator


class Day1DataPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generator.generate_data()
        cls.meters = pd.read_csv(ROOT / "data" / "meters.csv", parse_dates=["timestamp"])
        cls.feeder = pd.read_csv(ROOT / "data" / "feeder_input.csv", parse_dates=["timestamp"])

    def test_generator_outputs_are_reproducible(self):
        generator.generate_data()
        first = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in (ROOT / "data" / "meters.csv", ROOT / "data" / "feeder_input.csv")
        }

        generator.generate_data()
        second = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in (ROOT / "data" / "meters.csv", ROOT / "data" / "feeder_input.csv")
        }

        self.assertEqual(first, second)

    def test_generated_csv_shapes_and_cadence_match_spec(self):
        self.assertEqual(len(self.feeder), 672)
        self.assertEqual(len(self.meters), 13_440)
        self.assertEqual(self.meters["meter_id"].nunique(), 20)
        self.assertEqual(self.feeder["feeder_id"].unique().tolist(), ["F001"])
        self.assertFalse((self.meters["kwh"] < 0).any())
        self.assertFalse((self.feeder["kwh"] < 0).any())

        feeder_deltas = self.feeder["timestamp"].sort_values().diff().dropna().dt.total_seconds()
        self.assertEqual(set(feeder_deltas), {900.0})
        for _, group in self.meters.groupby("meter_id"):
            deltas = group["timestamp"].sort_values().diff().dropna().dt.total_seconds()
            self.assertEqual(set(deltas), {900.0})

    def test_meter_coordinates_stay_inside_500m_square(self):
        lat_span_m = (self.meters["lat"].max() - self.meters["lat"].min()) * 111_320
        lng_span_m = (
            (self.meters["lng"].max() - self.meters["lng"].min())
            * 111_320
            * math.cos(math.radians(12.9716))
        )

        self.assertLessEqual(lat_span_m, 500)
        self.assertLessEqual(lng_span_m, 500)

    def test_daily_patterns_have_morning_and_evening_peaks(self):
        normal = self.meters[self.meters["timestamp"] < pd.Timestamp("2024-01-04")].copy()
        normal["hour"] = normal["timestamp"].dt.hour

        overnight = normal[normal["hour"].between(0, 5)]["kwh"].mean()
        morning = normal[normal["hour"].between(6, 9)]["kwh"].mean()
        evening = normal[normal["hour"].between(18, 22)]["kwh"].mean()

        self.assertGreater(morning, overnight * 2)
        self.assertGreater(evening, overnight * 2)

    def test_injected_anomalies_create_required_gap_by_day4(self):
        meter_sum = self.meters.groupby("timestamp")["kwh"].sum()
        combined = (
            self.feeder.set_index("timestamp")[["kwh"]]
            .rename(columns={"kwh": "feeder"})
            .join(meter_sum.rename("meters"))
        )
        combined["gap_pct"] = (combined["feeder"] - combined["meters"]) / combined["feeder"] * 100

        day1 = combined.loc["2024-01-01"]["gap_pct"].mean()
        day4 = combined.loc["2024-01-04"]["gap_pct"].mean()

        self.assertGreaterEqual(day1, 4)
        self.assertLessEqual(day1, 7)
        self.assertGreater(day4, 10)

    def test_specific_anomaly_shapes_match_spec(self):
        meters = self.meters.copy()
        meters["day"] = (meters["timestamp"] - meters["timestamp"].min()).dt.days + 1

        m07 = meters[meters["meter_id"] == "M07"]
        baseline = m07[m07["day"].between(1, 3)]["kwh"].mean()
        day4 = m07[m07["day"] == 4]["kwh"].mean()
        self.assertGreater((1 - day4 / baseline), 0.55)

        m13 = meters[(meters["meter_id"] == "M13") & (meters["day"] >= 5)]
        self.assertLess(m13["kwh"].std(), 0.1)


class Day1ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generator.generate_data()
        data_loader.load_data()

    def test_feeder_readings_endpoint_returns_full_week(self):
        readings = get_feeder_readings("F001")
        self.assertEqual(len(readings), 672)

    def test_feeder_readings_date_filter_returns_one_day_for_exclusive_end_date(self):
        readings = get_feeder_readings("F001", start="2024-01-02", end="2024-01-03")
        self.assertEqual(len(readings), 96)
        self.assertEqual(readings[0]["timestamp"], "2024-01-02 00:00:00")
        self.assertEqual(readings[-1]["timestamp"], "2024-01-02 23:45:00")

    def test_invalid_feeder_and_malformed_date_errors_match_spec(self):
        with self.assertRaises(HTTPException) as invalid_feeder:
            get_feeder_readings("INVALID")
        self.assertEqual(invalid_feeder.exception.status_code, 404)

        with self.assertRaises(HTTPException) as malformed_date:
            get_feeder_readings("F001", start="not-a-date")
        self.assertEqual(malformed_date.exception.status_code, 422)

    def test_alerts_and_cors_are_configured(self):
        self.assertEqual(get_alerts(), [])

        cors = next(
            middleware
            for middleware in app.user_middleware
            if middleware.cls.__name__ == "CORSMiddleware"
        )
        self.assertIn("http://localhost:5173", cors.kwargs["allow_origins"])


class Day1DocsTests(unittest.TestCase):
    def test_data_readme_documents_exact_anomaly_timestamps(self):
        text = (ROOT / "data" / "README.md").read_text()

        self.assertIn("2024-01-04 00:00:00", text)
        self.assertIn("2024-01-05 00:00:00", text)
        self.assertIn("2024-01-06 00:00:00", text)

    def test_required_docs_png_artifacts_exist(self):
        for relative_path in ("docs/architecture.png", "docs/day1_shell.png"):
            artifact = ROOT / relative_path
            self.assertTrue(artifact.exists(), relative_path)
            self.assertGreater(artifact.stat().st_size, 0, relative_path)


if __name__ == "__main__":
    unittest.main()
