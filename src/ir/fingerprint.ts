/**
 * Element Fingerprint Extraction
 *
 * Extracts stable identifying attributes from DOM elements for later comparison.
 */

import type { ElementHandle } from 'playwright'

import type { ElementFingerprint } from './types.js'

const MAX_TEXT_SNIPPET_LENGTH = 100

/**
 * Extract fingerprint from an ElementHandle.
 * This captures stable attributes that can be used to verify locator candidates.
 */
export async function extractFingerprint(element: ElementHandle): Promise<ElementFingerprint> {
  try {
    const fingerprint = await element.evaluate((el: Element) => {
      const htmlEl = el as HTMLElement

      const getTextSnippet = (node: Element): string => {
        const text = node.textContent?.trim() ?? ''
        return text.slice(0, 100)
      }

      const getTestId = (node: Element): string | undefined => {
        const attrs = ['data-testid', 'data-test-id', 'data-test']
        for (const attr of attrs) {
          const value = node.getAttribute(attr)
          if (value) return value
        }
        return undefined
      }

      return {
        tagName: el.tagName?.toLowerCase(),
        role: htmlEl.getAttribute('role') ?? undefined,
        accessibleName: htmlEl.getAttribute('aria-label') ?? (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? undefined,
        id: el.id || undefined,
        nameAttr: el.getAttribute('name') ?? undefined,
        typeAttr: (el as HTMLInputElement).type ?? undefined,
        placeholder: (el as HTMLInputElement).placeholder ?? undefined,
        ariaLabel: htmlEl.getAttribute('aria-label') ?? undefined,
        testId: getTestId(el),
        textSnippet: getTextSnippet(el),
      }
    })

    if (fingerprint.textSnippet && fingerprint.textSnippet.length > MAX_TEXT_SNIPPET_LENGTH) {
      fingerprint.textSnippet = fingerprint.textSnippet.slice(0, MAX_TEXT_SNIPPET_LENGTH)
    }

    return cleanFingerprint(fingerprint)
  } catch {
    return {}
  }
}

/**
 * Remove undefined/empty values from fingerprint.
 */
function cleanFingerprint(fp: ElementFingerprint): ElementFingerprint {
  const result: ElementFingerprint = {}

  if (fp.tagName) result.tagName = fp.tagName
  if (fp.role) result.role = fp.role
  if (fp.accessibleName) result.accessibleName = fp.accessibleName
  if (fp.id) result.id = fp.id
  if (fp.nameAttr) result.nameAttr = fp.nameAttr
  if (fp.typeAttr) result.typeAttr = fp.typeAttr
  if (fp.placeholder) result.placeholder = fp.placeholder
  if (fp.ariaLabel) result.ariaLabel = fp.ariaLabel
  if (fp.testId) result.testId = fp.testId
  if (fp.textSnippet) result.textSnippet = fp.textSnippet

  return result
}

/**
 * Compare two fingerprints for similarity.
 * Returns true if they likely represent the same element.
 */
export function fingerprintsMatch(a: ElementFingerprint, b: ElementFingerprint): boolean {
  if (a.testId && b.testId && a.testId === b.testId) return true

  if (a.id && b.id && a.id === b.id) return true

  if (a.tagName && b.tagName && a.tagName !== b.tagName) return false

  let matchCount = 0
  let totalChecks = 0

  const checkMatch = (valA: string | undefined, valB: string | undefined) => {
    if (valA && valB) {
      totalChecks++
      if (valA === valB) matchCount++
    }
  }

  checkMatch(a.role, b.role)
  checkMatch(a.accessibleName, b.accessibleName)
  checkMatch(a.nameAttr, b.nameAttr)
  checkMatch(a.typeAttr, b.typeAttr)
  checkMatch(a.placeholder, b.placeholder)
  checkMatch(a.ariaLabel, b.ariaLabel)

  if (a.textSnippet && b.textSnippet) {
    totalChecks++
    const aText = a.textSnippet.toLowerCase().trim()
    const bText = b.textSnippet.toLowerCase().trim()
    if (aText === bText || aText.includes(bText) || bText.includes(aText)) {
      matchCount++
    }
  }

  if (totalChecks === 0) return true

  return matchCount / totalChecks >= 0.5
}
