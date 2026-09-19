# Build plan — phase by phase

This mirrors the original plan. Each phase says what you (the human) need to
set up, and which file(s) in this repo implement the "ask Claude Code" part.

## Architecture

```
Task database (Airtable)
        |
Automation engine (n8n) -- runs on your Windows machine or a free n8n cloud account
        |
Notification hub (Telegram bot) -- this is your control panel
        |
   -------------------------------
   |            |                |
WhatsApp      Call              Voice
(wa.me link) (tel: redirect)  (TTS + Whisper)
```

## Phase 0 — accounts and installs

Nothing to implement — sign up for Airtable, n8n cloud, Telegram (@BotFather
`/newbot`), and OpenAI, and have your work email ready. See root README for
where each key goes (`.env.example`).

## Phase 1 — task database

Implemented by: `airtable/schema.json`, `airtable/setup_base.js`.

Run the script in `create` mode to spin up the base + `Tasks` table from
scratch, or in `verify` mode against an existing base to confirm the schema
matches this plan (field names, types, and select options) before workflows
are built against it. See `airtable/README.md`.

Views (Category / Status) are a manual Airtable UI step — there's no API
need for a script, just create Grid views filtered by those fields.

## Phase 2 — Telegram hello-world

Implemented by: `n8n/workflows/phase2-telegram-hello-world.json`.

Telegram Trigger → Telegram Send Message, echoing whatever you send. Import
this first to confirm the bot token and chat are wired up correctly.

## Phase 3 — manual to-do list + reminders

Implemented by:
- `n8n/workflows/phase3a-daily-task-reminders.json` — scheduled every
  morning, searches Airtable for tasks due today or overdue, sends one
  Telegram message per task with Done / Snooze 1 day / Reassign category
  buttons.
- `n8n/workflows/phase3b-reminder-button-actions.json` — handles the button
  taps (Telegram callback queries): Done → Status=Closed, Snooze → Due date
  +1 day, Reassign → prompts for a new category.

## Phase 4 — email monitoring and auto-reminders

Implemented by: `n8n/workflows/phase4-email-awaiting-reply-followup.json`.

Daily check of emails labeled "Awaiting reply" (Gmail label trigger). If no
reply after N days (configurable in a Set node), sends an automatic
follow-up email and notifies you on Telegram.

## Phase 5 — inbound email → tasks

Implemented by: `n8n/workflows/phase5-email-to-task.json`.

New inbound email → OpenAI (chat completion) decides whether it needs a
response/action and proposes a task + due date → Telegram message with
Confirm / Edit / Discard buttons → confirmed tasks are written to Airtable.

## Phase 6 — MOM documents and screenshots

Implemented by: `n8n/workflows/phase6-mom-screenshot-to-tasks.json`.

Triggered when you send a file (PDF/DOCX/image) to the Telegram bot →
OpenAI vision extracts action items assigned to you/your company → checks
open Airtable tasks for a fuzzy match (closes duplicates instead of
re-creating them) → shows the new list on Telegram for confirmation before
writing.

## Phase 7 — WhatsApp follow-ups

Implemented by: `n8n/workflows/phase7-whatsapp-followup.json`.

Scheduled scan for tasks tagged as WhatsApp follow-ups that haven't been
sent yet → Telegram message with a button linking to
`https://wa.me/<phone>?text=<url-encoded message>`.

## Phase 8 — call queue

Implemented by:
- `n8n/workflows/phase8a-call-queue-notify.json` — sends the next contact
  in the queue with a Call button pointing at an n8n webhook (not `tel:`
  directly); the webhook marks "call attempted" in Airtable and responds
  with an HTTP redirect to `tel:<number>`.
- `n8n/workflows/phase8b-call-outcome-capture.json` — right after the call
  webhook fires, sends Discussed / Call back / No answer quick replies, and
  accepts a voice note (transcribed with Whisper, classified with an LLM)
  to update Airtable and advance to the next contact.

## Phase 9 — voice narration

Implemented by: `n8n/workflows/phase9-voice-task-summary.json`.

On a specific Telegram command (e.g. `/tasks`), pulls open tasks from
Airtable, generates a spoken summary via OpenAI TTS, and sends it back as a
Telegram voice message.

## Build order

1. Airtable schema
2. Telegram ↔ n8n hello-world
3. Manual task reminders
4. Email monitoring
5. Email-to-task extraction
6. MOM/screenshot parsing
7. WhatsApp deep links
8. Call queue with outcome capture
9. Voice narration

Start using phase 3 the day it works; layer the rest on top.
