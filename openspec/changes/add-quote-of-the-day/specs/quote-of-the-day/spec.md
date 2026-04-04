## ADDED Requirements

### Requirement: Quote endpoint returns today's quote
The system SHALL expose a `GET /quote` endpoint that returns a JSON object with `quote` (string) and `author` (string) fields representing today's quote of the day.

#### Scenario: Fresh fetch on first request of the day
- **WHEN** `GET /quote` is called and no valid cache exists for today
- **THEN** the system fetches from the external ZenQuotes API, caches the result in `quote_cache.json`, and returns `{"quote": "<text>", "author": "<name>"}`

#### Scenario: Cache hit on subsequent requests
- **WHEN** `GET /quote` is called and `quote_cache.json` already contains today's date
- **THEN** the system returns the cached quote without making an external API call

#### Scenario: External API unavailable
- **WHEN** `GET /quote` is called and the ZenQuotes API returns an error or is unreachable
- **THEN** the system returns `{"quote": "", "author": ""}` with HTTP 200

### Requirement: Quote cache is persisted per calendar day
The system SHALL store the fetched quote in `quote_cache.json` as `{"date": "YYYY-MM-DD", "quote": "...", "author": "..."}` and SHALL invalidate the cache when the server-local date changes.

#### Scenario: Cache refreshes at day boundary
- **WHEN** `GET /quote` is called on a date different from the cached date
- **THEN** the system fetches a new quote, overwrites `quote_cache.json`, and returns the new quote
