---
name: notify
description: Post test run summary to configured stakeholder webhooks
---

# Skill: notify

## Trigger phrases

"notify stakeholders", "send test results", "post to Slack", "post to Discord",
"send the summary", "notify the team"

## What this skill does

Posts a formatted test run summary to Discord and/or Slack webhooks, then prints the summary to stdout.

## Prerequisites

Set webhook URLs in `.env`:

```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

By default, notifications are only sent when the gate **FAILS**.
Set `NOTIFY_ON_PASS=true` in `.env` to also notify on passing runs.

## Steps

1. Run the notification script:

   ```
   npm run notify
   ```

2. Preview without sending (dry run):

   ```
   npm run notify -- --dry-run
   ```

3. Report back what was sent and to which channels.

## Message format

```
❌ [demo-playwright-cli] FAIL — main

> 12/15 tests passed (80%) · 3 failed
> Smoke: 2/3 passing
> Commit: `abc1234` on `main`
> "Fix checkout page selector"

Blocking reasons:
• 1 @smoke test(s) failing — zero-tolerance threshold

Failing tests (3):
• can complete full checkout flow
• checkout step two shows correct total
• ...
```

## Configuration reference

| Env var               | Default   | Description                             |
| --------------------- | --------- | --------------------------------------- |
| `DISCORD_WEBHOOK_URL` | (not set) | Discord incoming webhook URL            |
| `SLACK_WEBHOOK_URL`   | (not set) | Slack incoming webhook URL              |
| `NOTIFY_ON_PASS`      | `false`   | Also send notification when gate passes |

## Tip: reducing alert fatigue

- Leave `NOTIFY_ON_PASS=false` (the default) to avoid noise on passing runs
- Only configure webhooks in CI environments, not local dev
- Use a dedicated `#test-failures` channel rather than a general channel
