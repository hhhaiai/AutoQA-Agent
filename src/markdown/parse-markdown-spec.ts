import { unified } from 'unified'
import remarkParse from 'remark-parse'

import type { ParseMarkdownSpecResult, MarkdownSpecStep, MarkdownSpecStepKind } from './spec-types.js'

function extractNodeText(node: any): string {
  if (!node) return ''

  const value = node.value
  if (typeof value === 'string') return value

  const children = node.children
  if (Array.isArray(children)) {
    return children.map(extractNodeText).join('')
  }

  return ''
}

function normalizeHeadingText(node: any): string {
  return extractNodeText(node).trim().toLowerCase()
}

function isSectionHeading(node: any, expected: string): boolean {
  return node?.type === 'heading' && node.depth === 2 && normalizeHeadingText(node) === expected
}

function isSectionBoundaryHeading(node: any): boolean {
  return node?.type === 'heading' && typeof node.depth === 'number' && node.depth <= 2
}

function findSectionRange(children: any[], headingIndex: number): { start: number; end: number } {
  const start = headingIndex + 1
  let end = children.length

  for (let i = start; i < children.length; i += 1) {
    if (isSectionBoundaryHeading(children[i])) {
      end = i
      break
    }
  }

  return { start, end }
}

/**
 * Extract text from a list item, separating main text from Expected: clauses.
 * Returns an object with the main text and optional expected result.
 */
function extractListItemText(listItemNode: any): { text: string; expectedResult?: string } {
  const children: any[] = Array.isArray(listItemNode?.children) ? listItemNode.children : []

  // Separate paragraphs from nested lists (which contain Expected: clauses)
  const paragraphs = children.filter((n) => n?.type === 'paragraph')
  const nestedLists = children.filter((n) => n?.type === 'list')

  // Extract main text from paragraphs (excluding Expected: clauses)
  const mainTextParts: string[] = []
  for (const p of paragraphs) {
    const fullText = extractNodeText(p).trim()
    if (!fullText) continue

    // Check if this paragraph is solely an "Expected:" clause (starts with "Expected:" or "- Expected:")
    if (/^[\s\-•]*\s*expected:\s*/i.test(fullText)) {
      // This paragraph is only an Expected clause, skip it
      continue
    }

    // Check if the paragraph ends with an Expected clause (e.g., "Action text\nExpected: result")
    const trailingExpectedMatch = fullText.match(/^(.+?)\n\s*[-•]?\s*expected:\s*(.+)$/is)
    if (trailingExpectedMatch) {
      // Extract the main text (before Expected)
      mainTextParts.push(trailingExpectedMatch[1]!.trim())
      // The Expected part will be extracted in the fallback section below
      continue
    }

    // Regular paragraph, include it
    mainTextParts.push(fullText)
  }

  const text = mainTextParts.join(' ').trim()

  // Extract expectedResult from nested list items starting with "Expected:"
  let expectedResult: string | undefined
  for (const list of nestedLists) {
    const items: any[] = Array.isArray(list?.children) ? list.children : []
    for (const item of items) {
      const itemText = extractNodeText(item).trim()
      // Match "Expected:", "- Expected:", "• Expected:", etc.
      if (/^[\s\-•]*\s*expected:\s*/i.test(itemText)) {
        // Remove the "Expected:" prefix
        expectedResult = itemText.replace(/^[\s\-•]*\s*expected:\s*/i, '').trim()
        break
      }
    }
    if (expectedResult) break
  }

  // Fallback: if no nested list, check for "Expected:" in paragraphs
  if (!expectedResult) {
    for (const p of paragraphs) {
      const text = extractNodeText(p).trim()
      // Match "Expected: ..." at the start of the paragraph
      let match = text.match(/^[\s\-•]*\s*expected:\s*(.+)$/i)
      if (match) {
        expectedResult = match[1]!.trim()
        break
      }
      // Match "...action text\nExpected: ..." format
      match = text.match(/^(?:.+?)\n\s*[-•]?\s*expected:\s*(.+)$/is)
      if (match) {
        expectedResult = match[1]!.trim()
        break
      }
    }
  }

  return expectedResult ? { text, expectedResult } : { text }
}

/**
 * Legacy function that returns only text (for backward compatibility).
 */
function extractListItemTextLegacy(listItemNode: any): string {
  const result = extractListItemText(listItemNode)
  return result.text
}

function collectListItemTexts(listNode: any): string[] {
  const items: any[] = Array.isArray(listNode?.children) ? listNode.children : []
  const texts: string[] = []

  for (const item of items) {
    if (item?.type !== 'listItem') continue
    const t = extractListItemTextLegacy(item)  // Use legacy version for preconditions
    if (t.length > 0) texts.push(t)
  }

  return texts
}

export function classifyStepKind(text: string): MarkdownSpecStepKind {
  const t = text.trim()
  const lower = t.toLowerCase()

  if (lower.startsWith('verify') || lower.startsWith('assert')) return 'assertion'
  if (t.startsWith('验证') || t.startsWith('断言')) return 'assertion'
  return 'action'
}

export function parseMarkdownSpec(markdown: string): ParseMarkdownSpecResult {
  const md = markdown ?? ''
  const tree: any = unified().use(remarkParse).parse(md)

  const children: any[] = Array.isArray(tree?.children) ? tree.children : []

  const preconditionsHeadingIndex = children.findIndex((n) => isSectionHeading(n, 'preconditions'))
  if (preconditionsHeadingIndex < 0) {
    return {
      ok: false,
      error: {
        code: 'MARKDOWN_MISSING_PRECONDITIONS',
        message:
          'Missing required section: ## Preconditions. Minimum example:\n\n## Preconditions\n- ...\n\n## Steps\n1. ...\n',
      },
    }
  }

  const preRange = findSectionRange(children, preconditionsHeadingIndex)

  let preconditionsListNode: any | undefined
  for (let i = preRange.start; i < preRange.end; i += 1) {
    const node = children[i]
    if (node?.type === 'list') {
      preconditionsListNode = node
      break
    }
  }

  const preconditions: string[] = preconditionsListNode ? collectListItemTexts(preconditionsListNode) : []

  if (preconditions.length === 0) {
    return {
      ok: false,
      error: {
        code: 'MARKDOWN_EMPTY_PRECONDITIONS',
        message:
          'Preconditions section is present but contains no list items. Minimum example:\n\n## Preconditions\n- ...\n\n## Steps\n1. ...\n',
      },
    }
  }

  let stepsListNode: any | undefined

  const stepsHeadingIndex = children.findIndex(
    (n, idx) => idx > preconditionsHeadingIndex && isSectionHeading(n, 'steps'),
  )
  if (stepsHeadingIndex >= 0) {
    const stepsRange = findSectionRange(children, stepsHeadingIndex)
    for (let i = stepsRange.start; i < stepsRange.end; i += 1) {
      const node = children[i]
      if (node?.type === 'list' && node.ordered === true) {
        stepsListNode = node
        break
      }
    }
  }

  if (!stepsListNode) {
    const preconditionsListIndex = preconditionsListNode ? children.indexOf(preconditionsListNode) : -1
    const searchStart = preconditionsListIndex >= 0 ? preconditionsListIndex + 1 : preconditionsHeadingIndex + 1

    for (let i = searchStart; i < children.length; i += 1) {
      const node = children[i]
      if (node === preconditionsListNode) continue
      if (node?.type === 'list' && node.ordered === true) {
        stepsListNode = node
        break
      }
    }
  }

  if (!stepsListNode) {
    return {
      ok: false,
      error: {
        code: 'MARKDOWN_MISSING_STEPS',
        message:
          'Missing required ordered list steps (e.g. "1."/"2."). Minimum example:\n\n## Preconditions\n- ...\n\n## Steps\n1. ...\n',
      },
    }
  }

  const rawStepTexts = collectListItemTexts(stepsListNode)

  if (rawStepTexts.length === 0) {
    return {
      ok: false,
      error: {
        code: 'MARKDOWN_EMPTY_STEPS',
        message:
          'Steps list is present but contains no items. Minimum example:\n\n## Preconditions\n- ...\n\n## Steps\n1. ...\n',
      },
    }
  }

  const startIndex: number = typeof stepsListNode.start === 'number' ? stepsListNode.start : 1

  // Extract step items with their expectedResult
  const stepItems: Array<{ text: string; expectedResult?: string }> = []
  const items: any[] = Array.isArray(stepsListNode?.children) ? stepsListNode.children : []
  for (const item of items) {
    if (item?.type !== 'listItem') continue
    const extracted = extractListItemText(item)
    stepItems.push(extracted)
  }

  const steps: MarkdownSpecStep[] = stepItems.map((step, idx) => {
    const index = startIndex + idx
    const kind = classifyStepKind(step.text)

    return {
      index,
      text: step.text,
      kind,
      expectedResult: step.expectedResult,
    }
  })

  return {
    ok: true,
    value: {
      preconditions,
      steps,
    },
  }
}
