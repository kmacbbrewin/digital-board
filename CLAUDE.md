# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run
python app.py

# Run with auto-reload
FLASK_DEBUG=1 python app.py
```

No build step, test suite, or linter is configured.

## Architecture

**Digital Board** is a Flask + Vanilla JS personal display board: a calendar with daily messages, a to-do list, real-time clock, and optional weather/Google Calendar integration.

### Backend (`app.py`)

Single-file Flask app (~460 lines). All persistent state lives in JSON files on disk — no database.

- `messages.json` — dict keyed by `YYYY-MM-DD`, each value `{title, content, updated_at}`
- `todos.json` — list of `{id (UUID), text, assignee, done, created_at}`
- `credentials.json` / `token.json` — Google OAuth secrets (git-ignored, optional)

**Route groups:**
- `/message/<year>/<month>/<day>` — CRUD for daily messages
- `/calendar/<year>/<month>` — returns month structure (weeks array, prev/next, day_messages map)
- `/todos`, `/todos/<id>` — full CRUD for to-do items
- `/weather` — fetches location from ipapi.co, weather from Open-Meteo (no API key needed)
- `/auth/google`, `/auth/google/callback`, `/gcal/status`, `/gcal/events/<year>/<month>` — optional Google Calendar OAuth + events

Google Calendar integration is feature-flagged: routes only work if `credentials.json` exists. `get_gcal_service()` returns `None` when unconfigured.

### Frontend (`static/script.js`, `templates/index.html`, `static/style.css`)

Vanilla JS with no framework or build tool. State is managed in module-level variables (`currentYear`, `currentMonth`). The page makes async fetch calls to the Flask API and patches the DOM directly.

Key JS responsibilities:
- Real-time clock (1-second interval)
- Calendar navigation — fetches `/calendar/<year>/<month>` on prev/next
- Modal for creating/editing/deleting messages on a clicked day
- To-do CRUD with inline DOM updates
- Google Calendar event dots overlaid on calendar cells
- Weather widget with auto-refresh

Keyboard shortcuts: `Esc` closes the modal, `Cmd/Ctrl+Enter` saves a message.

**Design:** dark gold aesthetic (`#c9a84c` gold, `#0d0f14` background). Fonts loaded from Google Fonts CDN (Playfair Display, DM Sans, DM Mono). No CSS preprocessor.

### Google Calendar Setup

Place a downloaded `credentials.json` (OAuth 2.0 Desktop App type) in the project root, then visit `/auth/google` to complete the OAuth flow. The resulting `token.json` is auto-refreshed by the Google client library.
