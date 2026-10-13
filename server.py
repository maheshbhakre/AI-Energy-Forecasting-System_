import json
import math
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "energy.csv"
MODEL_PATH = ROOT / "models" / "energy_model.pkl"
DAYPARTS = [
    ("Night", range(0, 6), "#6374e8"),
    ("Morning", range(6, 12), "#36c9b7"),
    ("Afternoon", range(12, 18), "#ab82ff"),
    ("Evening", range(18, 24), "#ff9c6c"),
]
INDIA_TZ = timezone(timedelta(hours=5, minutes=30))
GRID_DEMAND_URL = "https://npp.gov.in/dashBoard/demandmet1chartdata?date={date}"
GRID_CACHE_SECONDS = 60
_grid_cache = {"fetched_at": 0.0, "data": None}
_grid_cache_lock = Lock()


def load_data_and_model():
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"Energy dataset not found: {DATA_PATH}")
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Trained model not found: {MODEL_PATH}. Run `python main.py` first."
        )

    data = pd.read_csv(DATA_PATH, parse_dates=["Datetime"])
    if not {"Datetime", "Energy"}.issubset(data.columns):
        raise ValueError("The dataset must contain Datetime and Energy columns.")

    data = data.dropna(subset=["Datetime", "Energy"]).set_index("Datetime")
    data["Energy"] = pd.to_numeric(data["Energy"], errors="coerce")
    data = data.dropna(subset=["Energy"]).sort_index()
    data = data.resample("h").mean().ffill().dropna(subset=["Energy"])
    if data.empty:
        raise ValueError("The energy dataset contains no usable readings.")
    model = joblib.load(MODEL_PATH)
    return data, model


def features_for(index):
    return pd.DataFrame({"hour": index.hour, "day": index.dayofweek}, index=index)


def percent_change(current, previous):
    if not previous or not math.isfinite(previous):
        return 0.0
    return round(((current - previous) / abs(previous)) * 100, 1)


def fetch_india_grid_demand():
    with _grid_cache_lock:
        now = time.monotonic()
        if _grid_cache["data"] and now - _grid_cache["fetched_at"] < GRID_CACHE_SECONDS:
            return _grid_cache["data"]

        today_in_india = datetime.now(INDIA_TZ).date()
        latest_error = "The official portal has no recent demand readings available."
        for days_back in range(4):
            report_date = today_in_india - timedelta(days=days_back)
            date_text = report_date.isoformat()
            request = Request(
                GRID_DEMAND_URL.format(date=date_text),
                headers={"User-Agent": "WattwiseEnergyDashboard/1.0"},
            )
            try:
                with urlopen(request, timeout=12) as response:
                    records = json.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                if error.code == 404:
                    continue
                latest_error = f"The official portal returned HTTP {error.code}."
                continue
            except (URLError, TimeoutError) as error:
                latest_error = f"Could not reach the official data portal: {error}"
                break
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                latest_error = f"The official data response could not be read: {error}"
                break

            if not isinstance(records, list):
                latest_error = "The official portal returned an unexpected data format."
                break

            readings = []
            for record in records:
                try:
                    timestamp_ms = int(record["updated_on"])
                    demand_mw = float(record["value_of_data"])
                    timestamp = datetime.fromtimestamp(
                        timestamp_ms / 1000, timezone.utc
                    ).astimezone(INDIA_TZ)
                except (KeyError, TypeError, ValueError, OSError, OverflowError):
                    continue
                if (
                    timestamp.date() == report_date
                    and math.isfinite(demand_mw)
                    and demand_mw > 0
                ):
                    readings.append((timestamp, demand_mw))

            if not readings:
                continue

            readings.sort(key=lambda item: item[0])
            latest_time, latest_demand = readings[-1]
            demands = [value for _, value in readings]
            grid_data = {
                "status": "available",
                "region": "All India",
                "source": "National Power Portal / CEA / MERIT India",
                "source_url": "https://npp.gov.in/dashBoard/gc-map-dashboard-meritchart",
                "unit": "MW",
                "report_date": report_date.isoformat(),
                "latest_timestamp": latest_time.isoformat(timespec="minutes"),
                "latest_demand_mw": round(latest_demand, 1),
                "peak_demand_mw": round(max(demands), 1),
                "average_demand_mw": round(sum(demands) / len(demands), 1),
                "reading_count": len(readings),
                "chart": [
                    {
                        "timestamp": timestamp.isoformat(timespec="minutes"),
                        "label": timestamp.strftime("%H:%M"),
                        "demand_mw": round(demand, 1),
                    }
                    for timestamp, demand in readings
                ],
            }
            _grid_cache.update(fetched_at=time.monotonic(), data=grid_data)
            return grid_data

        grid_data = {"status": "unavailable", "error": latest_error}
        _grid_cache.update(fetched_at=time.monotonic(), data=grid_data)
        return grid_data


def hour_label(value):
    return value.strftime("%I %p").lstrip("0")


def make_dashboard(period):
    data, model = load_data_and_model()
    hours = 168 if period == "7d" else 24
    history = data.tail(hours).copy()
    history_prediction = np.maximum(model.predict(features_for(history.index)), 0)
    historical_values = history["Energy"].to_numpy(dtype=float)
    actual_total = float(historical_values.sum())
    actual_mean = float(historical_values.mean())
    _, test_features, _, test_actual = train_test_split(
        features_for(data.index),
        data["Energy"],
        test_size=0.2,
        random_state=42,
    )
    test_prediction = model.predict(test_features)
    mae = float(np.mean(np.abs(test_actual.to_numpy() - test_prediction)))
    accuracy = max(
        0.0,
        min(100.0, 100.0 * (1 - mae / max(float(test_actual.mean()), 1e-9))),
    )

    previous = data.iloc[max(0, len(data) - 2 * hours):len(data) - hours]["Energy"]
    previous_total = float(previous.sum()) if not previous.empty else actual_total
    history_rows = []
    for stamp, actual, predicted in zip(history.index, historical_values, history_prediction):
        history_rows.append({
            "timestamp": stamp.isoformat(),
            "label": stamp.strftime("%H:%M") if period == "24h" else stamp.strftime("%b %d"),
            "actual": round(float(actual), 2),
            "forecast": round(float(predicted), 2),
        })

    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    future_index = pd.date_range(now + timedelta(hours=1), periods=24, freq="h")
    future_predictions = np.maximum(model.predict(features_for(future_index)), 0)
    for stamp, prediction in zip(future_index, future_predictions):
        history_rows.append({
            "timestamp": stamp.isoformat(),
            "label": stamp.strftime("%H:%M") if period == "24h" else stamp.strftime("%b %d"),
            "actual": None,
            "forecast": round(float(prediction), 2),
        })

    hourly_average = data.groupby(data.index.hour)["Energy"].mean().reindex(range(24))
    typical_peak_hour = int(hourly_average.idxmax())
    hourly_profile = [
        {
            "hour": hour,
            "label": f"{hour:02d}",
            "average": round(float(hourly_average.loc[hour]), 2),
            "is_peak": hour == typical_peak_hour,
        }
        for hour in range(24)
    ]

    daypart_values = []
    for name, hour_range, color in DAYPARTS:
        energy = float(data.loc[data.index.hour.isin(hour_range), "Energy"].sum())
        daypart_values.append({"name": name, "energy": energy, "color": color})
    total_daypart_energy = sum(item["energy"] for item in daypart_values)
    daypart_share = [
        {
            "name": item["name"],
            "share": round(100 * item["energy"] / total_daypart_energy, 1) if total_daypart_energy else 0,
            "color": item["color"],
        }
        for item in daypart_values
    ]

    peak_position = int(np.argmax(historical_values))
    peak_value = float(historical_values[peak_position])
    high_demand_threshold = float(np.quantile(historical_values, 0.9))
    forecast_mean = float(future_predictions.mean())
    typical_peak_text = hour_label(datetime(2000, 1, 1, typical_peak_hour))
    next_hours = []
    for stamp, prediction in zip(future_index[:6], future_predictions[:6]):
        next_hours.append({
            "timestamp": stamp.isoformat(),
            "time": hour_label(stamp),
            "forecast": round(float(prediction), 2),
            "status": "High" if prediction > high_demand_threshold else "Normal",
        })

    insights = [
        {
            "tone": "green",
            "title": "A good time to shift flexible tasks",
            "description": f"Your typical demand is lighter around {hour_label(datetime(2000, 1, 1, (typical_peak_hour + 10) % 24))}.",
        },
        {
            "tone": "orange",
            "title": "Keep an eye on your peak hour",
            "description": f"Your highest recent reading was {peak_value:.1f} kWh at {hour_label(history.index[peak_position])}.",
        },
        {
            "tone": "violet",
            "title": "Plan ahead with the daily outlook",
            "description": f"The model expects about {sum(future_predictions):.0f} kWh over the next 24 hours.",
        },
    ]

    return {
        "source": "data/energy.csv",
        "period": period,
        "generated_at": datetime.now().astimezone().isoformat(),
        "india_grid": fetch_india_grid_demand(),
        "history_coverage": (
            f"{history.index[0].strftime('%b %d, %Y')} – "
            f"{history.index[-1].strftime('%b %d, %Y')} · "
            f"{len(history)} hourly readings"
        ),
        "chart": history_rows,
        "hourly_profile": hourly_profile,
        "daypart_share": daypart_share,
        "next_hours": next_hours,
        "insights": insights,
        "metrics": {
            "period_energy": round(actual_total, 2),
            "energy_change": percent_change(actual_total, previous_total),
            "accuracy": round(accuracy, 1),
            "accuracy_change": None,
            "peak_demand": round(peak_value, 2),
            "peak_change": None,
            "peak_time": history.index[peak_position].strftime("%b %d · %H:%M"),
            "next_day_forecast": round(float(future_predictions.sum()), 2),
            "average_hourly": round(actual_mean, 2),
            "typical_peak_time": typical_peak_text,
            "mean_absolute_error": round(mae, 2),
            "forecast_average": round(forecast_mean, 2),
        },
    }


class DashboardHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        request = urlparse(self.path)
        if request.path == "/api/health":
            self.send_json(200, {"status": "ok"})
            return
        if request.path != "/api/dashboard":
            self.send_json(404, {"error": "Endpoint not found."})
            return

        period = parse_qs(request.query).get("period", ["24h"])[0]
        if period not in {"24h", "7d"}:
            self.send_json(400, {"error": "Period must be either 24h or 7d."})
            return
        try:
            self.send_json(200, make_dashboard(period))
        except (FileNotFoundError, ValueError, KeyError) as error:
            self.send_json(500, {"error": str(error)})
        except Exception:
            self.log_error("Unexpected dashboard error")
            self.send_json(500, {"error": "Unable to prepare the energy dashboard."})

    def send_json(self, status, payload):
        body = json.dumps(payload, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        print(f"[dashboard] {self.address_string()} - {format_string % args}")


if __name__ == "__main__":
    host, port = "127.0.0.1", 8000
    server = ThreadingHTTPServer((host, port), DashboardHandler)
    print(f"Energy dashboard API listening at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dashboard API...")
    finally:
        server.server_close()
