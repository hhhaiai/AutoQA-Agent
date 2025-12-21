import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ZodError } from 'zod'

import { autoqaConfigSchema, type AutoqaConfig, type Guardrails } from './schema.js'
import { defaultAutoqaConfig, DEFAULT_GUARDRAILS, DEFAULT_PLAN_CONFIG, DEFAULT_PLAN_GUARDRAILS } from './defaults.js'
import { AUTOQA_CONFIG_FILE_NAME } from './init.js'
import type { PlanConfig, GuardrailConfig } from '../plan/types.js'

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly configPath: string,
    public readonly zodError?: ZodError,
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

export type ReadConfigResult =
  | { ok: true; config: AutoqaConfig; source: 'file' | 'default' }
  | { ok: false; error: ConfigValidationError }

export function readConfig(cwd: string = process.cwd()): ReadConfigResult {
  const configPath = join(cwd, AUTOQA_CONFIG_FILE_NAME)

  if (!existsSync(configPath)) {
    return { ok: true, config: defaultAutoqaConfig, source: 'default' }
  }

  let rawContent: string
  try {
    rawContent = readFileSync(configPath, 'utf8')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: new ConfigValidationError(`Failed to read config file: ${message}`, configPath),
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: new ConfigValidationError(`Invalid JSON in config file: ${message}`, configPath),
    }
  }

  const result = autoqaConfigSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    return {
      ok: false,
      error: new ConfigValidationError(
        `Invalid config file:\n${issues}`,
        configPath,
        result.error,
      ),
    }
  }

  return { ok: true, config: result.data, source: 'file' }
}

export function resolveGuardrails(config: AutoqaConfig): Required<Guardrails> {
  const userGuardrails = config.guardrails ?? {}
  return {
    maxToolCallsPerSpec: userGuardrails.maxToolCallsPerSpec ?? DEFAULT_GUARDRAILS.maxToolCallsPerSpec,
    maxConsecutiveErrors: userGuardrails.maxConsecutiveErrors ?? DEFAULT_GUARDRAILS.maxConsecutiveErrors,
    maxRetriesPerStep: userGuardrails.maxRetriesPerStep ?? DEFAULT_GUARDRAILS.maxRetriesPerStep,
  }
}

const VALID_TEST_TYPES = ['functional', 'form', 'navigation', 'responsive', 'boundary', 'security'] as const

function validateTestTypes(types: string): PlanConfig['testTypes'] {
  const typeList = types.split(',').map((t: string) => t.trim().toLowerCase())
  const invalid = typeList.filter(t => !VALID_TEST_TYPES.includes(t as any))
  if (invalid.length > 0) {
    throw new Error(`Invalid test types: ${invalid.join(', ')}. Valid types: ${VALID_TEST_TYPES.join(', ')}`)
  }
  return typeList as PlanConfig['testTypes']
}

export type PlanCliOptions = {
  url?: string
  depth?: number
  maxPages?: number
  maxAgentTurns?: number
  maxSnapshots?: number
  testTypes?: string
  loginUrl?: string
  username?: string
  password?: string
  skipUrlValidation?: boolean
}

export function loadPlanConfig(fileConfig: AutoqaConfig, cliOptions: PlanCliOptions): PlanConfig {
  const planConfig = fileConfig.plan || {}
  
  const guardrails: GuardrailConfig = {}
  if (cliOptions.maxAgentTurns !== undefined) {
    guardrails.maxAgentTurnsPerRun = cliOptions.maxAgentTurns
  } else if (planConfig.guardrails?.maxAgentTurnsPerRun !== undefined) {
    guardrails.maxAgentTurnsPerRun = planConfig.guardrails.maxAgentTurnsPerRun
  } else {
    guardrails.maxAgentTurnsPerRun = DEFAULT_PLAN_GUARDRAILS.maxAgentTurnsPerRun
  }
  
  if (cliOptions.maxSnapshots !== undefined) {
    guardrails.maxSnapshotsPerRun = cliOptions.maxSnapshots
  } else if (planConfig.guardrails?.maxSnapshotsPerRun !== undefined) {
    guardrails.maxSnapshotsPerRun = planConfig.guardrails.maxSnapshotsPerRun
  } else {
    guardrails.maxSnapshotsPerRun = DEFAULT_PLAN_GUARDRAILS.maxSnapshotsPerRun
  }
  
  if (cliOptions.maxPages !== undefined) {
    guardrails.maxPagesPerRun = cliOptions.maxPages
  } else if (planConfig.guardrails?.maxPagesPerRun !== undefined) {
    guardrails.maxPagesPerRun = planConfig.guardrails.maxPagesPerRun
  } else {
    guardrails.maxPagesPerRun = DEFAULT_PLAN_GUARDRAILS.maxPagesPerRun
  }
  
  if (planConfig.guardrails?.maxTokenPerRun !== undefined) {
    guardrails.maxTokenPerRun = planConfig.guardrails.maxTokenPerRun
  } else {
    guardrails.maxTokenPerRun = DEFAULT_PLAN_GUARDRAILS.maxTokenPerRun
  }
  
  let baseUrl = cliOptions.url || planConfig.baseUrl
  if (!baseUrl && !cliOptions.skipUrlValidation) {
    throw new Error('baseUrl is required (provide via --url or autoqa.config.json plan.baseUrl)')
  }
  
  let testTypes: PlanConfig['testTypes'] = planConfig.testTypes ?? DEFAULT_PLAN_CONFIG.testTypes
  if (cliOptions.testTypes) {
    testTypes = validateTestTypes(cliOptions.testTypes)
  }
  
  let auth: PlanConfig['auth'] = planConfig.auth
  if (cliOptions.loginUrl || cliOptions.username || cliOptions.password) {
    auth = {
      ...auth,
      loginUrl: cliOptions.loginUrl || auth?.loginUrl,
      username: cliOptions.username,
      password: cliOptions.password,
    }
  }
  
  const config: PlanConfig = {
    baseUrl,
    maxDepth: cliOptions.depth ?? planConfig.maxDepth ?? DEFAULT_PLAN_CONFIG.maxDepth,
    maxPages: cliOptions.maxPages ?? planConfig.maxPages ?? DEFAULT_PLAN_CONFIG.maxPages,
    includePatterns: planConfig.includePatterns ?? DEFAULT_PLAN_CONFIG.includePatterns,
    excludePatterns: planConfig.excludePatterns ?? DEFAULT_PLAN_CONFIG.excludePatterns,
    testTypes,
    guardrails,
    auth,
  }
  
  return config
}
