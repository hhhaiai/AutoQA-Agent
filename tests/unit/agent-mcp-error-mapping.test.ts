import { describe, expect, it, vi } from 'vitest'

import { createBrowserToolsMcpServer } from '../../src/agent/browser-tools-mcp.js'
import type { Logger } from '../../src/logging/index.js'

const logMock = vi.fn()
const mockLogger: Logger = {
  log: logMock as any,
  flush: vi.fn(async () => {}),
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k]
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }

  return fn().finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
}

function extractSummaryText(result: any): string {
  const blocks = Array.isArray(result?.content) ? result.content : []
  const textBlocks = blocks.filter((b: any) => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
  const last = textBlocks[textBlocks.length - 1]
  return typeof last?.text === 'string' ? last.text : ''
}

describe('agent/mcp error mapping', () => {
  it('does not inject image block on success (token friendly)', async () => {
    await withEnv(
      {
        AUTOQA_ARTIFACTS: 'none',
        AUTOQA_TOOL_CONTEXT: 'screenshot',
      },
      async () => {
        const buffer = Buffer.from('jpeg-bytes')

        const page: any = {
          screenshot: vi.fn(async () => buffer),
          viewportSize: vi.fn(() => ({ width: 1024, height: 768 })),
          goto: vi.fn(async () => {}),
        }

        const server = createBrowserToolsMcpServer({
          page,
          baseUrl: 'http://example.test',
          runId: 'run-1',
          debug: false,
          cwd: '/tmp/test-cwd',
          specPath: '/specs/a.md',
          logger: mockLogger,
        })

        const mcp = (server as any).instance as any
        const navigateTool = mcp._registeredTools?.navigate
        expect(navigateTool).toBeTruthy()

        const out = await navigateTool.callback({ url: '/login' }, {})

        expect(out.isError).toBe(false)

        const hasImage = (out.content ?? []).some((b: any) => b && typeof b === 'object' && b.type === 'image')
        expect(hasImage).toBe(false)

        const summaryText = extractSummaryText(out)
        const summary = JSON.parse(summaryText)

        expect(summary.ok).toBe(true)
        expect(summary.data.url).toBe('http://example.test/login')
      },
    )
  })

  it('sets isError=true and includes error.code on failure (no image blocks)', async () => {
    await withEnv(
      {
        AUTOQA_ARTIFACTS: 'none',
        AUTOQA_TOOL_CONTEXT: 'screenshot',
      },
      async () => {
        const buffer = Buffer.from('jpeg-bytes')

        const page: any = {
          screenshot: vi.fn(async () => buffer),
          viewportSize: vi.fn(() => ({ width: 1024, height: 768 })),
          locator: vi.fn((selector: string) => {
            const locator: any = {
              first: vi.fn(() => locator),
              count: vi.fn(async () => 0),
            }
            expect(selector).toBe('aria-ref=e1')
            return locator
          }),
        }

        const server = createBrowserToolsMcpServer({
          page,
          baseUrl: 'http://example.test',
          runId: 'run-2',
          debug: false,
          cwd: '/tmp/test-cwd',
          specPath: '/specs/a.md',
          logger: mockLogger,
        })

        const mcp = (server as any).instance as any
        const clickTool = mcp._registeredTools?.click
        expect(clickTool).toBeTruthy()

        const out = await clickTool.callback({ ref: 'e1' }, {})

        expect(out.isError).toBe(true)

        const hasImage = (out.content ?? []).some((b: any) => b && typeof b === 'object' && b.type === 'image')
        expect(hasImage).toBe(false)

        const summaryText = extractSummaryText(out)
        const summary = JSON.parse(summaryText)

        expect(summary.ok).toBe(false)
        expect(summary.error.code).toBe('ELEMENT_NOT_FOUND')
      },
    )
  })

  it('does not call _snapshotForAI when aria-ref already resolves (prevents ref remap)', async () => {
    await withEnv(
      {
        AUTOQA_ARTIFACTS: 'none',
        AUTOQA_TOOL_CONTEXT: 'screenshot',
      },
      async () => {
        const buffer = Buffer.from('jpeg-bytes')

        const snapshotForAI = vi.fn(async () => ({}))

        const locator: any = {
          first: vi.fn(() => locator),
          count: vi.fn(async () => 1),
          click: vi.fn(async () => {}),
        }

        const page: any = {
          screenshot: vi.fn(async () => buffer),
          viewportSize: vi.fn(() => ({ width: 1024, height: 768 })),
          locator: vi.fn((selector: string) => {
            expect(selector).toBe('aria-ref=e34')
            return locator
          }),
          _snapshotForAI: snapshotForAI,
        }

        const server = createBrowserToolsMcpServer({
          page,
          baseUrl: 'http://example.test',
          runId: 'run-3',
          debug: false,
          cwd: '/tmp/test-cwd',
          specPath: '/specs/a.md',
          logger: mockLogger,
          enableIR: false,
        })

        const mcp = (server as any).instance as any
        const clickTool = mcp._registeredTools?.click
        expect(clickTool).toBeTruthy()

        const out = await clickTool.callback({ ref: 'e34' }, {})

        expect(out.isError).toBe(false)
        expect(snapshotForAI).not.toHaveBeenCalled()
      },
    )
  })

  it('calls _snapshotForAI only as fallback when aria-ref is missing', async () => {
    await withEnv(
      {
        AUTOQA_ARTIFACTS: 'none',
        AUTOQA_TOOL_CONTEXT: 'screenshot',
      },
      async () => {
        const buffer = Buffer.from('jpeg-bytes')

        let refreshed = false
        const snapshotForAI = vi.fn(async () => {
          refreshed = true
          return {}
        })

        const locator: any = {
          first: vi.fn(() => locator),
          count: vi.fn(async () => (refreshed ? 1 : 0)),
          click: vi.fn(async () => {}),
        }

        const page: any = {
          screenshot: vi.fn(async () => buffer),
          viewportSize: vi.fn(() => ({ width: 1024, height: 768 })),
          locator: vi.fn((selector: string) => {
            expect(selector).toBe('aria-ref=e99')
            return locator
          }),
          _snapshotForAI: snapshotForAI,
        }

        const server = createBrowserToolsMcpServer({
          page,
          baseUrl: 'http://example.test',
          runId: 'run-4',
          debug: false,
          cwd: '/tmp/test-cwd',
          specPath: '/specs/a.md',
          logger: mockLogger,
          enableIR: false,
        })

        const mcp = (server as any).instance as any
        const clickTool = mcp._registeredTools?.click
        expect(clickTool).toBeTruthy()

        const out = await clickTool.callback({ ref: 'e99' }, {})

        expect(out.isError).toBe(false)
        expect(snapshotForAI).toHaveBeenCalledTimes(1)
      },
    )
  })
})
