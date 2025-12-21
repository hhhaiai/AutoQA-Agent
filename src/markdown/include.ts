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
const VALID_PATH_PATTERN = /^[A-Za-z0-9_\/-]+(\.md)?$/

export function isIncludeStep(stepText: string): boolean {
  return INCLUDE_PATTERN.test(stepText)
}

export function parseIncludeName(stepText: string): string | null {
  const match = INCLUDE_PATTERN.exec(stepText)
  if (!match) return null
  return match[1].trim()
}

/**
 * Validates and normalizes an include name/path.
 * Supports:
 * - Simple names: "login" → "login.md"
 * - Relative paths: "polyv/login.md" → "polyv/login.md"
 * - Relative paths without extension: "polyv/login" → "polyv/login.md"
 */
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

  // Disallow path traversal
  if (name.includes('..') || name.includes('\\')) {
    return {
      ok: false,
      error: {
        code: 'INCLUDE_INVALID_NAME',
        message: `Invalid include name "${name}": ".." and backslashes are not allowed`,
      },
    }
  }

  // Allow forward slashes for relative paths (e.g., "polyv/login.md")
  // But validate the overall pattern
  if (!VALID_PATH_PATTERN.test(name)) {
    return {
      ok: false,
      error: {
        code: 'INCLUDE_INVALID_NAME',
        message: `Invalid include name "${name}": only alphanumeric characters, underscores, hyphens, forward slashes, and .md extension are allowed`,
      },
    }
  }

  return { ok: true }
}

/**
 * Normalizes an include name to a relative path with .md extension.
 * Examples:
 * - "login" → "login.md"
 * - "login.md" → "login.md"
 * - "polyv/login" → "polyv/login.md"
 * - "polyv/login.md" → "polyv/login.md"
 */
function normalizeIncludeName(name: string): string {
  if (name.endsWith('.md')) {
    return name
  }
  return `${name}.md`
}

/**
 * Resolves an include path with fallback logic:
 * 1. Try ${projectRoot}/steps/<normalized>
 * 2. Fallback to ${projectRoot}/specs/steps/<normalized>
 * 
 * Returns the first existing path, or the primary path if readFile is not provided.
 */
export function resolveIncludePath(
  name: string,
  projectRoot: string,
  readFile?: ReadFileFn
): string {
  const normalized = normalizeIncludeName(name)
  const primaryPath = join(projectRoot, 'steps', normalized)
  
  if (!readFile) {
    return primaryPath
  }
  
  // Try primary path first
  if (readFile(primaryPath) !== null) {
    return primaryPath
  }
  
  // Fallback to specs/steps/
  const fallbackPath = join(projectRoot, 'specs', 'steps', normalized)
  return fallbackPath
}

function getExpectedRelativeIncludePath(name: string): string {
  const normalized = normalizeIncludeName(name)
  return `steps/${normalized} (or specs/steps/${normalized} as fallback)`
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

    const includePath = resolveIncludePath(name, includeRoot, readFile)
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
