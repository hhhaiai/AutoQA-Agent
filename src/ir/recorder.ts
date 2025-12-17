/**
 * IR Recorder
 *
 * Records browser actions to IR during test execution.
 * Handles fingerprint extraction, locator generation, validation, and IR writing.
 */

import type { Page, Locator, ElementHandle } from 'playwright'

import type {
  ActionRecord,
  ElementRecord,
  IRToolName,
  ActionOutcome,
  LocatorCandidate,
  ElementFingerprint,
} from './types.js'
import { isElementTargetingTool } from './types.js'
import { extractFingerprint } from './fingerprint.js'
import { generateLocatorCandidates, chooseBestLocator } from './locator-generator.js'
import { validateCandidates, filterValidCandidatesByAction, getValidationFailureSummary } from './locator-validator.js'
import type { ActionType } from './locator-validator.js'
import { IRWriter, redactToolInputForIR } from './writer.js'

/**
 * Options for creating an IR recorder.
 */
export type IRRecorderOptions = {
  cwd: string
  runId: string
  specPath: string
  enabled?: boolean
}

/**
 * Context for recording an action.
 */
export type RecordActionContext = {
  page: Page
  toolName: IRToolName
  toolInput: Record<string, unknown>
  stepIndex: number | null
  stepText?: string
  locator?: Locator
}

/**
 * Result of pre-action preparation.
 */
export type PreActionResult = {
  fingerprint: ElementFingerprint | null
  candidates: LocatorCandidate[]
}

/**
 * IR Recorder class for recording actions during test execution.
 */
export class IRRecorder {
  private readonly writer: IRWriter
  private readonly specPath: string
  private readonly runId: string
  private readonly enabled: boolean
  private validationFailures: string[] = []

  constructor(options: IRRecorderOptions) {
    this.writer = new IRWriter(options.cwd, options.runId)
    this.specPath = options.specPath
    this.runId = options.runId
    this.enabled = options.enabled !== false
  }

  /**
   * Check if recording is enabled.
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get validation failure summary for debugging.
   */
  getValidationFailures(): string[] {
    return [...this.validationFailures]
  }

  /**
   * Prepare for an action by extracting fingerprint and generating candidates.
   * This should be called BEFORE the action is executed (element may disappear after click).
   */
  async prepareForAction(
    page: Page,
    toolName: string,
    locator: Locator | null,
  ): Promise<PreActionResult> {
    if (!this.enabled || !isElementTargetingTool(toolName) || !locator) {
      return { fingerprint: null, candidates: [] }
    }

    try {
      const elementHandle = await locator.elementHandle({ timeout: 2000 })
      if (!elementHandle) {
        return { fingerprint: null, candidates: [] }
      }

      const fingerprint = await extractFingerprint(elementHandle)
      await elementHandle.dispose()

      const candidates = generateLocatorCandidates(fingerprint)

      const actionType = toolName as ActionType
      const validatedCandidates = await validateCandidates(candidates, {
        page,
        actionType,
        originalFingerprint: fingerprint,
        timeoutMs: 2000,
      })

      return { fingerprint, candidates: validatedCandidates }
    } catch {
      return { fingerprint: null, candidates: [] }
    }
  }

  /**
   * Record an action to the IR.
   * This should be called AFTER the action completes successfully.
   */
  async recordAction(
    context: RecordActionContext,
    outcome: ActionOutcome,
    preActionResult: PreActionResult | null,
  ): Promise<void> {
    if (!this.enabled) return

    const { page, toolName, toolInput, stepIndex, stepText } = context

    let pageUrl: string | undefined
    try {
      pageUrl = page.url()
    } catch {
      pageUrl = undefined
    }

    let element: ElementRecord | undefined
    if (isElementTargetingTool(toolName) && preActionResult?.fingerprint) {
      const actionType = toolName as ActionType
      const validCandidates = filterValidCandidatesByAction(preActionResult.candidates, actionType)
      const chosenLocator = chooseBestLocator(validCandidates)

      if (preActionResult.candidates.length > 0 && validCandidates.length === 0) {
        const failureSummary = getValidationFailureSummary(preActionResult.candidates)
        if (failureSummary) {
          this.validationFailures.push(`${toolName}[step=${stepIndex}]: ${failureSummary}`)
        }
      }

      element = {
        fingerprint: preActionResult.fingerprint,
        locatorCandidates: validCandidates,
        chosenLocator,
      }
    }

    const record: ActionRecord = {
      runId: this.runId,
      specPath: this.specPath,
      stepIndex,
      stepText,
      toolName,
      toolInput: redactToolInputForIR(toolName, toolInput),
      outcome,
      pageUrl,
      element,
      timestamp: Date.now(),
    }

    try {
      await this.writer.write(record)
    } catch {
    }
  }

  /**
   * Get the relative path to the IR file.
   */
  getIRPath(): string {
    return this.writer.getRelativePath()
  }
}

/**
 * Create an IR recorder for a run.
 */
export function createIRRecorder(options: IRRecorderOptions): IRRecorder {
  return new IRRecorder(options)
}

/**
 * No-op recorder for when IR recording is disabled.
 */
export const nullRecorder: Pick<IRRecorder, 'isEnabled' | 'prepareForAction' | 'recordAction' | 'getIRPath' | 'getValidationFailures'> = {
  isEnabled: () => false,
  prepareForAction: async () => ({ fingerprint: null, candidates: [] }),
  recordAction: async () => {},
  getIRPath: () => '',
  getValidationFailures: () => [],
}
