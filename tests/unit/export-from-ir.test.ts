import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { exportFromIR, isSpecExportable } from '../../src/runner/export-from-ir.js'
import type { MarkdownSpec } from '../../src/markdown/spec-types.js'
import type { ActionRecord } from '../../src/ir/types.js'

describe('export-from-ir', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `export-from-ir-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  async function setupIRFile(records: ActionRecord[]): Promise<string> {
    const runId = 'test-run'
    const irDir = join(testDir, '.autoqa', 'runs', runId)
    await mkdir(irDir, { recursive: true })

    const irPath = join(irDir, 'ir.jsonl')
    const content = records.map((r) => JSON.stringify(r)).join('\n')
    await writeFile(irPath, content, 'utf-8')

    return runId
  }

  function createMockRecord(overrides: Partial<ActionRecord> = {}): ActionRecord {
    return {
      runId: 'test-run',
      specPath: join(testDir, 'specs', 'test.md'),
      stepIndex: 1,
      toolName: 'click',
      toolInput: {},
      outcome: { ok: true },
      timestamp: Date.now(),
      ...overrides,
    }
  }

  function createMockSpec(): MarkdownSpec {
    return {
      preconditions: ['Base URL accessible'],
      steps: [
        { index: 1, text: 'Navigate to /', kind: 'action' },
        { index: 2, text: "Fill the 'Username' field with testuser", kind: 'action' },
        { index: 3, text: "Click the 'Login' button", kind: 'action' },
        { index: 4, text: "Verify the page shows 'Dashboard'", kind: 'assertion' },
      ],
    }
  }

  describe('exportFromIR', () => {
    it('exports a valid Playwright test file', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec = createMockSpec()

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: '/' },
        }),
        createMockRecord({
          specPath,
          stepIndex: 2,
          toolName: 'fill',
          toolInput: { textLength: 8, fillValue: { kind: 'literal', value: 'testuser' } },
          element: {
            fingerprint: { tagName: 'input' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByTestId',
              value: 'username',
              code: "page.getByTestId('username')",
              validation: { unique: true },
            },
          },
        }),
        createMockRecord({
          specPath,
          stepIndex: 3,
          toolName: 'click',
          toolInput: {},
          element: {
            fingerprint: { tagName: 'button' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByRole',
              value: 'button',
              code: "page.getByRole('button', { name: 'Login' })",
              validation: { unique: true },
            },
          },
        }),
        createMockRecord({
          specPath,
          stepIndex: 4,
          toolName: 'assertTextPresent',
          toolInput: { text: 'Dashboard', visibleNth: 0 },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.relativePath).toBe('tests/autoqa/specs-test.spec.ts')

        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("import { test, expect } from '@playwright/test'")
        expect(content).toContain('loadEnvFiles()')
        expect(content).toContain("const baseUrl = getEnvVar('AUTOQA_BASE_URL')")
        expect(content).toContain('page.goto')
        expect(content).toContain("page.getByTestId('username').fill")
        expect(content).toContain("page.getByRole('button', { name: 'Login' }).click()")
        expect(content).toContain("page.getByText('Dashboard')")
      }
    })

    it('uses IR toolName as single source of truth (regression test for select bug)', async () => {
      // This test verifies the fix for the bug where:
      // - Spec step text: "选择 '活动营销' 从 导航菜单" (matches parseSelectStep pattern)
      // - IR toolName: 'click' (actual action performed)
      // - Old behavior: generated .selectOption() (WRONG - based on text parsing)
      // - New behavior: generated .click() (CORRECT - based on IR toolName)

      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: "选择 '活动营销' 从 导航菜单", kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'click',  // IR says it's a click, not select
          toolInput: {},
          element: {
            fingerprint: { tagName: 'span', textSnippet: '活动营销' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'textExact',
              value: '活动营销',
              code: "page.getByText('活动营销', { exact: true })",
              validation: { unique: true, visible: true, enabled: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        // Should generate click (based on IR toolName), not selectOption
        expect(content).toContain("page.getByText('活动营销', { exact: true }).click()")
        // Should NOT contain selectOption (the old bug would generate this)
        expect(content).not.toContain('.selectOption')
      }
    })

    it('generates selectOption when IR toolName is select_option', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: "Select 'Option A' from the 'Dropdown'", kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'select_option',
          toolInput: { label: 'Option A' },
          element: {
            fingerprint: { tagName: 'select' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByTestId',
              value: 'dropdown',
              code: "page.getByTestId('dropdown')",
              validation: { unique: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("page.getByTestId('dropdown').selectOption")
        expect(content).toContain("label: 'Option A'")
      }
    })

    it('generates TODO comment when step has no IR record', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Navigate to /', kind: 'action' },
          { index: 2, text: "Verify the page shows 'Products'", kind: 'assertion' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: '/' },
        }),
        // No IR record for step 2
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain('// TODO: Step 2 - No IR record found')
      }
    })

    it('fails when no IR records found for spec', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [{ index: 1, text: 'Navigate to /', kind: 'action' }],
      }

      const runId = await setupIRFile([])

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('No IR records found')
      }
    })

    it('fails when element-targeting action is missing chosenLocator', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: "Click the 'Login' button", kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'click',
          toolInput: {},
          // No element/chosenLocator
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('missing valid chosenLocator')
      }
    })

    it('generates assertElementVisible code correctly', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Navigate to /', kind: 'action' },
          { index: 2, text: "Assert that 'Login' button is visible", kind: 'assertion' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: '/' },
        }),
        createMockRecord({
          specPath,
          stepIndex: 2,
          toolName: 'assertElementVisible',
          toolInput: {},
          element: {
            fingerprint: { tagName: 'button' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByRole',
              value: 'button:Login',
              code: "page.getByRole('button', { name: 'Login' })",
              validation: { unique: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("page.getByRole('button', { name: 'Login' })")
        expect(content).toContain('toHaveCount(1)')
        expect(content).toContain('toBeVisible()')
      }
    })

    it('handles fill with template_var fillValue', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: "Fill the 'Username' field with standard_user", kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'fill',
          toolInput: {
            textLength: 13,
            fillValue: { kind: 'template_var', name: 'USERNAME' },
          },
          element: {
            fingerprint: { tagName: 'input' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByTestId',
              value: 'username',
              code: "page.getByTestId('username')",
              validation: { unique: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("const username = getEnvVar('AUTOQA_USERNAME')")
        expect(content).toContain("page.getByTestId('username').fill(username)")
        expect(content).not.toContain(".fill('standard_user')")
      }
    })

    it('handles fill with literal fillValue', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: "Fill the search field with 暖场", kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'fill',
          toolInput: {
            textLength: 2,
            fillValue: { kind: 'literal', value: '暖场' },
          },
          element: {
            fingerprint: { tagName: 'input' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByPlaceholder',
              value: '输入直播名称或频道号',
              code: "page.getByPlaceholder('输入直播名称或频道号')",
              validation: { unique: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("page.getByPlaceholder('输入直播名称或频道号').fill('暖场')")
      }
    })

    it('handles navigate with relative URL', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Navigate to /login', kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: '/login' },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("await page.goto(new URL('/login', baseUrl).toString())")
      }
    })

    it('handles navigate with absolute URL from different origin', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Navigate to https://external.com/page', kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: 'https://external.com/page' },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("await page.goto('https://external.com/page')")
      }
    })

    it('uses env vars for template variables in raw spec content', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Navigate to {{BASE_URL}}/login', kind: 'action' },
        ],
      }

      const rawSpecContent = `## Steps

1. Navigate to {{BASE_URL}}/login
`

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: 'https://example.com/login' }, // Rendered URL
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
        rawSpecContent,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain("await page.goto(new URL('/login', baseUrl).toString())")
      }
    })

    it('skips scroll and wait actions (runtime-only)', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Navigate to /', kind: 'action' },
          { index: 2, text: 'Scroll down', kind: 'action' },
          { index: 3, text: 'Wait for 1 second', kind: 'action' },
          { index: 4, text: "Click the 'Submit' button", kind: 'action' },
        ],
      }

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'navigate',
          toolInput: { url: '/' },
        }),
        createMockRecord({
          specPath,
          stepIndex: 2,
          toolName: 'scroll',
          toolInput: {},
        }),
        createMockRecord({
          specPath,
          stepIndex: 3,
          toolName: 'wait',
          toolInput: {},
        }),
        createMockRecord({
          specPath,
          stepIndex: 4,
          toolName: 'click',
          toolInput: {},
          element: {
            fingerprint: { tagName: 'button' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByRole',
              value: 'button',
              code: "page.getByRole('button', { name: 'Submit' })",
              validation: { unique: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        // Should have navigate and click, but no scroll/wait code
        expect(content).toContain('page.goto')
        expect(content).toContain('.click()')
        // Scroll and wait actions should not generate code (they're runtime-only)
        expect(content).not.toContain('scroll')
        // waitForLoadState is added after navigate for stability, which is fine
        // But wait tool actions should not generate standalone wait() calls
        expect(content).not.toContain('await page.wait(')
      }
    })

    it('generates TODO for unsupported tool types', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const spec: MarkdownSpec = {
        preconditions: ['Base URL accessible'],
        steps: [
          { index: 1, text: 'Some unknown action', kind: 'action' },
        ],
      }

      // Cast to unknown tool to test error handling
      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'unknown' as any,
          toolInput: {},
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await exportFromIR({
        cwd: testDir,
        runId,
        specPath,
        spec,
        baseUrl: 'https://example.com',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        const content = await readFile(result.exportPath, 'utf-8')
        expect(content).toContain('// TODO: Step 1 - Unsupported tool')
      }
    })
  })

  describe('isSpecExportable', () => {
    it('returns exportable: true when all actions have valid locators', async () => {
      const specPath = join(testDir, 'specs', 'test.md')

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'click',
          outcome: { ok: true },
          element: {
            fingerprint: { tagName: 'button' },
            locatorCandidates: [],
            chosenLocator: {
              kind: 'getByTestId',
              value: 'btn',
              code: "page.getByTestId('btn')",
              validation: { unique: true },
            },
          },
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await isSpecExportable(testDir, runId, specPath)
      expect(result.exportable).toBe(true)
    })

    it('returns exportable: false when actions are missing locators', async () => {
      const specPath = join(testDir, 'specs', 'test.md')

      const records: ActionRecord[] = [
        createMockRecord({
          specPath,
          stepIndex: 1,
          toolName: 'click',
          outcome: { ok: true },
          // No element/chosenLocator
        }),
      ]

      const runId = await setupIRFile(records)

      const result = await isSpecExportable(testDir, runId, specPath)
      expect(result.exportable).toBe(false)
      expect(result.reason).toContain('missing valid chosenLocator')
    })

    it('returns exportable: false when no IR records found', async () => {
      const specPath = join(testDir, 'specs', 'test.md')
      const runId = await setupIRFile([])

      const result = await isSpecExportable(testDir, runId, specPath)
      expect(result.exportable).toBe(false)
      expect(result.reason).toContain('No IR records found')
    })
  })
})
