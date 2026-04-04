## Context

The digital board is a single-file Flask app with a vanilla JS frontend. It has no database — all state is stored in JSON files. The spotlight section on the homepage displays today's date and a user-authored message; when no message exists it shows an empty-state prompt. The change adds a quote fallback using a free external API.

## Goals / Non-Goals

**Goals:**
- Serve a quote of the day via a new `/quote` endpoint
- Cache the fetched quote in a local JSON file so the API is called at most once per day
- Display the quote in the spotlight when no user message exists for today
- Degrade gracefully when the external API is unavailable

**Non-Goals:**
- User-configurable quote sources or categories
- Persisting historical quotes beyond the current day
- Showing quotes alongside user messages (quotes are a fallback only)

## Decisions

### API: ZenQuotes (`https://zenquotes.io/api/today`)

**Chosen over**: Quotable (recently shut down), They Said So (paid tier), hardcoded local list.

ZenQuotes returns today's quote as a JSON array with `q` (quote text) and `a` (author) fields. No API key required. The "today" endpoint is stable and returns the same quote for an entire calendar day.

### Caching: `quote_cache.json` with date key

The cache file stores `{date: "YYYY-MM-DD", quote: "...", author: "..."}`. On each `/quote` request the backend checks if `cache.date == today`; if so it returns the cached value. Otherwise it fetches fresh and overwrites the cache.

**Chosen over**: in-memory caching (lost on server restart), TTL-based expiry (more complex, not needed here).

The file is git-ignored (same pattern as `messages.json`).

### Fallback: return empty quote object on API failure

If the external call fails (network error, non-200 response), `/quote` returns `{"quote": "", "author": ""}`. The frontend treats an empty quote string as "no quote available" and continues showing the existing empty-state prompt. This avoids breaking the page when offline.

### Frontend integration: conditional rendering in spotlight

`script.js` already builds the spotlight on page load. After fetching today's message, if it is absent the script will call `/quote` and inject the quote markup. The quote block is a new `<div id="quote-block">` in `index.html`, hidden by default and shown by JS when a quote is available.

## Risks / Trade-offs

- **ZenQuotes rate limit** → ZenQuotes allows free use but may throttle high-volume IPs. Mitigation: day-level caching means at most one call per server day.
- **API shape change** → If ZenQuotes changes its JSON schema, the quote silently disappears. Mitigation: defensive key access with fallback to empty strings.
- **Clock skew at midnight** → If the server and the user's browser are in different timezones, "today" may differ. Mitigation: the cache date is based on the server's local date, same as messages.json — consistent within the app, acceptable for a personal board.
