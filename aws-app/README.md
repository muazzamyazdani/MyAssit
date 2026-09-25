# Task Agent — AWS backend (v2)

This is the real backend for the personal task agent, replacing the
Airtable/n8n prototype in the rest of this repo (kept for reference — it's
still useful for validating extraction/reminder logic cheaply before it's
ported here).

## What's here

`infra/` is an AWS CDK (TypeScript) app that deploys:

- **DynamoDB** table (`TaskAgent-Tasks`) — one row per task, partitioned by
  user so every query is naturally scoped to that user. Category is a
  `tags` list instead of a fixed field, per the hashtag idea — filtering by
  tag happens client-side for now; revisit with OpenSearch only if it
  becomes a real bottleneck at your actual data size.
- **Cognito User Pool** — email/password login (self-signup, email
  verification). Social sign-in (Google/Apple) can be added later without
  changing the API.
- **Three Lambda functions** behind an API Gateway HTTP API, all requiring
  a valid Cognito JWT:
  - `POST /tasks` — create a task
  - `GET /tasks` (optional `?status=Open`) — list your tasks
  - `PATCH /tasks/{taskId}` — generic partial update. This one endpoint
    powers Close, Snooze, Reassign-category, and manual edits — the client
    just sends whichever fields changed (e.g. `{"status": "Closed"}` or
    `{"dueDate": "2026-09-30"}`).

No AI parsing (photo/voice/email → task) yet — that's the next phase, once
this foundation is deployed and you've confirmed you can create/list/update
a task end-to-end.

## Prerequisites

On your own computer (not this remote session):

- Node.js 20+ and npm
- AWS CLI configured with a working profile (we set up `myassit` earlier —
  confirm with `aws sts get-caller-identity --profile myassit`)
- This repo cloned locally: `git clone <your-repo-url>` then `cd aws-app/infra`

## First-time setup

```bash
cd aws-app/infra
npm install

# One-time per AWS account/region — creates the S3 bucket/roles CDK needs
npx cdk bootstrap --profile myassit
```

## Deploy

```bash
npx cdk deploy --profile myassit
```

This will show you a diff of what's about to be created and ask for
confirmation (it's creating IAM roles, so that's expected). Type `y`.

Deployment takes a few minutes. At the end, it prints outputs you'll need
for the mobile/web app later:

```
TaskAgentStack.ApiUrl = https://xxxxx.execute-api.us-west-2.amazonaws.com
TaskAgentStack.UserPoolId = us-west-2_xxxxxxx
TaskAgentStack.UserPoolClientId = xxxxxxxxxxxxxxxxxxxxxxxxxx
TaskAgentStack.TableName = TaskAgent-Tasks
```

Save these somewhere — same as we did with the Airtable/Telegram
credentials earlier.

## Testing it end-to-end (before any app UI exists)

1. **Create a test user** via the AWS Console → Cognito → your User Pool →
   Users → Create user (set a password, mark email verified so you skip
   the confirmation code step).
2. **Get a JWT** by signing in as that user. The simplest way without
   writing a client yet: use the AWS CLI's `initiate-auth`:
   ```bash
   aws cognito-idp initiate-auth \
     --auth-flow USER_PASSWORD_AUTH \
     --client-id <UserPoolClientId> \
     --auth-parameters USERNAME=<email>,PASSWORD=<password> \
     --profile myassit
   ```
   This prints an `IdToken` — that's the JWT to use.
3. **Call the API** with that token:
   ```bash
   curl -X POST <ApiUrl>/tasks \
     -H "Authorization: Bearer <IdToken>" \
     -H "Content-Type: application/json" \
     -d '{"taskText": "Call Sajid and ask for update", "tags": ["finance"], "dueDate": "2026-09-30"}'
   ```
   Then list it:
   ```bash
   curl <ApiUrl>/tasks -H "Authorization: Bearer <IdToken>"
   ```
   Then close it (replace `<taskId>` with the id from the create response):
   ```bash
   curl -X PATCH <ApiUrl>/tasks/<taskId> \
     -H "Authorization: Bearer <IdToken>" \
     -H "Content-Type: application/json" \
     -d '{"status": "Closed"}'
   ```

If all three work, the backend foundation is proven — next is the mobile
app shell (login, task list, manual add, push notifications with
Snooze/Done actions).

## Notes

- The DynamoDB table and Cognito User Pool are set to `RemovalPolicy.RETAIN`
  — running `cdk destroy` won't delete your data or force everyone to sign
  up again. Delete them manually in the console if you ever want a clean
  slate.
- Lambda functions bundle with esbuild automatically (no Docker required)
  since `esbuild` is listed as a dev dependency.
