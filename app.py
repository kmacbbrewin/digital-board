"""
Digital Board — Flask application
Serves a calendar view with daily messages and Google Calendar integration.
"""

import os
import json
import secrets
import hashlib
import base64
import calendar
from datetime import date, datetime, timezone
from pathlib import Path

import requests as http
from flask import Flask, jsonify, render_template, request, redirect, session

# ── Google Calendar (optional) ────────────────────────────────────────────────
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")  # allow http on localhost

try:
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GRequest
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build as gcal_build
    GCAL_AVAILABLE = True
except ImportError:
    GCAL_AVAILABLE = False

app = Flask(__name__)
app.secret_key = os.urandom(24)  # session only needed for the brief OAuth redirect

# ── Paths ─────────────────────────────────────────────────────────────────────

MESSAGES_FILE    = Path(__file__).parent / "messages.json"
TODOS_FILE       = Path(__file__).parent / "todos.json"
CREDENTIALS_FILE = Path(__file__).parent / "credentials.json"
TOKEN_FILE       = Path(__file__).parent / "token.json"
QUOTE_CACHE_FILE = Path(__file__).parent / "quote_cache.json"

GCAL_SCOPES       = ["https://www.googleapis.com/auth/calendar.readonly"]
GCAL_REDIRECT_URI = "http://localhost:5000/auth/google/callback"

# ── Data helpers ──────────────────────────────────────────────────────────────


def load_messages() -> dict:
    if MESSAGES_FILE.exists():
        with open(MESSAGES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_messages(data: dict) -> None:
    with open(MESSAGES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def date_key(year: int, month: int, day: int) -> str:
    return f"{year:04d}-{month:02d}-{day:02d}"


def build_calendar(year: int, month: int) -> dict:
    cal = calendar.Calendar(firstweekday=0)
    weeks = cal.monthdayscalendar(year, month)
    month_name = calendar.month_name[month]
    prev_y, prev_m = (year - 1, 12) if month == 1 else (year, month - 1)
    next_y, next_m = (year + 1, 1) if month == 12 else (year, month + 1)
    return {
        "year": year, "month": month, "month_name": month_name,
        "weeks": weeks,
        "prev": {"year": prev_y, "month": prev_m},
        "next": {"year": next_y, "month": next_m},
    }


# ── Google Calendar helpers ───────────────────────────────────────────────────


def get_gcal_service():
    """Return an authenticated Google Calendar service, or None if not set up."""
    if not GCAL_AVAILABLE or not CREDENTIALS_FILE.exists():
        return None
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), GCAL_SCOPES)
    if creds and creds.valid:
        return gcal_build("calendar", "v3", credentials=creds)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(GRequest())
            TOKEN_FILE.write_text(creds.to_json())
            return gcal_build("calendar", "v3", credentials=creds)
        except Exception:
            pass
    return None


# ── Todo helpers ─────────────────────────────────────────────────────────────


def load_quote_cache() -> dict:
    if QUOTE_CACHE_FILE.exists():
        with open(QUOTE_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_quote_cache(data: dict) -> None:
    with open(QUOTE_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_quote_of_the_day() -> dict:
    today_str = date.today().isoformat()
    cache = load_quote_cache()
    if cache.get("date") == today_str:
        return {"quote": cache.get("quote", ""), "author": cache.get("author", "")}
    try:
        resp = http.get("https://zenquotes.io/api/today", timeout=5)
        if resp.status_code == 200:
            item = resp.json()[0]
            result = {"quote": item.get("q", ""), "author": item.get("a", "")}
            save_quote_cache({"date": today_str, **result})
            return result
    except Exception:
        pass
    return {"quote": "", "author": ""}


def load_todos() -> list:
    if TODOS_FILE.exists():
        with open(TODOS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_todos(data: list) -> None:
    with open(TODOS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ── Weather helpers ───────────────────────────────────────────────────────────

_WEATHER_CODES = {
    0:  ("☀️",  "Suspiciously nice outside. Don't trust it."),
    1:  ("🌤️",  "Mainly clear. The universe is lulling you into false hope."),
    2:  ("⛅",  "Partly cloudy. 50% hope, 50% disappointment. As always."),
    3:  ("☁️",  "Completely overcast. The sky has given up."),
    45: ("🌫️",  "Fog. Congratulations, you live in a horror movie now."),
    48: ("🌫️",  "Icy fog. Because regular fog wasn't dramatic enough."),
    51: ("🌦️",  "Light drizzle. Not enough to justify an umbrella, just enough to ruin your hair."),
    53: ("🌦️",  "Moderate drizzle. The sky is sighing directly at you."),
    55: ("🌦️",  "Dense drizzle. Nature's passive-aggressive version of rain."),
    61: ("🌧️",  "Light rain. The sky sends its regards."),
    63: ("🌧️",  "Moderate rain. Oh look, it's raining. How utterly predictable."),
    65: ("🌧️",  "Heavy rain. Abandon all plans, ye who venture outside."),
    71: ("🌨️",  "Light snow. Cute! Until you have to drive in it."),
    73: ("🌨️",  "Moderate snow. Nature's way of cancelling your responsibilities."),
    75: ("❄️",  "Heavy snow. Everything is cancelled. Make hot chocolate."),
    77: ("🌨️",  "Snow grains. The universe couldn't even commit to real snow."),
    80: ("🌧️",  "Slight showers. Getting randomly wet: a lifestyle."),
    81: ("🌧️",  "Moderate showers. The sky is having mood swings again."),
    82: ("⛈️",  "Violent showers. The sky is FURIOUS with you specifically."),
    85: ("🌨️",  "Snow showers. Nature decided rain was too mainstream."),
    86: ("🌨️",  "Heavy snow showers. Your car is now a sculpture."),
    95: ("⛈️",  "Thunderstorm. Thor is upset about something. Stay inside."),
    96: ("⛈️",  "Thunderstorm with hail. The universe is throwing ice at you personally."),
    99: ("⛈️",  "Thunderstorm with heavy hail. Nature has declared war on your car."),
}

def _temp_quip(temp_f: float) -> str:
    if temp_f < 32:
        return f"Yes, it really is {temp_f:.0f}°F. That's a crime."
    if temp_f < 41:
        return f"{temp_f:.0f}°F. Your face will hurt. You've been warned."
    if temp_f < 50:
        return f"{temp_f:.0f}°F. Layer up. No, more layers. More."
    if temp_f < 59:
        return f"{temp_f:.0f}°F. Acceptable. Barely."
    if temp_f < 68:
        return f"{temp_f:.0f}°F. Fine, technically. Don't get too excited."
    if temp_f < 77:
        return f"{temp_f:.0f}°F. Finally, a human temperature."
    if temp_f < 86:
        return f"{temp_f:.0f}°F. Warm. Suspiciously warm."
    if temp_f < 95:
        return f"{temp_f:.0f}°F. Hot. Very hot. Why are you going outside?"
    return f"{temp_f:.0f}°F. Absolutely not. Stay inside forever."


def get_weather() -> dict:
    # Detect location from IP
    try:
        loc = http.get("https://ipapi.co/json/", timeout=5).json()
        lat  = float(loc.get("latitude",  51.5))
        lon  = float(loc.get("longitude", -0.1))
        city = loc.get("city", "")
    except Exception:
        lat, lon, city = 51.5, -0.1, ""

    # Fetch weather from Open-Meteo (no API key needed)
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,apparent_temperature,weather_code,"
        "wind_speed_10m,relative_humidity_2m"
        "&temperature_unit=fahrenheit&wind_speed_unit=kmh"
    )
    w       = http.get(url, timeout=5).json()
    cur     = w["current"]
    code    = int(cur["weather_code"])
    temp    = cur["temperature_2m"]
    feels   = round(cur["apparent_temperature"])
    wind    = round(cur["wind_speed_10m"])
    humidity = cur["relative_humidity_2m"]

    icon, condition = _WEATHER_CODES.get(code, ("🌡️", "Something meteorological is happening."))
    quip = _temp_quip(temp)

    return {
        "city":        city,
        "temp":        round(temp),
        "feels_like":  feels,
        "wind":        wind,
        "humidity":    humidity,
        "code":        code,
        "icon":        icon,
        "condition":   condition,
        "quip":        quip,
    }


# ── Board routes ──────────────────────────────────────────────────────────────


@app.route("/")
def index():
    today = date.today()
    cal = build_calendar(today.year, today.month)
    messages = load_messages()
    today_key = date_key(today.year, today.month, today.day)
    today_msg = messages.get(today_key, {})
    return render_template(
        "index.html",
        cal=cal,
        today=today,
        today_msg=today_msg,
        messages=messages,
        gcal_connected=get_gcal_service() is not None,
    )


@app.route("/calendar/<int:year>/<int:month>")
def month_view(year: int, month: int):
    if not (1 <= month <= 12) or not (1900 <= year <= 2100):
        return jsonify({"error": "Invalid date"}), 400
    cal = build_calendar(year, month)
    messages = load_messages()
    today = date.today()
    day_messages = {}
    for day in range(1, 32):
        try:
            k = date_key(year, month, day)
            if k in messages:
                day_messages[day] = messages[k].get("title", "")
        except ValueError:
            break
    return jsonify({
        "year": cal["year"], "month": cal["month"],
        "month_name": cal["month_name"], "weeks": cal["weeks"],
        "prev": cal["prev"], "next": cal["next"],
        "day_messages": day_messages,
        "today": {"year": today.year, "month": today.month, "day": today.day},
    })


@app.route("/message/<int:year>/<int:month>/<int:day>")
def get_message(year: int, month: int, day: int):
    try:
        date(year, month, day)
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400
    messages = load_messages()
    key = date_key(year, month, day)
    return jsonify({"key": key, "message": messages.get(key, {})})


@app.route("/message/<int:year>/<int:month>/<int:day>", methods=["POST"])
def set_message(year: int, month: int, day: int):
    try:
        date(year, month, day)
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400
    body = request.get_json(force=True)
    title   = (body.get("title")   or "").strip()
    content = (body.get("content") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 422
    messages = load_messages()
    key = date_key(year, month, day)
    messages[key] = {
        "title": title, "content": content,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    save_messages(messages)
    return jsonify({"ok": True, "key": key, "message": messages[key]})


@app.route("/message/<int:year>/<int:month>/<int:day>", methods=["DELETE"])
def delete_message(year: int, month: int, day: int):
    messages = load_messages()
    key = date_key(year, month, day)
    removed = messages.pop(key, None)
    if removed:
        save_messages(messages)
    return jsonify({"ok": True, "removed": removed is not None})


# ── Todo routes ───────────────────────────────────────────────────────────────


@app.route("/todos")
def get_todos():
    return jsonify(load_todos())


@app.route("/todos", methods=["POST"])
def add_todo():
    import uuid
    body     = request.get_json(force=True)
    text     = (body.get("text")     or "").strip()
    assignee = (body.get("assignee") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 422
    todos = load_todos()
    todo = {"id": str(uuid.uuid4()), "text": text, "assignee": assignee,
            "done": False, "created_at": datetime.utcnow().isoformat() + "Z"}
    todos.append(todo)
    save_todos(todos)
    return jsonify(todo), 201


@app.route("/todos/<todo_id>", methods=["PATCH"])
def update_todo(todo_id: str):
    todos = load_todos()
    todo = next((t for t in todos if t["id"] == todo_id), None)
    if not todo:
        return jsonify({"error": "not found"}), 404
    body = request.get_json(force=True)
    if "done" in body:
        todo["done"] = bool(body["done"])
    if "text" in body:
        text = body["text"].strip()
        if text:
            todo["text"] = text
    if "assignee" in body:
        todo["assignee"] = (body["assignee"] or "").strip()
    save_todos(todos)
    return jsonify(todo)


@app.route("/todos/<todo_id>", methods=["DELETE"])
def delete_todo(todo_id: str):
    todos = load_todos()
    todos = [t for t in todos if t["id"] != todo_id]
    save_todos(todos)
    return jsonify({"ok": True})


# ── Weather route ─────────────────────────────────────────────────────────────


@app.route("/weather")
def weather_route():
    try:
        return jsonify(get_weather())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Quote route ──────────────────────────────────────────────────────────


@app.route("/quote")
def quote_route():
    return jsonify(get_quote_of_the_day())


# ── Google Calendar routes ────────────────────────────────────────────────────


@app.route("/auth/google")
def auth_google():
    if not GCAL_AVAILABLE or not CREDENTIALS_FILE.exists():
        return "Google Calendar not configured", 500
    # PKCE — required for Desktop-type OAuth credentials
    code_verifier = secrets.token_urlsafe(43)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode()

    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE), scopes=GCAL_SCOPES, redirect_uri=GCAL_REDIRECT_URI
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    session["oauth_state"]    = state
    session["code_verifier"]  = code_verifier
    return redirect(auth_url)


@app.route("/auth/google/callback")
def auth_google_callback():
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=GCAL_SCOPES,
        state=session.get("oauth_state"),
        redirect_uri=GCAL_REDIRECT_URI,
    )
    flow.fetch_token(
        authorization_response=request.url,
        code_verifier=session.get("code_verifier"),
    )
    TOKEN_FILE.write_text(flow.credentials.to_json())
    return redirect("/")


@app.route("/gcal/status")
def gcal_status():
    return jsonify({"connected": get_gcal_service() is not None})


@app.route("/gcal/events/<int:year>/<int:month>")
def gcal_events_route(year: int, month: int):
    service = get_gcal_service()
    if not service:
        return jsonify({"connected": False, "events": {}})

    time_min = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    next_y, next_m = (year + 1, 1) if month == 12 else (year, month + 1)
    time_max = datetime(next_y, next_m, 1, tzinfo=timezone.utc).isoformat()

    try:
        result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            maxResults=250,
        ).execute()
    except Exception as e:
        return jsonify({"connected": False, "events": {}, "error": str(e)}), 500

    day_events: dict = {}
    for event in result.get("items", []):
        start_raw = event["start"].get("dateTime", event["start"].get("date", ""))
        all_day = "T" not in start_raw
        if all_day:
            ev_date = date.fromisoformat(start_raw)
            if ev_date.month != month or ev_date.year != year:
                continue
            day, time_str = ev_date.day, None
        else:
            ev_dt = datetime.fromisoformat(start_raw)
            if ev_dt.month != month or ev_dt.year != year:
                continue
            day, time_str = ev_dt.day, ev_dt.strftime("%H:%M")

        day_events.setdefault(str(day), []).append({
            "summary": event.get("summary", "(No title)"),
            "time": time_str,
            "all_day": all_day,
        })

    return jsonify({"connected": True, "events": day_events})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not MESSAGES_FILE.exists():
        today = date.today()
        sample = {
            date_key(today.year, today.month, today.day): {
                "title": "Welcome to Digital Board!",
                "content": "Add messages to any day by clicking on a date. "
                           "Today's message will always be shown prominently.",
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }
        }
        save_messages(sample)

    app.run(debug=True, port=5000)
