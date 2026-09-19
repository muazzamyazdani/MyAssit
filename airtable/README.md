# Airtable setup

`schema.json` is the machine-readable version of the Phase 1 table spec.
`setup_base.js` creates or verifies it against your real Airtable base
using the Airtable Web API (Node 18+, no dependencies — uses built-in
`fetch`).

## 1. Get a personal access token

https://airtable.com/create/tokens — scopes needed:
`data.records:read`, `data.records:write`, `schema.bases:read`,
`schema.bases:write`. Put it in `.env` as `AIRTABLE_PERSONAL_ACCESS_TOKEN`
(copy `.env.example` from the repo root first).

## 2a. Brand new base

Find your workspace ID (visible in the Airtable URL when viewing a
workspace, starts with `wsp`), set `AIRTABLE_WORKSPACE_ID` in `.env`, then:

```
node airtable/setup_base.js create
```

This creates a base called "Task Agent" with the `Tasks` table already
matching the plan, and prints the new `AIRTABLE_BASE_ID` to save into `.env`.

## 2b. Existing base

If you already created the "Task Agent" base by hand in the Airtable UI,
set `AIRTABLE_BASE_ID` (starts with `app`) in `.env` instead, then run the
same `create` command — it adds the `Tasks` table to that base.

## 3. Verify

Any time later, confirm the live schema still matches the plan (useful
before building new n8n workflows against it):

```
node airtable/setup_base.js verify
```

Reports any missing fields, type mismatches, or missing select options.

## 4. Views (manual step)

Views aren't part of the Airtable schema API, so create these by hand in
the Airtable UI: a Grid view filtered/grouped by **Category**, and one
filtered/grouped by **Status**.
