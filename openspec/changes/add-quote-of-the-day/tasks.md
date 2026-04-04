## 1. Backend — Quote Endpoint

- [x] 1.1 Add `load_quote_cache()` and `save_quote_cache()` helpers in `app.py` (read/write `quote_cache.json`, same pattern as `load_messages`)
- [x] 1.2 Implement `get_quote_of_the_day()` helper: check cache date vs today, fetch from ZenQuotes if stale, return `{"quote": "", "author": ""}` on any failure
- [x] 1.3 Add `GET /quote` route that calls `get_quote_of_the_day()` and returns JSON
- [x] 1.4 Add `quote_cache.json` to `.gitignore`

## 2. Frontend — Markup & Styling

- [x] 2.1 Add `<div id="quote-block">` inside the spotlight section of `index.html`, containing a `<blockquote>` for the quote text and a `<cite>` for the author; hidden by default
- [x] 2.2 Add CSS for `#quote-block` in `style.css`: styled blockquote with gold left-border accent, italic text, muted author attribution

## 3. Frontend — Logic

- [x] 3.1 In `script.js`, after loading today's message in the spotlight render path, if no message exists call `GET /quote`
- [x] 3.2 If the returned quote is non-empty, populate `#quote-block` and show it; hide the empty-state prompt
- [x] 3.3 If the returned quote is empty, leave existing empty-state prompt visible as-is
