# Coverage Analysis Prompt

You are validating the coverage completeness of generated test cases for a Playwright
TypeScript project. You apply the weighted scoring algorithm and identify specific gaps.

---

## Your Task

Given:

1. The **enriched story JSON** (acceptance criteria, inline images, Figma screenshots,
   Confluence pages)
2. The **generated test case Markdown** (with YAML frontmatter)

Analyse coverage across four dimensions and identify every gap.

---

## Coverage Dimensions

### 1. Acceptance Criteria Coverage (weight: 40)

- Parse the `acCoverage` frontmatter array
- Check every AC ID in the story's `acceptanceCriteria[]` appears in the array
- **Gap**: any AC missing from `acCoverage`
- **Also check**: does each AC have a negative/error test if the AC text contains
  "error", "invalid", "fail", "prevent", "deny", or "not allowed"?

### 2. Image Behavior Capture (weight: 25)

- For each `inlineImages[i].llmDescription.expectedBehaviors` entry:
  - Search the test case code blocks for the behavior string (case-insensitive fuzzy)
  - **Gap**: behavior not referenced in any test step or assertion
- Check the `imageCoverage` frontmatter array references the image

### 3. Figma UI Element References (weight: 20)

- For each `figmaScreenshots[i].llmDescription.uiElements` entry:
  - Search the test case for any reference to the element name or similar
  - **Gap**: element not referenced in any test
- Check the `imageCoverage` frontmatter array includes the figma frame ID

### 4. Confluence Detail References (weight: 15)

- For each `confluencePages[i].title`:
  - Search the test case comments/context for the page title
  - **Gap**: page title not cited anywhere
- Check the `confluenceCoverage` frontmatter array includes the page ID

---

## Gap Report Format

For each gap found, output a JSON object:

```json
{
  "type": "ac | image | figma | confluence",
  "id": "unique identifier (AC3, inline-img-001, figma-frame-LoginModal, page-id-123)",
  "detail": "Clear, actionable explanation of what is missing and why it matters"
}
```

Output the complete list as a JSON array. Be specific and actionable — your output
drives automatic prompt updates.

---

## Scoring Calculation

After listing gaps:

1. For each dimension, mark it COVERED (1) or GAPPED (0)
2. Partial coverage (some items met): score = (met / total) × weight
3. Total score = sum of all dimension scores / sum of all weights × 100
4. If score ≥ threshold → PASS; otherwise → FAIL

Include the score and decision in your output as:

```json
{
  "score": 87.5,
  "decision": "FAIL",
  "gaps": [...]
}
```
