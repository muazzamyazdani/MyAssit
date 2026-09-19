# MyAssit — Personal PM Task Agent

A personal assistant that tracks your to-do list across projects, watches your
email for things that need a reply, turns meeting minutes and screenshots
into tasks, and pushes actionable notifications to Telegram (WhatsApp
follow-ups, tap-to-call, voice updates).

This repo does **not** run the assistant itself — it holds the pieces you
import into the free hosted services described in the build plan:

- **Airtable** — the task database. `airtable/` has the schema and a script
  to create/verify it via the Airtable API.
- **n8n** — the automation engine. `n8n/workflows/` has one importable
  workflow JSON file per phase.
- **Telegram** — the control panel. No files needed; you create the bot via
  @BotFather and connect it to n8n during import.

See [`docs/PHASES.md`](docs/PHASES.md) for the full phase-by-phase build plan
this repo implements.

## Quick start

1. Copy `.env.example` to `.env` and fill in your own keys (Airtable token,
   base ID, Telegram bot token/chat ID, OpenAI key). Nothing in this repo
   reads `.env` automatically — it's a reference for which credentials each
   piece needs and what to paste into n8n's credential manager.
2. Run the Airtable schema script (see `airtable/README.md`) to create or
   verify the `Tasks` table.
3. Import the n8n workflows in order (see `n8n/README.md`), starting with
   `phase2-telegram-hello-world.json`, and wire up credentials in the n8n UI
   as you go.
4. Work through the phases in order — each one is independently usable.
   Don't wait until everything is built to start using it.

## Repo layout

```
airtable/           Schema definition + setup/verify script
docs/PHASES.md       The full build plan, phase by phase
n8n/workflows/*.json Importable n8n workflow templates, one set per phase
n8n/README.md        Import order + required credentials per workflow
.env.example         Every credential/ID the workflows reference
```

## Status

Phases implemented as importable artifacts: 1 (schema) through 9 (voice
narration). Each workflow ships with sticky notes inside it (visible when
opened in n8n) marking every placeholder value you must replace — Airtable
base ID, chat IDs, etc.
