/**
 * Hermes Agent — shared TypeScript types.
 * All agents import from here to keep data shapes consistent.
 */

// ---------------------------------------------------------------------------
// Image / Vision types
// ---------------------------------------------------------------------------

export interface ImageDescription {
  /** Visible UI elements: buttons, inputs, labels, headings, etc. */
  uiElements: string[];
  /** Implied interactions and validation rules visible in the image */
  expectedBehaviors: string[];
  /** Layout classification: "modal", "full-page form", "above the fold", etc. */
  layoutHints: string;
  /** Free-text description for additional context */
  rawDescription: string;
}

// ---------------------------------------------------------------------------
// Enriched story — produced by story-ingestion-agent
// ---------------------------------------------------------------------------

export interface EnrichedStory {
  storyId: string;
  title: string;
  description: string;
  acceptanceCriteria: Array<{
    id: string; // "AC1", "AC2", ...
    text: string;
  }>;
  inlineImages: Array<{
    sourceUrl: string;
    localPath: string; // inputs/assets/<storyId>/<filename>
    llmDescription: ImageDescription;
  }>;
  confluencePages: Array<{
    url: string;
    title: string;
    pageId: string;
    sections: Record<string, string>;
    images: Array<{ localPath: string; llmDescription: ImageDescription }>;
  }>;
  figmaScreenshots: Array<{
    figmaUrl: string;
    fileKey: string;
    nodeName: string;
    nodeId: string;
    localPath: string;
    llmDescription: ImageDescription;
  }>;
  metadata: {
    jiraKey: string;
    status: string;
    assignee: string;
    fetchedAt: string;
    storyPoints?: number;
  };
}

// ---------------------------------------------------------------------------
// Coverage gate
// ---------------------------------------------------------------------------

export interface CoverageGap {
  type: 'ac' | 'image' | 'figma' | 'confluence';
  id: string;
  detail: string;
}

export interface CoverageGateDecision {
  storyId: string;
  score: number;
  threshold: number;
  decision: 'PASS' | 'FAIL';
  gaps: CoverageGap[];
  generationRetry: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// TC frontmatter (parsed from YAML in TC-*.md files)
// ---------------------------------------------------------------------------

export interface TCFrontmatter {
  storyId: string;
  generatedAt: string;
  generationRetry: number;
  acCoverage: string[];
  imageCoverage: string[];
  confluenceCoverage: string[];
}

// ---------------------------------------------------------------------------
// Learning log
// ---------------------------------------------------------------------------

export interface LearningLogEntry {
  ts: string;
  storyId: string;
  gapType: string;
  gapId: string;
  action: string;
  file: string;
  summary: string;
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Healing log
// ---------------------------------------------------------------------------

export interface HealingLogEntry {
  ts: string;
  specFile: string;
  testName: string;
  failureMessage: string;
  pageObjectFile: string;
  methodHealed: string;
  oldSelector: string;
  newSelector: string;
  healAttempt: number;
  result: 'PASS' | 'FAIL' | 'ESCALATED';
  explanation: string;
}

// ---------------------------------------------------------------------------
// Thresholds config — mirrors .hermes/config/thresholds.json
// ---------------------------------------------------------------------------

export interface ThresholdsConfig {
  coverageGate: {
    minimumCoveragePercent: number;
    requireImagesDescribed: boolean;
    requireFigmaReferences: boolean;
    requireConfluenceDetails: boolean;
    maxGenerationRetries: number;
    weights: {
      acCoverage: number;
      imageBehaviorCapture: number;
      figmaUIElementRefs: number;
      confluenceDetailRefs: number;
    };
  };
  codebaseAgent: {
    trackedGlobs: string[];
    deepScanOnlyChanged: boolean;
  };
  selfHealing: {
    maxHealAttempts: number;
    selectorFallbackToSnapshot: boolean;
  };
  releaseGate: {
    minimumPassRate: number;
    smokesMustAllPass: boolean;
  };
}

// ---------------------------------------------------------------------------
// File hash store — mirrors .hermes/memory/file-hashes.json
// ---------------------------------------------------------------------------

export interface FileHashEntry {
  sha256: string;
  lastScannedAt: string;
}

export type FileHashStore = Record<string, FileHashEntry>;

// ---------------------------------------------------------------------------
// Orchestrator run context
// ---------------------------------------------------------------------------

export interface OrchestratorRunResult {
  storyId: string;
  ingestSuccess: boolean;
  codebaseUpdated: boolean;
  generationRetries: number;
  coverageScore: number;
  coverageDecision: 'PASS' | 'FAIL' | 'SKIPPED';
  automationSpecWritten: boolean;
  testRunResult?: 'PASS' | 'FAIL' | 'HEALED';
  errors: string[];
  durationMs: number;
}
