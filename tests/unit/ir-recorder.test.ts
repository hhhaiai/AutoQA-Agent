import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createIRRecorder, nullRecorder } from '../../src/ir/recorder.js'
import type { IRRecorder } from '../../src/ir/recorder.js'

describe('IR Recorder', () => {
  describe('createIRRecorder', () => {
    it('should create an enabled recorder by default', () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })
      expect(recorder.isEnabled()).toBe(true)
    })

    it('should create a disabled recorder when enabled is false', () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
        enabled: false,
      })
      expect(recorder.isEnabled()).toBe(false)
    })

    it('should return correct IR path', () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })
      const path = recorder.getIRPath()
      expect(path).toContain('.autoqa/runs/test-run-123/ir.jsonl')
    })
  })

  describe('nullRecorder', () => {
    it('should always report as disabled', () => {
      expect(nullRecorder.isEnabled()).toBe(false)
    })

    it('should return empty fingerprint and candidates from prepareForAction', async () => {
      const result = await nullRecorder.prepareForAction(null as any, 'click', null)
      expect(result.fingerprint).toBeNull()
      expect(result.candidates).toEqual([])
    })

    it('should not throw from recordAction', async () => {
      await expect(nullRecorder.recordAction(null as any, { ok: true }, null)).resolves.not.toThrow()
    })

    it('should return empty string from getIRPath', () => {
      expect(nullRecorder.getIRPath()).toBe('')
    })

    it('should return empty array from getValidationFailures', () => {
      expect(nullRecorder.getValidationFailures()).toEqual([])
    })
  })

  describe('prepareForAction', () => {
    it('should return empty result for non-element-targeting tools', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })

      const result = await recorder.prepareForAction(null as any, 'navigate', null)
      expect(result.fingerprint).toBeNull()
      expect(result.candidates).toEqual([])
    })

    it('should return empty result when locator is null', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })

      const result = await recorder.prepareForAction(null as any, 'click', null)
      expect(result.fingerprint).toBeNull()
      expect(result.candidates).toEqual([])
    })

    it('should not throw when recorder is disabled', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
        enabled: false,
      })

      const result = await recorder.prepareForAction(null as any, 'click', null)
      expect(result.fingerprint).toBeNull()
      expect(result.candidates).toEqual([])
    })

    it('should not throw when elementHandle fails', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })

      const mockLocator = {
        elementHandle: vi.fn().mockRejectedValue(new Error('Element not found')),
      }

      const result = await recorder.prepareForAction(null as any, 'click', mockLocator as any)
      expect(result.fingerprint).toBeNull()
      expect(result.candidates).toEqual([])
    })
  })

  describe('recordAction - validation failure resilience', () => {
    it('should not throw when recording fails', async () => {
      const recorder = createIRRecorder({
        cwd: '/nonexistent/path/that/will/fail',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })

      const mockPage = {
        url: vi.fn().mockReturnValue('http://example.com'),
      }

      await expect(
        recorder.recordAction(
          {
            page: mockPage as any,
            toolName: 'click',
            toolInput: { targetDescription: 'button' },
            stepIndex: 1,
          },
          { ok: true },
          null,
        ),
      ).resolves.not.toThrow()
    })

    it('should not throw when page.url() fails', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })

      const mockPage = {
        url: vi.fn().mockImplementation(() => {
          throw new Error('Page closed')
        }),
      }

      await expect(
        recorder.recordAction(
          {
            page: mockPage as any,
            toolName: 'click',
            toolInput: { targetDescription: 'button' },
            stepIndex: 1,
          },
          { ok: true },
          null,
        ),
      ).resolves.not.toThrow()
    })

    it('should track validation failures for debugging', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
      })

      const mockPage = {
        url: vi.fn().mockReturnValue('http://example.com'),
      }

      await recorder.recordAction(
        {
          page: mockPage as any,
          toolName: 'click',
          toolInput: { targetDescription: 'button' },
          stepIndex: 1,
        },
        { ok: true },
        {
          fingerprint: { tagName: 'button', testId: 'submit-btn' },
          candidates: [
            {
              kind: 'getByTestId',
              value: 'submit-btn',
              code: "page.getByTestId('submit-btn')",
              validation: { unique: false, error: 'Multiple elements found: 3' },
            },
          ],
        },
      )

      const failures = recorder.getValidationFailures()
      expect(failures.length).toBeGreaterThan(0)
      expect(failures[0]).toContain('click')
    })
  })

  describe('recordAction - disabled recorder', () => {
    it('should do nothing when disabled', async () => {
      const recorder = createIRRecorder({
        cwd: '/tmp/test',
        runId: 'test-run-123',
        specPath: 'specs/test.md',
        enabled: false,
      })

      const mockPage = {
        url: vi.fn(),
      }

      await recorder.recordAction(
        {
          page: mockPage as any,
          toolName: 'click',
          toolInput: { targetDescription: 'button' },
          stepIndex: 1,
        },
        { ok: true },
        null,
      )

      expect(mockPage.url).not.toHaveBeenCalled()
    })
  })
})
