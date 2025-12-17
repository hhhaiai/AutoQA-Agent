import { describe, expect, it, vi } from 'vitest'

import { assertTextPresent } from '../../src/tools/assertions/assert-text-present.js'
import { assertElementVisible } from '../../src/tools/assertions/assert-element-visible.js'
import { RUN_AGENT_ALLOWED_TOOLS } from '../../src/agent/run-agent.js'

function timeoutError(message = 'Timeout'): Error {
  const err = new Error(message)
  ;(err as any).name = 'TimeoutError'
  return err
}

function locatorMock(options?: {
  count?: number
  visibleNth?: number
}): any {
  const count = options?.count ?? 1
  const visibleNth = options?.visibleNth ?? 0

  const locator: any = {
    count: vi.fn(async () => count),
    first: vi.fn(() => locator),
    isVisible: vi.fn(async () => count > 0),
  }

  locator.nth = vi.fn((i: number) => {
    const isVisible = vi.fn(async () => i === visibleNth && count > 0)
    return Object.assign({}, locator, { isVisible })
  })

  return locator
}

describe('assertTextPresent', () => {
  it('returns ok=true when text is found on page', async () => {
    const page: any = {
      getByText: vi.fn(() => locatorMock({ count: 1, visibleNth: 0 })),
    }

    const result = await assertTextPresent({ page, text: 'Welcome' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.textLength).toBe('Welcome'.length)
    }
  })

  it('returns ok=false with ASSERTION_FAILED when text is not found', async () => {
    const page: any = {
      getByText: vi.fn(() => locatorMock({ count: 0 })),
    }

    const result = await assertTextPresent({ page, text: 'Goodbye' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ASSERTION_FAILED')
      expect(result.error.retriable).toBe(true)
      expect(result.error.message).toContain('Goodbye')
    }
  })

  it('returns INVALID_INPUT when text is empty', async () => {
    const page: any = {
      getByText: vi.fn(() => locatorMock({ count: 1 })),
    }

    const result = await assertTextPresent({ page, text: '' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
      expect(result.error.retriable).toBe(false)
    }
  })

  it('returns INVALID_INPUT when page is missing', async () => {
    const result = await assertTextPresent({ page: undefined as any, text: 'test' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
      expect(result.error.retriable).toBe(false)
    }
  })

  it('maps timeout to TIMEOUT and does not throw', async () => {
    const page: any = {
      getByText: vi.fn(() => ({
        count: vi.fn(async () => {
          throw timeoutError('Timeout waiting for text')
        }),
      })),
    }

    const result = await assertTextPresent({ page, text: 'test' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('TIMEOUT')
      expect(result.error.retriable).toBe(true)
    }
  })

  it('does not throw on non-object input', async () => {
    const result = await assertTextPresent(undefined as any)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
    }
  })
})

describe('assertElementVisible', () => {
  it('returns ok=true when element is visible', async () => {
    const locator = locatorMock({ count: 1 })

    const page: any = {
      getByRole: vi.fn(() => locator),
      getByText: vi.fn(() => locator),
    }

    const result = await assertElementVisible({ page, targetDescription: 'Login button' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.targetDescription).toBe('Login button')
    }
  })

  it('returns ok=false with ASSERTION_FAILED when element is not found', async () => {
    const locator = locatorMock({ count: 0 })

    const page: any = {
      getByRole: vi.fn(() => locator),
      getByText: vi.fn(() => locator),
    }

    const result = await assertElementVisible({ page, targetDescription: 'Nonexistent element' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ASSERTION_FAILED')
      expect(result.error.retriable).toBe(true)
      expect(result.error.message).toContain('Nonexistent element')
    }
  })

  it('returns INVALID_INPUT when targetDescription is empty', async () => {
    const page: any = {
      getByRole: vi.fn(() => locatorMock()),
      getByText: vi.fn(() => locatorMock()),
    }

    const result = await assertElementVisible({ page, targetDescription: '' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
      expect(result.error.retriable).toBe(false)
    }
  })

  it('returns INVALID_INPUT when page is missing', async () => {
    const result = await assertElementVisible({ page: undefined as any, targetDescription: 'test' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
      expect(result.error.retriable).toBe(false)
    }
  })

  it('maps timeout to TIMEOUT and does not throw', async () => {
    const locator: any = {
      count: vi.fn(async () => 1),
      nth: vi.fn(() => ({
        isVisible: vi.fn(async () => {
          throw timeoutError('Timeout')
        }),
      })),
    }

    const page: any = {
      getByRole: vi.fn(() => locator),
      getByText: vi.fn(() => locator),
    }

    const result = await assertElementVisible({ page, targetDescription: 'Some element' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('TIMEOUT')
      expect(result.error.retriable).toBe(true)
    }
  })

  it('does not throw on non-object input', async () => {
    const result = await assertElementVisible(undefined as any)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
    }
  })

  it('uses attribute selectors when targetDescription contains id', async () => {
    const locator = locatorMock({ count: 1 })

    const page: any = {
      locator: vi.fn(() => locator),
      getByRole: vi.fn(() => locatorMock({ count: 0 })),
      getByText: vi.fn(() => locatorMock({ count: 0 })),
    }

    const result = await assertElementVisible({ page, targetDescription: 'element with id=login-btn' })

    expect(result.ok).toBe(true)
    expect(page.locator).toHaveBeenCalledWith('#login-btn')
  })
})

describe('assertion tools allowedTools integration check', () => {
  it('run-agent.ts allowedTools should include assertion tools', async () => {
    expect(RUN_AGENT_ALLOWED_TOOLS).toContain('mcp__browser__assertTextPresent')
    expect(RUN_AGENT_ALLOWED_TOOLS).toContain('mcp__browser__assertElementVisible')
  })
})
