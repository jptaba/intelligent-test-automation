# Hermes Agent Adoption Guide (Run Now vs Install Later)

This guide explains how Hermes Agent-related artifacts in this repository are used today when Hermes Agent is not installed, and what changes if Hermes Agent is installed later.

## Executive Summary

- You can run the full quality workflow today without Hermes Agent installed.
- The scripts in [scripts](scripts) are the executable core.
- The files in [.hermes/skills](.hermes/skills) are markdown playbooks unless a Hermes Agent gateway is running.
- Installing Hermes Agent later primarily adds natural-language orchestration and AI reasoning on top of the same script foundation.

## What Works Without Hermes Agent Installed

These are directly executable now via npm scripts from [package.json](package.json):

1. Environment readiness
   - Command: `npm run check:env`
   - Script: [scripts/env-check.ts](scripts/env-check.ts)

2. Test result archival with git metadata
   - Command: `npm run archive`
   - Script: [scripts/archive-results.ts](scripts/archive-results.ts)

3. Run-to-baseline comparison
   - Command: `npm run compare`
   - Script: [scripts/compare-runs.ts](scripts/compare-runs.ts)

4. Deterministic release gate decision
   - Command: `npm run gate`
   - Script: [scripts/release-gate.ts](scripts/release-gate.ts)

5. Flaky test trend detection
   - Command: `npm run flaky`
   - Script: [scripts/flaky-detect.ts](scripts/flaky-detect.ts)

6. Story-to-spec coverage gap detection
   - Command: `npm run coverage:gaps`
   - Script: [scripts/coverage-gaps.ts](scripts/coverage-gaps.ts)

7. Stakeholder notifications (webhooks)
   - Command: `npm run notify`
   - Script: [scripts/notify.ts](scripts/notify.ts)

8. End-to-end orchestration
   - Command: `npm run pipeline`
   - Script: [scripts/full-pipeline.ts](scripts/full-pipeline.ts)

All of the above use deterministic code and script exit codes. This is typically preferred in regulated environments.

## What Does Not Execute Without Hermes Agent

1. Agent-triggered skill execution from [.hermes/skills](.hermes/skills)
   - These files are not executable by themselves.
   - They become active prompts only when Hermes Agent is installed and its gateway is running.

2. SOUL-based agent identity loading
   - [SOUL.md](SOUL.md) is not consumed by npm scripts.
   - It is consumed by Hermes Agent when the gateway runs in this repo root.

3. Natural-language AI orchestration over multiple tools
   - Without Hermes Agent, humans (or other tooling) invoke each script explicitly.

## How Hermes Agent Artifacts Are Still Useful Today

Even without Hermes Agent runtime, the artifacts add immediate value:

1. Skill markdowns as operational runbooks
   - Files in [.hermes/skills](.hermes/skills) are clear SOPs for humans and other assistants.

2. SOUL.md as team policy and context contract
   - [SOUL.md](SOUL.md) documents quality expectations and workflow assumptions.

3. Better maintainability for future AI adoption
   - If Hermes Agent is approved later, onboarding cost is low because structure already exists.

## Two Operating Modes

| Mode                                  | Runtime Dependency                          | How Work Gets Done                                     | Determinism                                 |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| Script-only (current safe baseline)   | Node + npm + Playwright                     | Explicit script commands                               | High                                        |
| Hermes Agent-enabled (optional later) | Script-only baseline + Hermes Agent gateway | Natural-language requests mapped to skills and scripts | High for scripts, heuristic for AI analysis |

## Recommended Baseline Workflow (No Hermes Agent)

1. `npm run check:env`
2. `npm test`
3. `npm run archive`
4. `npm run compare`
5. `npm run gate`
6. `npm run notify` (or `npm run notify -- --dry-run`)

Or run the orchestrator:

1. `npm run pipeline`

## Decision Checklist for Later Hermes Agent Install

Install Hermes Agent later if these become priorities:

1. Natural-language workflow control across multiple steps.
2. Faster triage through AI-driven commit correlation and root-cause synthesis.
3. Standardized assistant behavior tied to [SOUL.md](SOUL.md) and [.hermes/skills](.hermes/skills).

Stay script-only if these are priorities:

1. Strictly minimal dependency surface.
2. Maximum auditability with only deterministic tooling.
3. Existing team process is already efficient with scripted pipelines.

## Practical Conclusion

This repository already functions as a production-usable QA baseline without Hermes Agent installed. Hermes Agent can be treated as an optional augmentation layer, not a prerequisite.
