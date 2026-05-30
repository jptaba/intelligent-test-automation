# Codebase Scan Prompt

You are analyzing a TypeScript file in a Playwright test automation project targeting
[SauceDemo](https://www.saucedemo.com). Your task is to produce a concise, structured
CODEBASE.md section so that an LLM can understand the file without reading it directly.

---

## Input

```
FILE_PATH: {{FILE_PATH}}

FILE_CONTENT:
{{FILE_CONTENT}}
```

---

## Output Format

Produce a Markdown section (NOT a full document — just one section). Use this template
exactly, adapting content for the file type:

---

### For a **Page Object** (`pages/*.ts`):

```markdown
### <ClassName> · `<file_path>`

**Purpose:** <one sentence describing what page this covers and what it enables>

**Key methods:**

- `<methodName>(<params>)` — <what it does, what it clicks/fills/asserts>
- `<methodName>(<params>)` — <description>
  ...

**Selectors used:** <list of key locator strategies — role, label, testid, etc.>

**Typical usage:**
\`\`\`typescript
const page = new <ClassName>(page);
await page.<method>();
\`\`\`
```

---

### For a **Fixture** (`fixtures/*.ts`):

```markdown
### `<fixtureName>` · `<file_path>`

**Purpose:** <what the fixture provides and when to use it>

**Import:**
\`\`\`typescript
import { test, expect } from '<relative_path>';
\`\`\`

**What it does:** <description of setup/teardown steps>
```

---

### For a **Data file** (`data/*.ts`):

```markdown
### `<EXPORT_NAME>` · `<file_path>`

**Type:** <interface/type name>

**Keys/shape:** <enumerate keys or shape>

**Access pattern:**
\`\`\`typescript
import { <EXPORT_NAME> } from '<relative_path>';
// <EXPORT_NAME>.<key>.<property>
\`\`\`

**Source:** <env vars, static, etc.>
```

---

### For a **Helper** (`helpers/*.ts`):

```markdown
### `<file_path>`

**Purpose:** <one sentence>

**Exports:**

- `<functionName>(<params>): <returnType>` — <description>
- `<CONST_NAME>: <type>` — <description>

**Environment variables:** <list any env vars it reads>
```

---

## Rules

- Be precise and brief — this is LLM context, not human documentation
- List every exported public method with its actual parameter names from the code
- For selectors, mention the strategy (getByRole, getByLabel, locator, etc.)
- Do NOT include implementation details, only the public API surface
- Output ONLY the section content — no code fences around the entire output
