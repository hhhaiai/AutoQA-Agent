/**
 * Export Playwright Test
 *
 * Generates @playwright/test .spec.ts files from IR and spec files.
 */

import { writeFile } from 'node:fs/promises'

import type { ActionRecord } from '../ir/types.js'
import type { MarkdownSpec, MarkdownSpecStep } from '../markdown/spec-types.js'
import {
  ensureExportDir,
  getExportPath,
  getRelativeExportPath,
} from './export-paths.js'
import { getSpecActionRecords, getMissingLocatorActions, hasValidChosenLocator } from './ir-reader.js'

/**
 * Export result types.
 */
export type ExportSuccess = {
  ok: true
  exportPath: string
  relativePath: string
}

export type ExportFailure = {
  ok: false
  reason: string
  missingLocators?: string[]
}

export type ExportResult = ExportSuccess | ExportFailure

/**
 * Options for exporting a Playwright test.
 */
export type ExportOptions = {
  cwd: string
  runId: string
  specPath: string
  spec: MarkdownSpec
  baseUrl: string
  loginBaseUrl?: string
  /** Raw (unrendered) spec content for extracting {{VAR}} placeholders */
  rawSpecContent?: string
}

/**
 * Pattern to match {{VAR}} placeholders in spec text.
 */
const TEMPLATE_VAR_PATTERN = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g

/**
 * Extract all {{VAR}} placeholders from a string.
 * Returns array of variable names (without braces).
 */
function extractTemplateVars(text: string): string[] {
  const vars: string[] = []
  let match: RegExpExecArray | null
  const pattern = new RegExp(TEMPLATE_VAR_PATTERN.source, 'g')
  while ((match = pattern.exec(text)) !== null) {
    const varName = (match[1] ?? '').trim()
    if (varName && !vars.includes(varName)) {
      vars.push(varName)
    }
  }
  return vars
}

/**
 * Parse raw spec content and build a map of stepIndex -> variables used in that step.
 * Also returns all unique variables found across all steps.
 */
function parseRawSpecVars(rawContent: string): {
  stepVars: Map<number, { vars: string[]; rawText: string }>
  allVars: Set<string>
} {
  const stepVars = new Map<number, { vars: string[]; rawText: string }>()
  const allVars = new Set<string>()

  // Parse steps section
  const stepsMatch = rawContent.match(/##\s*Steps[\s\S]*?(?=##|$)/i)
  if (!stepsMatch) return { stepVars, allVars }

  const stepsSection = stepsMatch[0]
  // Match numbered steps: "1. Step text" or "1) Step text"
  const stepPattern = /^\s*(\d+)[.)\s]+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = stepPattern.exec(stepsSection)) !== null) {
    const stepIndex = parseInt(match[1], 10)
    const rawText = match[2].trim()
    const vars = extractTemplateVars(rawText)
    if (vars.length > 0) {
      stepVars.set(stepIndex, { vars, rawText })
      vars.forEach((v) => allVars.add(v))
    }
  }

  return { stepVars, allVars }
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function extractRelativeFromAbsolute(urlStr: string, baseUrlStr: string | undefined): string | null {
  if (!baseUrlStr) return null
  const base = safeParseUrl(baseUrlStr)
  const url = safeParseUrl(urlStr)
  if (!base || !url) return null
  if (url.origin !== base.origin) return null
  return `${url.pathname}${url.search}${url.hash}`
}

type StepNeeds = {
  /** Set of variable names (e.g. 'USERNAME', 'PASSWORD') needed by this step */
  envVars?: Set<string>
  loginBaseUrl?: boolean
}

/**
 * Redact step text for export comments.
 * If stepVars contains variables for this step, replace the rendered value with variable reference.
 */
function redactStepTextForExport(
  stepText: string,
  baseUrl: string,
  loginBaseUrl?: string,
  stepVarInfo?: { vars: string[]; rawText: string },
): string {
  // If we have raw text with variables, use it (replacing {{VAR}} with AUTOQA_VAR)
  if (stepVarInfo && stepVarInfo.vars.length > 0) {
    let redacted = stepVarInfo.rawText
    for (const varName of stepVarInfo.vars) {
      redacted = redacted.replace(
        new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g'),
        `AUTOQA_${varName}`,
      )
    }
    return redacted
  }

  // Fallback: redact absolute URLs
  const navigatePath = parseNavigateStep(stepText)
  if (navigatePath !== null && navigatePath.startsWith('http')) {
    const relFromBase = extractRelativeFromAbsolute(navigatePath, baseUrl)
    if (relFromBase !== null) return `Navigate to ${relFromBase}`
    const relFromLogin = extractRelativeFromAbsolute(navigatePath, loginBaseUrl)
    if (relFromLogin !== null) return `Navigate to ${relFromLogin}`
  }

  return stepText
}

/**
 * Parse a navigate step to extract the path.
 * Supports formats like:
 * - "Navigate to /"
 * - "Navigate to /path"
 * - "导航到 /"
 */
function parseNavigateStep(stepText: string): string | null {
  const patterns = [
    /^navigate\s+to\s+(\S+)/i,
    /^导航到\s+(\S+)/i,
    /^go\s+to\s+(\S+)/i,
  ]

  for (const pattern of patterns) {
    const match = stepText.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

function parseLoginFormFieldsAssertion(stepText: string): string[] | null {
  const lower = stepText.toLowerCase()
  const isVerify = lower.startsWith('verify') || lower.startsWith('assert') || stepText.startsWith('验证') || stepText.startsWith('断言')
  if (!isVerify) return null
  if (!lower.includes('login form') || !lower.includes('field')) return null

  const quoted = Array.from(stepText.matchAll(/["']([^"']+)["']/g))
    .map((m) => (m[1] ?? '').trim())
    .filter((v) => v.length > 0)

  if (quoted.length === 0) return null
  return quoted
}

/**
 * Parse a fill step to extract the target and value.
 * Supports formats like:
 * - "Fill the 'Username' field with standard_user"
 * - "Fill 'Username' with standard_user"
 * - "在 'Username' 字段输入 standard_user"
 */
function parseFillStep(stepText: string): { target: string; value: string } | null {
  const patterns = [
    /^fill\s+(?:the\s+)?["']?([^"']+)["']?\s+(?:field\s+)?with\s+(.+)$/i,
    /^在\s*["']?([^"']+)["']?\s*(?:字段)?(?:中)?输入\s+(.+)$/i,
    /^(?:type|enter|input)\s+(.+)\s+(?:in|into)\s+(?:the\s+)?["']?([^"']+)["']?/i,
  ]

  for (const pattern of patterns) {
    const match = stepText.match(pattern)
    if (match) {
      // Handle different capture group orders
      if (pattern.source.includes('in|into')) {
        return { target: match[2].trim(), value: match[1].trim() }
      }
      return { target: match[1].trim(), value: match[2].trim() }
    }
  }

  return null
}

/**
 * Parse a click step to extract the target.
 * Supports formats like:
 * - "Click the 'Login' button"
 * - "Click 'Login'"
 * - "点击 'Login' 按钮"
 */
function parseClickStep(stepText: string): string | null {
  const patterns = [
    /^click\s+(?:the\s+)?["']?([^"']+)["']?\s*(?:button|link|element)?$/i,
    /^点击\s*["']?([^"']+)["']?\s*(?:按钮|链接|元素)?$/i,
  ]

  for (const pattern of patterns) {
    const match = stepText.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Parse a select step to extract the target and option.
 * Supports formats like:
 * - "Select 'Option A' from the dropdown"
 * - "Select 'Option A' in 'Dropdown'"
 */
function parseSelectStep(stepText: string): { target: string; label: string } | null {
  const patterns = [
    /^select\s+["']?([^"']+)["']?\s+(?:from|in)\s+(?:the\s+)?["']?([^"']+)["']?/i,
    /^选择\s*["']?([^"']+)["']?\s*(?:从|在)\s*["']?([^"']+)["']?/i,
  ]

  for (const pattern of patterns) {
    const match = stepText.match(pattern)
    if (match) {
      return { label: match[1].trim(), target: match[2].trim() }
    }
  }

  return null
}

/**
 * Parse an assertion step to extract the assertion type and value.
 * Supports formats like:
 * - "Verify the page shows 'Products'"
 * - "Verify the user is logged in and sees the inventory/products page"
 * - "Assert that 'Login' button is visible"
 * - "验证页面显示 'Products'"
 */
function parseAssertionStep(stepText: string): { type: 'text' | 'element'; value: string } | null {
  // Element visibility patterns
  const elementPatterns = [
    /^(?:verify|assert)\s+(?:that\s+)?(?:the\s+)?["']?([^"']+)["']?\s+(?:button|link|element|icon)\s+is\s+visible/i,
    /^验证\s*["']?([^"']+)["']?\s*(?:按钮|链接|元素|图标)\s*(?:可见|显示)/i,
  ]

  for (const pattern of elementPatterns) {
    const match = stepText.match(pattern)
    if (match) {
      return { type: 'element', value: match[1].trim() }
    }
  }

  // Text presence patterns
  const textPatterns = [
    /^(?:verify|assert)\s+(?:that\s+)?(?:the\s+)?page\s+(?:shows|contains|displays)\s+["']?([^"']+)["']?/i,
    /^验证\s*(?:页面)?(?:显示|包含)\s*["']?([^"']+)["']?/i,
    /^断言\s*(?:页面)?(?:显示|包含)\s*["']?([^"']+)["']?/i,
  ]

  for (const pattern of textPatterns) {
    const match = stepText.match(pattern)
    if (match) {
      return { type: 'text', value: match[1].trim() }
    }
  }

  // Fallback: extract quoted text as text assertion
  const quotedMatch = stepText.match(/["']([^"']+)["']/)
  if (quotedMatch) {
    return { type: 'text', value: quotedMatch[1].trim() }
  }

  return null
}

/**
 * Escape a string for use in generated code.
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find the IR record matching a step.
 */
function findMatchingRecord(
  step: MarkdownSpecStep,
  records: ActionRecord[],
): ActionRecord | undefined {
  // First try to match by stepIndex
  const byIndex = records.find((r) => r.stepIndex === step.index && r.outcome.ok)
  if (byIndex) return byIndex

  // Fallback: match by tool name and approximate step text
  const stepLower = step.text.toLowerCase()

  if (stepLower.includes('navigate') || stepLower.includes('导航')) {
    return records.find((r) => r.toolName === 'navigate' && r.outcome.ok)
  }

  if (stepLower.includes('fill') || stepLower.includes('输入')) {
    return records.find((r) => r.toolName === 'fill' && r.outcome.ok && r.stepIndex === step.index)
  }

  if (stepLower.includes('click') || stepLower.includes('点击')) {
    return records.find((r) => r.toolName === 'click' && r.outcome.ok && r.stepIndex === step.index)
  }

  if (stepLower.includes('select') || stepLower.includes('选择')) {
    return records.find((r) => r.toolName === 'select_option' && r.outcome.ok && r.stepIndex === step.index)
  }

  return undefined
}

/**
 * Generate code for a single step.
 * @param stepVarInfo - If provided, contains the variables used in this step from raw spec
 */
function generateStepCode(
  step: MarkdownSpecStep,
  records: ActionRecord[],
  baseUrl: string,
  loginBaseUrl?: string,
  stepVarInfo?: { vars: string[]; rawText: string },
): { code: string; error?: string; needs?: StepNeeds } {
  const stepText = step.text
  const stepVars = stepVarInfo?.vars ?? []

  // Handle assertions
  if (step.kind === 'assertion') {
    const assertionRecords = records.filter(
      (r) =>
        r.stepIndex === step.index &&
        r.outcome.ok &&
        (r.toolName === 'assertTextPresent' || r.toolName === 'assertElementVisible'),
    )

    if (assertionRecords.length === 0) {
      return {
        code: '',
        error: `Assertion step ${step.index} missing assertion IR record`,
      }
    }

    const parts: string[] = []
    let i = 0
    for (const record of assertionRecords) {
      i += 1
      if (record.toolName === 'assertTextPresent') {
        const text = typeof record.toolInput?.text === 'string' ? String(record.toolInput.text) : ''
        if (!text) {
          return {
            code: '',
            error: `Assertion step ${step.index} missing text in IR`,
          }
        }

        const visibleNthRaw = (record.toolInput as any)?.visibleNth
        const visibleNth = typeof visibleNthRaw === 'number' && Number.isInteger(visibleNthRaw) && visibleNthRaw >= 0
          ? visibleNthRaw
          : undefined

        if (typeof visibleNth === 'number') {
          const locatorVar = `locator${step.index}_${i}`
          parts.push(`  const ${locatorVar} = page.getByText('${escapeString(text)}');`)
          parts.push(`  await expect(${locatorVar}.nth(${visibleNth})).toBeVisible();`)
        } else {
          parts.push(`  await expect(page.getByText('${escapeString(text)}').first()).toBeVisible();`)
        }
        continue
      }

      if (record.toolName === 'assertElementVisible') {
        if (!hasValidChosenLocator(record)) {
          return {
            code: '',
            error: `Assertion step ${step.index} missing valid chosenLocator`,
          }
        }
        const locatorCode = record.element!.chosenLocator!.code
        const locatorVar = `locator${step.index}_${i}`
        parts.push(`  const ${locatorVar} = ${locatorCode};`)
        parts.push(`  await expect(${locatorVar}).toHaveCount(1);`)
        parts.push(`  await expect(${locatorVar}).toBeVisible();`)
        continue
      }
    }

    return { code: parts.join('\n') }
  }

  // Handle navigate
  const navigatePath = parseNavigateStep(stepText)
  if (navigatePath !== null) {
    if (navigatePath.startsWith('http')) {
      const relFromBase = extractRelativeFromAbsolute(navigatePath, baseUrl)
      if (relFromBase !== null) {
        return {
          code: `  await page.goto(new URL('${escapeString(relFromBase)}', baseUrl).toString());`,
        }
      }

      const relFromLogin = extractRelativeFromAbsolute(navigatePath, loginBaseUrl)
      if (relFromLogin !== null) {
        return {
          code: `  await page.goto(new URL('${escapeString(relFromLogin)}', loginBaseUrl).toString());`,
          needs: { loginBaseUrl: true },
        }
      }

      return { code: `  await page.goto('${escapeString(navigatePath)}');` }
    }

    return { code: `  await page.goto(new URL('${escapeString(navigatePath)}', baseUrl).toString());` }
  }

  // Handle fill - must use IR chosenLocator
  const fillParsed = parseFillStep(stepText)
  if (fillParsed) {
    const record = findMatchingRecord(step, records)
    if (!record || !hasValidChosenLocator(record)) {
      return {
        code: '',
        error: `Fill action at step ${step.index} missing valid chosenLocator`,
      }
    }

    const locatorCode = record.element!.chosenLocator!.code

    // If this step has variables from raw spec, use them
    if (stepVars.length > 0) {
      // Use the first variable found in this step for the fill value
      const varName = stepVars[0]
      const jsVarName = varName.toLowerCase()
      return {
        code: `  await ${locatorCode}.fill(${jsVarName});`,
        needs: { envVars: new Set(stepVars) },
      }
    }

    const fillValue = fillParsed.value
    return {
      code: `  await ${locatorCode}.fill('${escapeString(fillValue)}');`,
    }
  }

  // Handle click - must use IR chosenLocator
  const clickTarget = parseClickStep(stepText)
  if (clickTarget) {
    const record = findMatchingRecord(step, records)
    if (!record || !hasValidChosenLocator(record)) {
      return {
        code: '',
        error: `Click action at step ${step.index} missing valid chosenLocator`,
      }
    }

    const locatorCode = record.element!.chosenLocator!.code
    return {
      code: `  await ${locatorCode}.click();`,
    }
  }

  // Handle select - must use IR chosenLocator
  const selectParsed = parseSelectStep(stepText)
  if (selectParsed) {
    const record = findMatchingRecord(step, records)
    if (!record || !hasValidChosenLocator(record)) {
      return {
        code: '',
        error: `Select action at step ${step.index} missing valid chosenLocator`,
      }
    }

    const locatorCode = record.element!.chosenLocator!.code
    return {
      code: `  await ${locatorCode}.selectOption({ label: '${escapeString(selectParsed.label)}' });`,
    }
  }

  // Unknown step type - try to match with IR record
  const record = findMatchingRecord(step, records)
  if (record) {
    if (record.toolName === 'navigate') {
      const url = record.toolInput?.url as string | undefined
      if (url) {
        if (url.startsWith('http')) {
          const relFromBase = extractRelativeFromAbsolute(url, baseUrl)
          if (relFromBase !== null) {
            return {
              code: `  await page.goto(new URL('${escapeString(relFromBase)}', baseUrl).toString());`,
            }
          }

          const relFromLogin = extractRelativeFromAbsolute(url, loginBaseUrl)
          if (relFromLogin !== null) {
            return {
              code: `  await page.goto(new URL('${escapeString(relFromLogin)}', loginBaseUrl).toString());`,
              needs: { loginBaseUrl: true },
            }
          }

          return { code: `  await page.goto('${escapeString(url)}');` }
        }
        return { code: `  await page.goto(new URL('${escapeString(url)}', baseUrl).toString());` }
      }
    }

    if (record.toolName === 'click' && hasValidChosenLocator(record)) {
      return { code: `  await ${record.element!.chosenLocator!.code}.click();` }
    }

    if (record.toolName === 'fill' && hasValidChosenLocator(record)) {
      // For fill, we need to get the value from spec text, not IR (IR is redacted)
      const parsed = parseFillStep(stepText)
      if (parsed) {
        // If this step has variables from raw spec, use them
        if (stepVars.length > 0) {
          const varName = stepVars[0]
          const jsVarName = varName.toLowerCase()
          return {
            code: `  await ${record.element!.chosenLocator!.code}.fill(${jsVarName});`,
            needs: { envVars: new Set(stepVars) },
          }
        }

        const fillValue = parsed.value
        if (fillValue) {
          return { code: `  await ${record.element!.chosenLocator!.code}.fill('${escapeString(fillValue)}');` }
        }
      }
    }

    if (record.toolName === 'select_option' && hasValidChosenLocator(record)) {
      const label = record.toolInput?.label as string | undefined
      if (label) {
        return { code: `  await ${record.element!.chosenLocator!.code}.selectOption({ label: '${escapeString(label)}' });` }
      }
    }
  }

  return {
    code: '',
    error: `Cannot generate code for step ${step.index}: "${stepText}"`,
  }
}

/**
 * Generate environment variable declarations for the given variable names.
 * Each variable is declared as `const varName = process.env.AUTOQA_VARNAME` with a null check.
 */
function generateEnvVarDeclarations(envVars: Set<string>): string {
  if (envVars.size === 0) return ''

  const declarations: string[] = []
  for (const varName of Array.from(envVars).sort()) {
    const jsVarName = varName.toLowerCase()
    const envKey = `AUTOQA_${varName}`
    declarations.push(`const ${jsVarName} = getEnvVar('${envKey}')`)
  }
  return declarations.join('\n') + '\n'
}

/**
 * Generate the full Playwright test file content.
 * @param rawSpecContent - Optional raw (unrendered) spec content for extracting {{VAR}} placeholders
 */
function generateTestFileContent(
  specPath: string,
  spec: MarkdownSpec,
  records: ActionRecord[],
  baseUrl: string,
  loginBaseUrl?: string,
  rawSpecContent?: string,
): { content: string; errors: string[] } {
  const errors: string[] = []
  const stepCodes: string[] = []
  let needsLoginBaseUrl = false
  const allEnvVars = new Set<string>()

  // Parse raw spec to get variable mappings per step
  const { stepVars } = rawSpecContent ? parseRawSpecVars(rawSpecContent) : { stepVars: new Map() }

  for (const step of spec.steps) {
    const stepVarInfo = stepVars.get(step.index)
    const { code, error, needs } = generateStepCode(step, records, baseUrl, loginBaseUrl, stepVarInfo)
    if (error) {
      errors.push(error)
    }
    if (needs?.envVars) {
      needs.envVars.forEach((v) => allEnvVars.add(v))
    }
    if (needs?.loginBaseUrl) needsLoginBaseUrl = true
    if (code) {
      stepCodes.push(`  // Step ${step.index}: ${redactStepTextForExport(step.text, baseUrl, loginBaseUrl, stepVarInfo)}`)
      stepCodes.push(code)
    }
  }

  // Extract test name from spec path
  const testName = specPath
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.md$/i, '')
    ?.replace(/-/g, ' ') ?? 'Exported Test'

  const content = `import { test, expect } from '@playwright/test'
import { loadEnvFiles, getEnvVar } from './autoqa-env'

loadEnvFiles()

const baseUrl = getEnvVar('AUTOQA_BASE_URL')
${needsLoginBaseUrl ? `const loginBaseUrl = getEnvVar('AUTOQA_LOGIN_BASE_URL')\n` : ''}${generateEnvVarDeclarations(allEnvVars)}
test('${escapeString(testName)}', async ({ page }) => {
${stepCodes.join('\n')}
})
`

  return { content, errors }
}

/**
 * Export a Playwright test file from IR and spec.
 */
export async function exportPlaywrightTest(options: ExportOptions): Promise<ExportResult> {
  const { cwd, runId, specPath, spec, baseUrl, loginBaseUrl, rawSpecContent } = options

  // Read IR records for this spec
  let records: ActionRecord[]
  try {
    records = await getSpecActionRecords(cwd, runId, specPath)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      reason: `Failed to read IR file: ${msg}`,
    }
  }

  if (records.length === 0) {
    return {
      ok: false,
      reason: 'Export failed: No IR records found for spec',
    }
  }

  // Check for missing locators on element-targeting actions
  const missingLocatorActions = getMissingLocatorActions(records)
  if (missingLocatorActions.length > 0) {
    const missingDetails = missingLocatorActions.map((r) => {
      const stepInfo = r.stepIndex !== null ? `step ${r.stepIndex}` : 'unknown step'
      return `${r.toolName} at ${stepInfo}`
    })

    return {
      ok: false,
      reason: `Export failed: ${missingLocatorActions.length} action(s) missing valid chosenLocator`,
      missingLocators: missingDetails,
    }
  }

  // Generate test file content
  const { content, errors } = generateTestFileContent(specPath, spec, records, baseUrl, loginBaseUrl, rawSpecContent)

  if (errors.length > 0) {
    return {
      ok: false,
      reason: `Export failed: ${errors.join('; ')}`,
    }
  }

  // Ensure export directory exists
  try {
    await ensureExportDir(cwd)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      reason: `Failed to create export directory: ${msg}`,
    }
  }

  // Write the test file
  const exportPath = getExportPath(cwd, specPath)
  const relativePath = getRelativeExportPath(cwd, specPath)

  try {
    await writeFile(exportPath, content, 'utf-8')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      reason: `Failed to write export file: ${msg}`,
    }
  }

  return {
    ok: true,
    exportPath,
    relativePath,
  }
}

/**
 * Check if a spec is exportable (has IR records with valid locators).
 */
export async function isSpecExportable(
  cwd: string,
  runId: string,
  specPath: string,
): Promise<{ exportable: boolean; reason?: string }> {
  try {
    const records = await getSpecActionRecords(cwd, runId, specPath)

    if (records.length === 0) {
      return { exportable: false, reason: 'No IR records found for spec' }
    }

    const missingLocatorActions = getMissingLocatorActions(records)
    if (missingLocatorActions.length > 0) {
      return {
        exportable: false,
        reason: `${missingLocatorActions.length} action(s) missing valid chosenLocator`,
      }
    }

    return { exportable: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { exportable: false, reason: `Failed to check exportability: ${msg}` }
  }
}
