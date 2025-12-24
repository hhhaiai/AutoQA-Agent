import { describe, expect, it } from 'vitest'

import { parseMarkdownSpec } from '../../src/markdown/parse-markdown-spec.js'

describe('parseMarkdownSpec', () => {
  it('parses preconditions and ordered steps with step kind classification', () => {
    const md = `# Title

## Preconditions
- Logged in
- Test data seeded

## Steps
1. Navigate to /home
2. Verify the welcome banner is visible
3. 断言 页面标题包含 Home
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.preconditions).toEqual(['Logged in', 'Test data seeded'])
    expect(result.value.steps).toEqual([
      { index: 1, text: 'Navigate to /home', kind: 'action' },
      { index: 2, text: 'Verify the welcome banner is visible', kind: 'assertion' },
      { index: 3, text: '断言 页面标题包含 Home', kind: 'assertion' },
    ])
  })

  it('ignores a ## Steps section that appears before ## Preconditions and uses the one after Preconditions', () => {
    const md = `# Title

## Steps
1. Wrong section

## Preconditions
- Logged in

## Steps
1. Navigate to /home
2. Verify the welcome banner is visible
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.steps).toEqual([
      { index: 1, text: 'Navigate to /home', kind: 'action' },
      { index: 2, text: 'Verify the welcome banner is visible', kind: 'assertion' },
    ])
  })

  it('uses the first ordered list after Preconditions as steps when ## Steps heading is missing', () => {
    const md = `# Title

## Preconditions
- Logged in

1. Navigate to /home
2. Verify the welcome banner is visible
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.steps).toEqual([
      { index: 1, text: 'Navigate to /home', kind: 'action' },
      { index: 2, text: 'Verify the welcome banner is visible', kind: 'assertion' },
    ])
  })

  it('returns MARKDOWN_MISSING_PRECONDITIONS when Preconditions section is missing', () => {
    const md = `# Title

## Steps
1. Do something
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.error.code).toBe('MARKDOWN_MISSING_PRECONDITIONS')
  })

  it('returns MARKDOWN_EMPTY_PRECONDITIONS when Preconditions section has no list items', () => {
    const md = `# Title

## Preconditions

## Steps
1. Do something
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.error.code).toBe('MARKDOWN_EMPTY_PRECONDITIONS')
  })

  it('returns MARKDOWN_MISSING_STEPS when ordered steps are missing', () => {
    const md = `# Title

## Preconditions
- Logged in

Some content

- Not an ordered step
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.error.code).toBe('MARKDOWN_MISSING_STEPS')
  })

  it('returns MARKDOWN_EMPTY_STEPS when steps list contains only empty items', () => {
    const md = `# Title

## Preconditions
- Logged in

## Steps
1.
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.error.code).toBe('MARKDOWN_EMPTY_STEPS')
  })

  it('does not include nested list item text in the step text', () => {
    const md = `# Title

## Preconditions
- Logged in

## Steps
1. Do the thing
   - Nested detail that should not be part of the step
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.steps[0]).toEqual({ index: 1, text: 'Do the thing', kind: 'action' })
  })

  it('joins multi-paragraph list item text with spaces', () => {
    const md = `# Title

## Preconditions
- Logged in

## Steps
1. Do the thing

   With more detail
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.steps[0]).toEqual({ index: 1, text: 'Do the thing With more detail', kind: 'action' })
  })

  it('extracts expectedResult from "- Expected:" clause in step text', () => {
    const md = `# Title

## Preconditions
- Logged in

## Steps
1. Click the 'Create Channel' or 'Submit' button
   - Expected: Form submission initiates and success message appears indicating channel creation
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.steps[0]).toEqual({
      index: 1,
      text: "Click the 'Create Channel' or 'Submit' button",
      kind: 'action',
      expectedResult: 'Form submission initiates and success message appears indicating channel creation',
    })
  })

  it('extracts expectedResult from "Expected:" clause (without dash)', () => {
    const md = `# Title

## Preconditions
- Logged in

## Steps
1. Click the 'Create Channel' or 'Submit' button
   Expected: Form submission initiates and success message appears
`

    const result = parseMarkdownSpec(md)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.steps[0]).toEqual({
      index: 1,
      text: "Click the 'Create Channel' or 'Submit' button",
      kind: 'action',
      expectedResult: 'Form submission initiates and success message appears',
    })
  })
})
