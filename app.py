import hmac
import os
import threading
from datetime import datetime, timezone

from flask import Flask, abort, jsonify, render_template, request, send_from_directory

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024  # telemetry bodies are tiny; reject anything larger

# Set TELEMETRY_API_KEY in the hosting dashboard. When set, the ESP32 must send it
# in the X-API-Key header. When empty (local testing only), no key is required.
API_KEY = os.environ.get("TELEMETRY_API_KEY", "")
ONLINE_WINDOW_S = 5

_lock = threading.Lock()
latest_data = {
    "distance_cm": None,
    "battery": None,
    "obstacle": False,
    "wifi_ip": None,
    "updated_at": None,
}
last_seen = None

STATIC_EXT = {".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"}


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/healthz")
def healthz():
    return "ok", 200


# Lets index.html reference files as "app.js" or "/static/app.js" - both work.
@app.get("/<path:name>")
def root_static(name):
    if os.path.splitext(name)[1].lower() not in STATIC_EXT:
        abort(404)
    return send_from_directory(app.static_folder, name)


@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.post("/api/telemetry")
def receive_telemetry():
    global last_seen
    if API_KEY and not hmac.compare_digest(request.headers.get("X-API-Key", ""), API_KEY):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"ok": False, "error": "Send a JSON object"}), 400

    distance = data.get("distance_cm")
    battery = data.get("battery")
    obstacle = data.get("obstacle", False)
    wifi_ip = data.get("wifi_ip")

    if distance is not None:
        try:
            distance = float(distance)
            if not 0 <= distance < 1e6:  # also rejects NaN/inf
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "distance_cm must be a non-negative number"}), 400

    if battery is not None:
        try:
            battery = int(battery)
            if not 0 <= battery <= 100:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "battery must be an integer from 0 to 100"}), 400

    if not isinstance(obstacle, bool):
        return jsonify({"ok": False, "error": "obstacle must be true or false"}), 400

    now = datetime.now(timezone.utc)
    with _lock:
        latest_data.update({
            "distance_cm": distance,
            "battery": battery,
            "obstacle": obstacle,
            "wifi_ip": str(wifi_ip)[:64] if wifi_ip else None,
            "updated_at": now.isoformat(),
        })
        last_seen = now
        snapshot = dict(latest_data)
    return jsonify({"ok": True, "received": snapshot})


@app.get("/api/telemetry")
def get_telemetry():
    with _lock:
        snapshot = dict(latest_data)
        seen = last_seen
    online = bool(seen and (datetime.now(timezone.utc) - seen).total_seconds() <= ONLINE_WINDOW_S)
    return jsonify({
        **snapshot,
        "connected": online,
        "device": "ESP32 Online" if online else "ESP32 Offline",
    })


if __name__ == "__main__":
    # Local run only. In production gunicorn runs the app (see Procfile).
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
