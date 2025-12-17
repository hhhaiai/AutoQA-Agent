import { describe, it, expect } from 'vitest'

import { fingerprintsMatch } from '../../src/ir/fingerprint.js'
import type { ElementFingerprint } from '../../src/ir/types.js'

describe('Fingerprint', () => {
  describe('fingerprintsMatch', () => {
    it('should match identical fingerprints', () => {
      const fp: ElementFingerprint = {
        tagName: 'button',
        role: 'button',
        accessibleName: 'Submit',
        id: 'submit-btn',
      }
      expect(fingerprintsMatch(fp, fp)).toBe(true)
    })

    it('should match by testId alone', () => {
      const a: ElementFingerprint = { testId: 'login-btn', tagName: 'button' }
      const b: ElementFingerprint = { testId: 'login-btn', tagName: 'div' }
      expect(fingerprintsMatch(a, b)).toBe(true)
    })

    it('should match by id alone', () => {
      const a: ElementFingerprint = { id: 'submit', tagName: 'button' }
      const b: ElementFingerprint = { id: 'submit', tagName: 'button', role: 'button' }
      expect(fingerprintsMatch(a, b)).toBe(true)
    })

    it('should not match different tagNames', () => {
      const a: ElementFingerprint = { tagName: 'button', role: 'button' }
      const b: ElementFingerprint = { tagName: 'a', role: 'button' }
      expect(fingerprintsMatch(a, b)).toBe(false)
    })

    it('should match with sufficient attribute overlap', () => {
      const a: ElementFingerprint = {
        tagName: 'input',
        role: 'textbox',
        placeholder: 'Email',
        nameAttr: 'email',
      }
      const b: ElementFingerprint = {
        tagName: 'input',
        role: 'textbox',
        placeholder: 'Email',
        ariaLabel: 'Email input',
      }
      expect(fingerprintsMatch(a, b)).toBe(true)
    })

    it('should not match with insufficient attribute overlap', () => {
      const a: ElementFingerprint = {
        tagName: 'input',
        role: 'textbox',
        placeholder: 'Email',
        nameAttr: 'email',
      }
      const b: ElementFingerprint = {
        tagName: 'input',
        role: 'combobox',
        placeholder: 'Password',
        nameAttr: 'password',
      }
      expect(fingerprintsMatch(a, b)).toBe(false)
    })

    it('should match similar text snippets', () => {
      const a: ElementFingerprint = { tagName: 'button', textSnippet: 'Submit Form' }
      const b: ElementFingerprint = { tagName: 'button', textSnippet: 'submit form' }
      expect(fingerprintsMatch(a, b)).toBe(true)
    })

    it('should match when one text contains the other', () => {
      const a: ElementFingerprint = { tagName: 'button', textSnippet: 'Submit' }
      const b: ElementFingerprint = { tagName: 'button', textSnippet: 'Submit Form' }
      expect(fingerprintsMatch(a, b)).toBe(true)
    })

    it('should match empty fingerprints', () => {
      expect(fingerprintsMatch({}, {})).toBe(true)
    })

    it('should match when only tagName is present and matches', () => {
      const a: ElementFingerprint = { tagName: 'button' }
      const b: ElementFingerprint = { tagName: 'button' }
      expect(fingerprintsMatch(a, b)).toBe(true)
    })
  })
})
