/**
 * Locator Candidate Generator
 *
 * Generates stable locator candidates from element fingerprints.
 * Candidates are ordered by priority (most stable first).
 */

import type { ElementFingerprint, LocatorCandidate, LocatorKind } from './types.js'

/**
 * Escape special characters for CSS selectors.
 */
function escapeCssString(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

/**
 * Escape special characters for JavaScript strings.
 */
function escapeJsString(value: string): string {
  return value.replace(/['\\]/g, '\\$&')
}

/**
 * Generate locator candidates from an element fingerprint.
 * Candidates are returned in priority order (highest priority first).
 */
export function generateLocatorCandidates(fingerprint: ElementFingerprint): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = []

  if (fingerprint.testId) {
    candidates.push({
      kind: 'getByTestId',
      value: fingerprint.testId,
      code: `page.getByTestId('${escapeJsString(fingerprint.testId)}')`,
      validation: { unique: false },
    })

    for (const attr of ['data-testid', 'data-test-id', 'data-test']) {
      candidates.push({
        kind: 'cssAttr',
        value: `${attr}=${fingerprint.testId}`,
        code: `page.locator('[${attr}="${escapeCssString(fingerprint.testId)}"]')`,
        validation: { unique: false },
      })
    }
  }

  if (fingerprint.role && fingerprint.accessibleName) {
    candidates.push({
      kind: 'getByRole',
      value: `${fingerprint.role}:${fingerprint.accessibleName}`,
      code: `page.getByRole('${escapeJsString(fingerprint.role)}', { name: '${escapeJsString(fingerprint.accessibleName)}' })`,
      validation: { unique: false },
    })
  } else if (fingerprint.role && fingerprint.textSnippet) {
    const shortText = fingerprint.textSnippet.slice(0, 50)
    candidates.push({
      kind: 'getByRole',
      value: `${fingerprint.role}:${shortText}`,
      code: `page.getByRole('${escapeJsString(fingerprint.role)}', { name: '${escapeJsString(shortText)}' })`,
      validation: { unique: false },
    })
  }

  if (fingerprint.ariaLabel) {
    candidates.push({
      kind: 'getByLabel',
      value: fingerprint.ariaLabel,
      code: `page.getByLabel('${escapeJsString(fingerprint.ariaLabel)}')`,
      validation: { unique: false },
    })
  } else if (fingerprint.accessibleName && fingerprint.tagName && isInputLike(fingerprint.tagName)) {
    candidates.push({
      kind: 'getByLabel',
      value: fingerprint.accessibleName,
      code: `page.getByLabel('${escapeJsString(fingerprint.accessibleName)}')`,
      validation: { unique: false },
    })
  }

  if (fingerprint.placeholder) {
    candidates.push({
      kind: 'getByPlaceholder',
      value: fingerprint.placeholder,
      code: `page.getByPlaceholder('${escapeJsString(fingerprint.placeholder)}')`,
      validation: { unique: false },
    })
  }

  if (fingerprint.placeholder && isInputLike(fingerprint.tagName)) {
    const tag = fingerprint.tagName!.toLowerCase()
    const selector = `${tag}[placeholder="${escapeCssString(fingerprint.placeholder)}"]`
    candidates.push({
      kind: 'cssSelector',
      value: selector,
      code: `page.locator('${selector}')`,
      validation: { unique: false },
    })
  }

  if (fingerprint.id) {
    candidates.push({
      kind: 'cssId',
      value: fingerprint.id,
      code: `page.locator('#${escapeCssString(fingerprint.id)}')`,
      validation: { unique: false },
    })
  }

  if (fingerprint.nameAttr) {
    candidates.push({
      kind: 'cssAttr',
      value: `name=${fingerprint.nameAttr}`,
      code: `page.locator('[name="${escapeCssString(fingerprint.nameAttr)}"]')`,
      validation: { unique: false },
    })
  }

  if (fingerprint.textSnippet && isClickableTag(fingerprint.tagName)) {
    const shortText = fingerprint.textSnippet.slice(0, 50)
    candidates.push({
      kind: 'textExact',
      value: shortText,
      code: `page.getByText('${escapeJsString(shortText)}', { exact: true })`,
      validation: { unique: false },
    })
    candidates.push({
      kind: 'text',
      value: shortText,
      code: `page.getByText('${escapeJsString(shortText)}')`,
      validation: { unique: false },
    })
  }

  return candidates
}

/**
 * Check if a tag name represents an input-like element.
 */
function isInputLike(tagName: string | undefined): boolean {
  if (!tagName) return false
  const inputTags = new Set(['input', 'textarea', 'select'])
  return inputTags.has(tagName.toLowerCase())
}

/**
 * Check if a tag name represents a clickable element where text locators make sense.
 */
function isClickableTag(tagName: string | undefined): boolean {
  if (!tagName) return false
  const clickableTags = new Set(['button', 'a', 'span', 'div', 'li', 'td', 'th'])
  return clickableTags.has(tagName.toLowerCase())
}

/**
 * Get the priority order for a locator kind.
 * Lower number = higher priority.
 */
export function getLocatorPriority(kind: LocatorKind): number {
  const priorities: Record<LocatorKind, number> = {
    getByTestId: 1,
    getByRole: 2,
    getByLabel: 3,
    getByPlaceholder: 4,
    cssId: 5,
    cssAttr: 6,
    cssSelector: 7,
    textExact: 8,
    text: 9,
  }
  return priorities[kind]
}

/**
 * Sort locator candidates by priority (highest priority first).
 */
export function sortByPriority(candidates: LocatorCandidate[]): LocatorCandidate[] {
  return [...candidates].sort((a, b) => getLocatorPriority(a.kind) - getLocatorPriority(b.kind))
}

/**
 * Extract role name from getByRole locator value (e.g., "button:Save" -> "button").
 */
function extractRoleFromLocator(value: string): string | undefined {
  const match = value.match(/^(\w+):/)
  return match?.[1]
}

/**
 * Check if a locator kind represents an interactive element that should prefer getByRole.
 */
function shouldPreferRoleOverText(candidate: LocatorCandidate): boolean {
  if (candidate.kind !== 'getByRole') return false
  const role = extractRoleFromLocator(candidate.value)
  if (!role) return false
  // Prefer getByRole for these interactive elements even if not unique
  return ['button', 'link', 'textbox', 'combobox', 'listbox'].includes(role.toLowerCase())
}

/**
 * Choose the best locator from validated candidates.
 * Returns the highest priority candidate that passed validation.
 *
 * For interactive elements (button, link, etc.), getByRole is preferred over text-based
 * locators even if it has lower validation scores, because roles are more stable than text.
 */
export function chooseBestLocator(candidates: LocatorCandidate[]): LocatorCandidate | undefined {
  const sorted = sortByPriority(candidates)

  // First pass: try to find a fully validated candidate
  for (const candidate of sorted) {
    if (candidate.validation.unique && candidate.validation.visible !== false) {
      if (candidate.validation.fingerprintMatch !== false) {
        return candidate
      }
    }
  }

  // Second pass: for interactive elements, prefer getByRole even if not fully validated
  // This is more stable than text-based locators which can break with translations
  const roleCandidate = sorted.find((c) =>
    shouldPreferRoleOverText(c) && c.validation.visible !== false && c.validation.fingerprintMatch !== false
  )
  if (roleCandidate) {
    return roleCandidate
  }

  return undefined
}
