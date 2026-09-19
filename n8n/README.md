# n8n workflows

One JSON file per phase (some phases split into an "a"/"b" pair where a
trigger and its button/callback handler are cleaner as separate flows).
Every workflow opens with a yellow sticky note listing exactly what to
replace/configure — read it first inside the n8n canvas after importing.

## Import order

1. `phase2-telegram-hello-world.json`
2. `phase3a-daily-task-reminders.json` + `phase3b-reminder-button-actions.json`
3. `phase4-email-awaiting-reply-followup.json`
4. `phase5-email-to-task.json`
5. `phase6-mom-screenshot-to-tasks.json`
6. `phase7-whatsapp-followup.json`
7. `phase8a-call-queue-notify.json` + `phase8b-call-outcome-capture.json`
8. `phase9-voice-task-summary.json`

In n8n: **Workflows → Import from File** (or drag-and-drop the JSON) for
each one. Don't skip ahead — later phases assume you're comfortable with
the credential setup from phase 2/3.

## Every workflow needs, after import

- **Credentials assigned on every node that has one** — n8n won't carry
  credentials across accounts/instances, so each Telegram/Airtable/Gmail
  node needs you to pick (or create) the credential from its dropdown.
- **`YOUR_AIRTABLE_BASE_ID` replaced** with your real base ID (find/replace
  works, or click into each Airtable node and fix the base field).
- **Environment variables** set at the n8n instance level (Settings →
  Variables, or self-hosted `.env`): `TELEGRAM_CHAT_ID`,
  `N8N_WEBHOOK_BASE_URL` (phase 8 only).
- **Activate the workflow** (top-right toggle) once configured — inactive
  workflows don't listen for triggers or serve webhooks.

## Credential types used

| Credential | Used by | Where to get it |
|---|---|---|
| Telegram API | every workflow | @BotFather token |
| Airtable Personal Access Token | every workflow except phase2/4-triage | airtable.com/create/tokens |
| Gmail OAuth2 | phase4, phase5 | n8n's built-in Gmail OAuth connect flow |
| HTTP Header Auth ("OpenAI Header Auth") | phase5, phase6, phase8b, phase9 | Create a generic **Header Auth** credential in n8n with header name `Authorization` and value `Bearer <your OpenAI key>` |

Using plain HTTP Request nodes with a header-auth credential for all
OpenAI calls (chat, vision, Whisper, TTS) instead of n8n's dedicated OpenAI
node keeps every workflow working the same way regardless of which n8n
version's OpenAI node you have — you only ever configure one credential
type for it.

## Known rough edges (by design, not bugs)

- **Telegram inline-keyboard parameters** are one of the n8n UI areas that
  has changed shape across versions. If a workflow imports with the
  buttons not rendering correctly, open the Telegram "send message" node
  and rebuild the buttons in the UI, keeping the same `callback_data`
  format called out in that workflow's sticky note — every downstream
  callback handler pattern-matches on that prefix.
- **Cross-execution state** (phase 5, phase 6): a Telegram button tap is a
  *different* workflow execution than the one that sent the message, so
  there's no shared memory between them. These workflows persist a
  "pending" marker directly in the Airtable record's Notes field (and a
  batch ID for phase 6's multi-task confirmations) so the callback handler
  can find and finalize/delete the right record(s).
- **Phase 8 doesn't auto-advance the call queue** after you log an outcome
  — you send `/callqueue` again for the next contact. Chaining that
  automatically would need an Execute Workflow call between two files,
  which is more fragile to import correctly than just sending the command
  again for a one-person queue.
