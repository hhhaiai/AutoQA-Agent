import { join, dirname } from 'node:path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

export type IncludeErrorCode =
  | 'INCLUDE_INVALID_NAME'
  | 'INCLUDE_FILE_NOT_FOUND'
  | 'INCLUDE_NO_STEPS'
  | 'INCLUDE_NESTED_NOT_ALLOWED'

export type IncludeError = {
  code: IncludeErrorCode
  message: string
}

export type ValidateIncludeNameResult = { ok: true } | { ok: false; error: IncludeError }

export type ExpandIncludesResult =
  | { ok: true; value: string[] }
  | { ok: false; error: IncludeError }

const INCLUDE_PATTERN = /^\s*include\s*:\s*(.+?)\s*$/i

const VALID_NAME_PATTERN = /^[A-Za-z0-9_-]+$/

export function isIncludeStep(stepText: string): boolean {
  return INCLUDE_PATTERN.test(stepText)
}

export function parseIncludeName(stepText: string): string | null {
  const match = INCLUDE_PATTERN.exec(stepText)
  if (!match) return null
  return match[1].trim()
}

export function validateIncludeName(name: string): ValidateIncludeNameResult {
  if (!name || name.length === 0) {
    return {
      ok: false,
      error: {
        code: 'INCLUDE_INVALID_NAME',
        message: `Invalid include name: name cannot be empty`,
      },
    }
  }

  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return {
      ok: false,
      error: {
        code: 'INCLUDE_INVALID_NAME',
        message: `Invalid include name "${name}": path separators (/, \\) and ".." are not allowed`,
      },
    }
  }

  if (!VALID_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: {
        code: 'INCLUDE_INVALID_NAME',
        message: `Invalid include name "${name}": only alphanumeric characters, underscores, and hyphens are allowed`,
      },
    }
  }

  return { ok: true }
}

export function resolveIncludePath(name: string, includeRoot: string): string {
  return join(includeRoot, 'steps', `${name}.md`)
}

function getExpectedRelativeIncludePath(name: string): string {
  return `steps/${name}.md`
}

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

function extractListItemText(listItemNode: any): string {
  const children: any[] = Array.isArray(listItemNode?.children) ? listItemNode.children : []
  const paragraphs = children.filter((n) => n?.type === 'paragraph')
  if (paragraphs.length > 0) {
    return paragraphs
      .map((p) => extractNodeText(p).trim())
      .filter((t) => t.length > 0)
      .join(' ')
      .trim()
  }

  return extractNodeText(listItemNode).trim()
}

function collectListItemTexts(listNode: any): string[] {
  const items: any[] = Array.isArray(listNode?.children) ? listNode.children : []
  const texts: string[] = []

  for (const item of items) {
    if (item?.type !== 'listItem') continue
    const t = extractListItemText(item)
    if (t.length > 0) texts.push(t)
  }

  return texts
}

function parseStepsFromMarkdown(markdown: string): string[] | null {
  const tree: any = unified().use(remarkParse).parse(markdown)
  const children: any[] = Array.isArray(tree?.children) ? tree.children : []

  let orderedListNode: any | undefined

  const stepsHeadingIndex = children.findIndex(
    (n) => n?.type === 'heading' && n.depth === 2 && extractNodeText(n).trim().toLowerCase() === 'steps',
  )

  if (stepsHeadingIndex >= 0) {
    for (let i = stepsHeadingIndex + 1; i < children.length; i++) {
      const node = children[i]
      if (node?.type === 'heading' && node.depth <= 2) break
      if (node?.type === 'list' && node.ordered === true) {
        orderedListNode = node
        break
      }
    }
  }

  if (!orderedListNode) {
    for (const node of children) {
      if (node?.type === 'list' && node.ordered === true) {
        orderedListNode = node
        break
      }
    }
  }

  if (!orderedListNode) return null

  const texts = collectListItemTexts(orderedListNode)
  return texts.length > 0 ? texts : null
}

export type ReadFileFn = (path: string) => string | null

export function expandIncludes(
  steps: string[],
  includeRoot: string,
  readFile: ReadFileFn,
): ExpandIncludesResult {
  const expandedSteps: string[] = []

  for (const step of steps) {
    if (!isIncludeStep(step)) {
      expandedSteps.push(step)
      continue
    }

    const name = parseIncludeName(step)
    if (!name) {
      expandedSteps.push(step)
      continue
    }

    const validation = validateIncludeName(name)
    if (!validation.ok) {
      return { ok: false, error: validation.error }
    }

    const includePath = resolveIncludePath(name, includeRoot)
    const content = readFile(includePath)

    if (content === null) {
      return {
        ok: false,
        error: {
          code: 'INCLUDE_FILE_NOT_FOUND',
          message: `Include file not found: "${name}"\nExpected path: ${getExpectedRelativeIncludePath(name)}`,
        },
      }
    }

    const librarySteps = parseStepsFromMarkdown(content)

    if (!librarySteps || librarySteps.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INCLUDE_NO_STEPS',
          message: `Include file "${name}" has no ordered list steps.\nExpected format:\n\n## Steps\n1. First step\n2. Second step\n\nOr simply:\n\n1. First step\n2. Second step`,
        },
      }
    }

    for (const libStep of librarySteps) {
      if (isIncludeStep(libStep)) {
        return {
          ok: false,
          error: {
            code: 'INCLUDE_NESTED_NOT_ALLOWED',
            message: `Nested includes are not allowed (MVP limitation).\nFound "include:" in steps library "${name}"`,
          },
        }
      }
    }

    expandedSteps.push(...librarySteps)
  }

  return { ok: true, value: expandedSteps }
}

export function getIncludeRoot(inputPath: string, isDirectory: boolean): string {
  return isDirectory ? inputPath : dirname(inputPath)
}
