/**
 * IR Module - Intermediate Representation for Action Recording
 *
 * This module provides functionality for:
 * - Recording browser actions during test execution
 * - Generating stable locator candidates from element fingerprints
 * - Validating locator candidates without side effects
 * - Writing action records to JSONL files
 */

export type {
  ElementFingerprint,
  LocatorKind,
  LocatorValidation,
  LocatorCandidate,
  ElementRecord,
  IRToolName,
  ActionOutcome,
  RedactedToolInput,
  ActionRecord,
} from './types.js'

export {
  ELEMENT_TARGETING_TOOLS,
  isElementTargetingTool,
} from './types.js'

export {
  extractFingerprint,
  fingerprintsMatch,
} from './fingerprint.js'

export {
  generateLocatorCandidates,
  getLocatorPriority,
  sortByPriority,
  chooseBestLocator,
} from './locator-generator.js'

export type {
  ActionType,
  ValidateOptions,
} from './locator-validator.js'

export {
  validateCandidate,
  validateCandidates,
  filterValidCandidates,
  filterValidCandidatesByAction,
  getValidationFailureSummary,
} from './locator-validator.js'

export {
  sanitizePathSegment,
  buildIRPath,
  toSafeRelativePath,
  redactToolInputForIR,
  IRWriter,
  createIRWriter,
} from './writer.js'

export type {
  IRRecorderOptions,
  RecordActionContext,
  PreActionResult,
} from './recorder.js'

export {
  IRRecorder,
  createIRRecorder,
  nullRecorder,
} from './recorder.js'
