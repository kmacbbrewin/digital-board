# 📋 Digital Board

A sleek digital display board built with Python + Flask. View a live calendar and attach a daily message to any date — all stored locally in a simple JSON file. No database required.

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0%2B-black?logo=flask)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 📅 Monthly calendar | Navigate months with arrow buttons |
| ✏️ Daily messages | Attach a title + body to any date |
| 🔴 Live clock | Real-time clock in the header |
| 💾 Zero-database | Messages stored in `messages.json` |
| 📱 Responsive | Works on desktop & mobile |
| ⌨️ Keyboard shortcuts | `Esc` close modal · `⌘ Enter` save |

---

## 🚀 Quick Start

```bash
# 1. Clone / enter the project
cd digital-board

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the app
python app.py
```

Open **http://localhost:5000** in your browser.

A sample "Welcome" message is automatically seeded for today on the first run.

---

## 📁 Project Structure

```
digital-board/
├── app.py              # Flask app & REST API
├── messages.json       # Auto-created on first run (git-ignored)
├── requirements.txt
├── README.md
├── static/
│   ├── style.css       # Dark-gold board aesthetic
│   └── script.js       # Calendar navigation & modal CRUD
└── templates/
    └── index.html      # Jinja2 template
```

---

## 🔌 REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Board home page |
| `GET`  | `/calendar/<year>/<month>` | Calendar JSON for JS navigation |
| `GET`  | `/message/<year>/<month>/<day>` | Fetch a day's message |
| `POST` | `/message/<year>/<month>/<day>` | Create / update a message |
| `DELETE` | `/message/<year>/<month>/<day>` | Delete a message |

**POST body (JSON):**
```json
{
  "title":   "Team standup at 9 AM",
  "content": "Remember to update your Jira tickets before the meeting."
}
```

---

## 🗂️ Data Format (`messages.json`)

```json
{
  "2025-04-04": {
    "title": "Welcome to Digital Board!",
    "content": "Add messages to any day by clicking on a date.",
    "updated_at": "2025-04-04T08:00:00Z"
  }
}
```

---

## 🛠️ Development

```bash
# Run with auto-reload
FLASK_DEBUG=1 python app.py
```

---

## 📄 License

MIT — free to use, modify, and distribute.
