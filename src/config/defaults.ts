import type { AutoqaConfig, Guardrails, PlanGuardrails, PlanConfigFromFile } from './schema.js'

export const DEFAULT_GUARDRAILS: Required<Guardrails> = {
  maxToolCallsPerSpec: 200,
  maxConsecutiveErrors: 8,
  maxRetriesPerStep: 5,
}

export const DEFAULT_EXPORT_DIR = 'tests/autoqa'

export const DEFAULT_PLAN_GUARDRAILS: Required<PlanGuardrails> = {
  maxAgentTurnsPerRun: 1000,
  maxSnapshotsPerRun: 500,
  maxPagesPerRun: 100,
  maxTokenPerRun: 5000000,
}

export const DEFAULT_PLAN_CONFIG: Required<Omit<PlanConfigFromFile, 'baseUrl' | 'auth'>> = {
  maxDepth: 3,
  maxPages: 50,
  includePatterns: [],
  excludePatterns: [],
  testTypes: ['functional', 'form', 'navigation', 'responsive', 'boundary', 'security'],
  guardrails: DEFAULT_PLAN_GUARDRAILS,
}

export const defaultAutoqaConfig: AutoqaConfig = {
  schemaVersion: 1,
  guardrails: DEFAULT_GUARDRAILS,
  exportDir: DEFAULT_EXPORT_DIR,
}
