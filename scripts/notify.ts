/**
 * notify.ts
 *
 * Reads the latest archived run and gate decision, then posts a formatted
 * summary to configured webhook endpoints. Always prints to stdout.
 *
 * Environment variables (all optional):
 *   DISCORD_WEBHOOK_URL   — Discord incoming webhook URL
 *   SLACK_WEBHOOK_URL     — Slack incoming webhook URL
 *   NOTIFY_ON_PASS        — also notify on PASS (default: false — only on FAIL)
 *
 * Usage:
 *   tsx scripts/notify.ts
 *   tsx scripts/notify.ts --dry-run    # print payload, do not send
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { RunRecord, GateDecision } from './types';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const HISTORY_DIR = path.join(process.cwd(), 'test-results', 'history');
const GATE_FILE = path.join(
  process.cwd(),
  'test-results',
  'gate-decision.json',
);
const NOTIFY_ON_PASS = (process.env.NOTIFY_ON_PASS ?? 'false') === 'true';

// ---------------------------------------------------------------------------
// Load latest run and gate decision
// ---------------------------------------------------------------------------
function loadLatestRun(): RunRecord | null {
  if (!fs.existsSync(HISTORY_DIR)) return null;
  const files = fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) return null;
  return JSON.parse(
    fs.readFileSync(path.join(HISTORY_DIR, files.at(-1)!), 'utf8'),
  );
}

function loadGateDecision(): GateDecision | null {
  if (!fs.existsSync(GATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(GATE_FILE, 'utf8'));
}

const run = loadLatestRun();
if (!run) {
  console.error(
    '[notify] ✗ No run history found. Run "npm run archive" first.',
  );
  process.exit(1);
}

// Re-evaluate gate if saved decision is stale (different runId)
let gate = loadGateDecision();
if (!gate || gate.runId !== run.runId) {
  // Re-apply thresholds inline (mirrors release-gate.ts logic)
  const passRate = parseFloat(process.env.GATE_PASS_RATE ?? '95');
  const smokeMustPass =
    (process.env.GATE_SMOKE_MUST_PASS ?? 'true') !== 'false';
  const reasons: string[] = [];
  if (smokeMustPass && !run.smokeTests.allPassing) {
    reasons.push(`${run.smokeTests.failed} @smoke test(s) failing`);
  }
  if (run.stats.passRate < passRate) {
    reasons.push(`Pass rate ${run.stats.passRate}% below ${passRate}%`);
  }
  gate = {
    result: reasons.length === 0 ? 'PASS' : 'FAIL',
    reasons,
    summary:
      reasons.length === 0
        ? `All thresholds met — ${run.stats.passRate}% passing`
        : reasons.join('; '),
    runId: run.runId,
    passRate: run.stats.passRate,
    smokeAllPassing: run.smokeTests.allPassing,
  };
}

// ---------------------------------------------------------------------------
// Decide whether to send
// ---------------------------------------------------------------------------
if (gate.result === 'PASS' && !NOTIFY_ON_PASS) {
  console.log(
    '[notify] Gate is PASS and NOTIFY_ON_PASS is not set — skipping notification.',
  );
  console.log(
    '         Set NOTIFY_ON_PASS=true to also notify on passing runs.',
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Build message
// ---------------------------------------------------------------------------
const statusIcon = gate.result === 'PASS' ? '✅' : '❌';
const title = `${statusIcon} [demo-playwright-cli] ${gate.result} — ${run.gitBranch}`;

const lines: string[] = [
  `**${title}**`,
  '',
  `> ${run.stats.passed}/${run.stats.total} tests passed (${run.stats.passRate}%) · ${run.stats.failed} failed`,
  `> Smoke: ${run.smokeTests.passed}/${run.smokeTests.total} passing`,
  `> Commit: \`${run.gitSha}\` on \`${run.gitBranch}\`${run.gitTag ? ` (${run.gitTag})` : ''}`,
  run.gitMessage ? `> _${run.gitMessage}_` : '',
];

if (gate.reasons.length > 0) {
  lines.push('', '**Blocking reasons:**');
  for (const r of gate.reasons) lines.push(`• ${r}`);
}

if (run.failures.length > 0) {
  lines.push('', `**Failing tests (${run.failures.length}):**`);
  for (const f of run.failures.slice(0, 5)) {
    lines.push(`• ${f.title}`);
  }
  if (run.failures.length > 5) {
    lines.push(`• …and ${run.failures.length - 5} more`);
  }
}

const messageText = lines.filter((l) => l !== '').join('\n');

// ---------------------------------------------------------------------------
// Console output (always)
// ---------------------------------------------------------------------------
console.log('\n[notify] Test Run Summary');
console.log('─'.repeat(70));
console.log(messageText.replace(/\*\*/g, '').replace(/`/g, ''));
console.log('─'.repeat(70));

if (DRY_RUN) {
  console.log('\n[notify] --dry-run mode: skipping webhook delivery.\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Webhook delivery (async IIFE — required for CJS module format)
// ---------------------------------------------------------------------------
void (async () => {
  // Discord webhook
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    const color = gate.result === 'PASS' ? 0x2ecc71 : 0xe74c3c;
    const fields = [
      { name: 'Pass Rate', value: `${run.stats.passRate}%`, inline: true },
      { name: 'Failed', value: String(run.stats.failed), inline: true },
      {
        name: 'Smoke',
        value: `${run.smokeTests.passed}/${run.smokeTests.total}`,
        inline: true,
      },
      {
        name: 'Commit',
        value: `\`${run.gitSha}\` on \`${run.gitBranch}\``,
        inline: false,
      },
    ];

    if (run.gitMessage) {
      fields.push({ name: 'Message', value: run.gitMessage, inline: false });
    }

    if (gate.reasons.length > 0) {
      fields.push({
        name: 'Blocking Reasons',
        value: gate.reasons.join('\n'),
        inline: false,
      });
    }

    const payload = JSON.stringify({
      embeds: [{ title, color, fields }],
    });

    try {
      const res = await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      console.log(
        `[notify] Discord: ${res.ok ? '✓ Sent' : `✗ HTTP ${res.status}`}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] Discord: ✗ ${msg}`);
    }
  } else {
    console.log('[notify] DISCORD_WEBHOOK_URL not set — skipping Discord.');
  }

  // Slack webhook
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    const slackText =
      `${statusIcon} *${gate.result}* — demo-playwright-cli\n` +
      `${run.stats.passed}/${run.stats.total} passed (${run.stats.passRate}%) · ` +
      `${run.stats.failed} failed · ` +
      `Smoke ${run.smokeTests.passed}/${run.smokeTests.total}\n` +
      `Commit: \`${run.gitSha}\` on \`${run.gitBranch}\`` +
      (gate.reasons.length > 0
        ? `\n*Blocked:* ${gate.reasons.join('; ')}`
        : '');

    try {
      const res = await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText }),
      });
      console.log(
        `[notify] Slack:   ${res.ok ? '✓ Sent' : `✗ HTTP ${res.status}`}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] Slack:   ✗ ${msg}`);
    }
  } else {
    console.log('[notify] SLACK_WEBHOOK_URL not set — skipping Slack.');
  }

  console.log('');
})();
