## MODIFIED Requirements

### Requirement: Spotlight displays today's content
The spotlight section SHALL display today's date and real-time clock. When a user-authored message exists for today it SHALL be shown. When no user message exists, the spotlight SHALL fetch and display the quote of the day if one is available; if neither a user message nor a quote is available, the spotlight SHALL display the empty-state prompt inviting the user to add a message.

#### Scenario: User message present
- **WHEN** today has a user-authored message
- **THEN** the spotlight shows the message title and content; the quote block is hidden

#### Scenario: No user message, quote available
- **WHEN** today has no user-authored message AND `GET /quote` returns a non-empty quote
- **THEN** the spotlight hides the empty-state prompt and shows the quote text and author attribution

#### Scenario: No user message, quote unavailable
- **WHEN** today has no user-authored message AND `GET /quote` returns an empty quote
- **THEN** the spotlight shows the empty-state prompt as before
