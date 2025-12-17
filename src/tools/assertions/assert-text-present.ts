import type { Page } from 'playwright'

import type { ToolResult } from '../tool-result.js'
import { fail, ok } from '../tool-result.js'
import { toToolError } from '../playwright-error.js'

export type AssertTextPresentInput = {
  page: Page
  text: string
}

export type AssertTextPresentData = {
  textLength: number
}

export async function assertTextPresent(
  input: AssertTextPresentInput,
): Promise<ToolResult<AssertTextPresentData>> {
  const anyInput = input as any
  if (!anyInput || typeof anyInput !== 'object') {
    return fail({
      code: 'INVALID_INPUT',
      message: 'input must be an object',
      retriable: false,
      cause: undefined,
    })
  }

  const page = anyInput.page as Page | undefined
  if (!page) {
    return fail({
      code: 'INVALID_INPUT',
      message: 'page is required',
      retriable: false,
      cause: undefined,
    })
  }

  const text = typeof anyInput.text === 'string' ? anyInput.text.trim() : ''
  if (!text) {
    return fail({
      code: 'INVALID_INPUT',
      message: 'text is required',
      retriable: false,
      cause: undefined,
    })
  }

  try {
    const locator = page.getByText(text)
    const count = await locator.count()
    if (count > 0) {
      const limit = Math.min(count, 5)
      for (let i = 0; i < limit; i++) {
        const candidate = locator.nth(i)
        if (await candidate.isVisible()) {
          return ok({ textLength: text.length })
        }
      }
    }

    return fail({
      code: 'ASSERTION_FAILED',
      message: `Text not found on page: "${text}"`,
      retriable: true,
      cause: undefined,
    })
  } catch (err: unknown) {
    const toolError = toToolError(err, { defaultCode: 'ASSERTION_FAILED' })
    return fail(toolError)
  }
}
