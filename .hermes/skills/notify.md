---
name: notify
description: Post test run summary to the configured MS Teams channel webhook
---

# Skill: notify

## Trigger phrases

"notify stakeholders", "send test results", "post to Teams", "send the summary",
"notify the team", "post to MS Teams"

## What this skill does

Posts a formatted test run summary to the configured MS Teams incoming webhook
(Adaptive Card), then prints the summary to stdout.

## Prerequisites

Create a webhook in MS Teams:

1. In your Teams channel click **(•••) More options → Workflows**
2. Choose **"Post to a channel when a webhook request is received"**
3. Copy the generated URL and add it to `.env`:

```
MS_TEAMS_WEBHOOK_URL=https://prod-xx.westus.logic.azure.com/workflows/...
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

3. Report back what was sent and to which channel.

## Message format

The message is posted as an Adaptive Card with a colour-coded header
(green = PASS, red = FAIL), a fact table, and a failing-tests list:

```
❌ [intelligent-test-automation] FAIL — main

Pass Rate   80%
Failed      3
Smoke       2/3
Branch      main
Commit      abc1234

Blocking reasons: 1 @smoke test(s) failing

Failing tests:
• can complete full checkout flow
• checkout step two shows correct total
```

## Configuration reference

| Env var                | Default   | Description                                      |
| ---------------------- | --------- | ------------------------------------------------ |
| `MS_TEAMS_WEBHOOK_URL` | (not set) | MS Teams incoming webhook URL (Power Automate)   |
| `NOTIFY_ON_PASS`       | `false`   | Also send notification when gate passes          |

## Tip: reducing alert fatigue

- Leave `NOTIFY_ON_PASS=false` (the default) to avoid noise on passing runs
- Only configure the webhook in CI environments, not local dev
- Use a dedicated channel (e.g. **#test-failures**) rather than a general channel
