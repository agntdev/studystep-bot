# Study Assistant — Bot specification

**Archetype:** education

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Provides step-by-step solutions, concept explanations, and practice problems across core academic subjects. Supports math, physics, English, biology, chemistry, history, and computer science with optional 'Other' category. Teachers can request printable summaries.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- primary/secondary students
- high school students
- college students
- teachers/tutors

## Success criteria

- 100+ daily active users generating practice problems
- 90% user retention after 3 interactions

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with subject selection
- **/ask** (command, actor: user, command: /ask <question>) — Submit a question with optional subject clarification
- **/summary** (command, actor: teacher, command: /summary <topic>) — Request printable study summary for teachers

## Flows

### Question submission
_Trigger:_ /ask

1. Subject clarification if ambiguous
2. Solution generation
3. Practice problem suggestion

_Data touched:_ Question, Subject

### Follow-up actions
_Trigger:_ Answer received

1. Show 'Explain more' option
2. Offer simpler solution
3. Generate additional practice

_Data touched:_ Solution, Practice item

### Teacher summary
_Trigger:_ /summary

1. Validate teacher status
2. Generate formatted summary
3. Offer download options

_Data touched:_ Explanation

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Question** _(retention: persistent)_ — User-submitted problem or prompt
  - fields: text, subject, timestamp
- **Solution** _(retention: persistent)_ — Step-by-step worked solution with final answer
  - fields: steps, final_answer, question_id
- **Practice item** _(retention: session)_ — Exercise with solution and difficulty tag
  - fields: problem, solution, difficulty

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Daily usage summaries
- Flagged content alerts
- Subject support configuration

## Notifications

- Daily summary report
- Flagged content alerts (potential cheating/unsafe questions)

## Permissions & privacy

- No storage of personally identifiable information
- Anonymous question logging for pattern analysis

## Edge cases

- Ambiguous subject requests
- Flagged content requiring moderation
- Unsupported subjects in 'Other' category

## Required tests

- End-to-end question submission flow with practice problem generation
- Teacher summary formatting validation

## Assumptions

- Default to Math subject when ambiguous
- Practice problems include difficulty tags
- Safety flags trigger admin notifications
