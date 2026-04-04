## Why

The digital board currently fills the spotlight section with a daily message the user manually enters, leaving the panel empty when no message exists. Adding an automatically-fetched quote of the day gives the board a polished, always-populated feel without requiring manual input.

## What Changes

- A new "Quote of the Day" section appears in the spotlight area when no user-authored message exists for today
- The backend fetches a quote from a free public API (ZenQuotes or similar) and caches it for the day in a local JSON file
- The frontend displays the quote text and attribution in a styled block distinct from user messages

## Capabilities

### New Capabilities

- `quote-of-the-day`: Daily quote fetched from a public API, cached per-day, and served via a new `/quote` endpoint; displayed in the spotlight when no user message is set for today

### Modified Capabilities

- `spotlight`: The spotlight section now falls back to rendering the quote when `today_message` is absent, rather than showing the empty-state prompt alone

## Impact

- **Backend**: New `/quote` route in `app.py`; new `quote_cache.json` data file (git-ignored)
- **Frontend**: `script.js` spotlight rendering logic updated; `index.html` adds quote markup; `style.css` adds quote styling
- **External dependency**: HTTP call to a free quote API (ZenQuotes — no API key required); graceful fallback if the API is unavailable
