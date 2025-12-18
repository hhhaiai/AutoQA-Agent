import { describe, it, expect } from 'vitest'

import {
  generateLocatorCandidates,
  getLocatorPriority,
  sortByPriority,
  chooseBestLocator,
} from '../../src/ir/locator-generator.js'
import type { ElementFingerprint, LocatorCandidate } from '../../src/ir/types.js'

describe('Locator Generator', () => {
  describe('generateLocatorCandidates', () => {
    it('should generate getByTestId candidate when testId exists', () => {
      const fingerprint: ElementFingerprint = {
        testId: 'login-button',
        tagName: 'button',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const testIdCandidate = candidates.find((c) => c.kind === 'getByTestId')
      expect(testIdCandidate).toBeDefined()
      expect(testIdCandidate?.value).toBe('login-button')
      expect(testIdCandidate?.code).toBe("page.getByTestId('login-button')")
    })

    it('should generate cssAttr candidates for data-testid/data-test-id/data-test when testId exists', () => {
      const fingerprint: ElementFingerprint = {
        testId: 'product-sort-container',
        tagName: 'select',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const cssAttrCandidates = candidates.filter((c) => c.kind === 'cssAttr')
      expect(cssAttrCandidates.some((c) => c.value === 'data-testid=product-sort-container')).toBe(true)
      expect(cssAttrCandidates.some((c) => c.value === 'data-test-id=product-sort-container')).toBe(true)
      expect(cssAttrCandidates.some((c) => c.value === 'data-test=product-sort-container')).toBe(true)
    })

    it('should generate getByRole candidate when role and accessibleName exist', () => {
      const fingerprint: ElementFingerprint = {
        role: 'button',
        accessibleName: 'Submit',
        tagName: 'button',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const roleCandidate = candidates.find((c) => c.kind === 'getByRole')
      expect(roleCandidate).toBeDefined()
      expect(roleCandidate?.value).toBe('button:Submit')
      expect(roleCandidate?.code).toBe("page.getByRole('button', { name: 'Submit' })")
    })

    it('should generate getByLabel candidate for input with ariaLabel', () => {
      const fingerprint: ElementFingerprint = {
        tagName: 'input',
        ariaLabel: 'Email address',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const labelCandidate = candidates.find((c) => c.kind === 'getByLabel')
      expect(labelCandidate).toBeDefined()
      expect(labelCandidate?.value).toBe('Email address')
    })

    it('should generate getByPlaceholder candidate when placeholder exists', () => {
      const fingerprint: ElementFingerprint = {
        tagName: 'input',
        placeholder: 'Enter your email',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const placeholderCandidate = candidates.find((c) => c.kind === 'getByPlaceholder')
      expect(placeholderCandidate).toBeDefined()
      expect(placeholderCandidate?.value).toBe('Enter your email')
    })

    it('should generate cssId candidate when id exists', () => {
      const fingerprint: ElementFingerprint = {
        tagName: 'button',
        id: 'submit-btn',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const idCandidate = candidates.find((c) => c.kind === 'cssId')
      expect(idCandidate).toBeDefined()
      expect(idCandidate?.value).toBe('submit-btn')
      expect(idCandidate?.code).toBe("page.locator('#submit-btn')")
    })

    it('should generate cssAttr candidate when nameAttr exists', () => {
      const fingerprint: ElementFingerprint = {
        tagName: 'input',
        nameAttr: 'username',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const attrCandidate = candidates.find((c) => c.kind === 'cssAttr')
      expect(attrCandidate).toBeDefined()
      expect(attrCandidate?.value).toBe('name=username')
      expect(attrCandidate?.code).toBe('page.locator(\'[name="username"]\')')
    })

    it('should generate text candidate for clickable elements with text', () => {
      const fingerprint: ElementFingerprint = {
        tagName: 'button',
        textSnippet: 'Click me',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const textCandidate = candidates.find((c) => c.kind === 'text')
      expect(textCandidate).toBeDefined()
      expect(textCandidate?.value).toBe('Click me')
    })

    it('should not generate text candidate for non-clickable elements', () => {
      const fingerprint: ElementFingerprint = {
        tagName: 'input',
        textSnippet: 'Some text',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const textCandidate = candidates.find((c) => c.kind === 'text')
      expect(textCandidate).toBeUndefined()
    })

    it('should escape special characters in generated code', () => {
      const fingerprint: ElementFingerprint = {
        testId: "test'id",
        tagName: 'button',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      const testIdCandidate = candidates.find((c) => c.kind === 'getByTestId')
      expect(testIdCandidate?.code).toBe("page.getByTestId('test\\'id')")
    })

    it('should return empty array for empty fingerprint', () => {
      const candidates = generateLocatorCandidates({})
      expect(candidates).toEqual([])
    })

    it('should generate multiple candidates for rich fingerprint', () => {
      const fingerprint: ElementFingerprint = {
        testId: 'login-btn',
        role: 'button',
        accessibleName: 'Login',
        id: 'login',
        textSnippet: 'Login',
        tagName: 'button',
      }
      const candidates = generateLocatorCandidates(fingerprint)

      expect(candidates.length).toBeGreaterThanOrEqual(4)
      expect(candidates.some((c) => c.kind === 'getByTestId')).toBe(true)
      expect(candidates.some((c) => c.kind === 'getByRole')).toBe(true)
      expect(candidates.some((c) => c.kind === 'cssId')).toBe(true)
      expect(candidates.some((c) => c.kind === 'text')).toBe(true)
    })
  })

  describe('getLocatorPriority', () => {
    it('should return correct priority order', () => {
      expect(getLocatorPriority('getByTestId')).toBeLessThan(getLocatorPriority('getByRole'))
      expect(getLocatorPriority('getByRole')).toBeLessThan(getLocatorPriority('getByLabel'))
      expect(getLocatorPriority('getByLabel')).toBeLessThan(getLocatorPriority('getByPlaceholder'))
      expect(getLocatorPriority('getByPlaceholder')).toBeLessThan(getLocatorPriority('cssId'))
      expect(getLocatorPriority('cssId')).toBeLessThan(getLocatorPriority('cssAttr'))
      expect(getLocatorPriority('cssAttr')).toBeLessThan(getLocatorPriority('text'))
    })
  })

  describe('sortByPriority', () => {
    it('should sort candidates by priority (highest first)', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'text', value: 'Click', code: '', validation: { unique: false } },
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: false } },
        { kind: 'cssId', value: 'id', code: '', validation: { unique: false } },
        { kind: 'getByRole', value: 'button', code: '', validation: { unique: false } },
      ]

      const sorted = sortByPriority(candidates)

      expect(sorted[0]?.kind).toBe('getByTestId')
      expect(sorted[1]?.kind).toBe('getByRole')
      expect(sorted[2]?.kind).toBe('cssId')
      expect(sorted[3]?.kind).toBe('text')
    })

    it('should not mutate original array', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'text', value: 'Click', code: '', validation: { unique: false } },
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: false } },
      ]

      const sorted = sortByPriority(candidates)

      expect(candidates[0]?.kind).toBe('text')
      expect(sorted[0]?.kind).toBe('getByTestId')
    })
  })

  describe('chooseBestLocator', () => {
    it('should choose highest priority valid candidate', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'text', value: 'Click', code: '', validation: { unique: true, visible: true } },
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: true, visible: true } },
        { kind: 'cssId', value: 'id', code: '', validation: { unique: true, visible: true } },
      ]

      const best = chooseBestLocator(candidates)

      expect(best?.kind).toBe('getByTestId')
    })

    it('should skip candidates that are not unique', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: false } },
        { kind: 'cssId', value: 'id', code: '', validation: { unique: true, visible: true } },
      ]

      const best = chooseBestLocator(candidates)

      expect(best?.kind).toBe('cssId')
    })

    it('should skip candidates that are not visible', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: true, visible: false } },
        { kind: 'cssId', value: 'id', code: '', validation: { unique: true, visible: true } },
      ]

      const best = chooseBestLocator(candidates)

      expect(best?.kind).toBe('cssId')
    })

    it('should skip candidates with fingerprint mismatch', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: true, visible: true, fingerprintMatch: false } },
        { kind: 'cssId', value: 'id', code: '', validation: { unique: true, visible: true, fingerprintMatch: true } },
      ]

      const best = chooseBestLocator(candidates)

      expect(best?.kind).toBe('cssId')
    })

    it('should return undefined if no valid candidates', () => {
      const candidates: LocatorCandidate[] = [
        { kind: 'getByTestId', value: 'btn', code: '', validation: { unique: false } },
        { kind: 'cssId', value: 'id', code: '', validation: { unique: false } },
      ]

      const best = chooseBestLocator(candidates)

      expect(best).toBeUndefined()
    })

    it('should return undefined for empty array', () => {
      const best = chooseBestLocator([])
      expect(best).toBeUndefined()
    })
  })
})
