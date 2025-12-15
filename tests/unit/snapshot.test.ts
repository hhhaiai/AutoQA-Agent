import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

import {
  captureAriaSnapshot,
  captureAxSnapshot,
  captureSnapshots,
  writeSnapshots,
  captureAndWriteSnapshots,
} from '../../src/browser/snapshot.js'

describe('snapshot capture', () => {
  describe('captureAriaSnapshot', () => {
    it('captures ARIA snapshot successfully and returns YAML', async () => {
      const yamlContent = '- heading "Test Page"\n- button "Submit"'
      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => yamlContent),
        })),
      }

      const result = await captureAriaSnapshot(page)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.yaml).toBe(yamlContent)
      }
      expect(page.locator).toHaveBeenCalledWith('body')
    })

    it('returns error when ARIA snapshot capture fails', async () => {
      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => {
            throw new Error('Page not ready')
          }),
        })),
      }

      const result = await captureAriaSnapshot(page)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Failed to capture ARIA snapshot')
        expect(result.error).toContain('Page not ready')
      }
    })

    it('respects timeout option', async () => {
      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async (opts: any) => {
            expect(opts.timeout).toBe(3000)
            return '- heading "Test"'
          }),
        })),
      }

      await captureAriaSnapshot(page, { timeout: 3000 })
    })
  })

  describe('captureAxSnapshot', () => {
    it('captures AX snapshot successfully and returns JSON', async () => {
      const snapshotData = { role: 'WebArea', name: 'Test Page', children: [] }
      const page: any = {
        _snapshotForAI: vi.fn(async () => snapshotData),
      }

      const result = await captureAxSnapshot(page)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.json).toEqual(snapshotData)
      }
    })

    it('returns error when AX snapshot capture fails', async () => {
      const page: any = {
        _snapshotForAI: vi.fn(async () => {
          throw new Error('Accessibility tree unavailable')
        }),
      }

      const result = await captureAxSnapshot(page)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Failed to capture AX snapshot')
        expect(result.error).toContain('Accessibility tree unavailable')
      }
    })

    it('handles null snapshot result', async () => {
      const page: any = {
        _snapshotForAI: vi.fn(async () => null),
      }

      const result = await captureAxSnapshot(page)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.json).toBeNull()
      }
    })
  })

  describe('captureSnapshots', () => {
    it('captures both ARIA and AX snapshots in parallel', async () => {
      const yamlContent = '- heading "Test"'
      const axData = { role: 'WebArea' }

      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => yamlContent),
        })),
        _snapshotForAI: vi.fn(async () => axData),
      }

      const result = await captureSnapshots(page)

      expect(result.aria.ok).toBe(true)
      expect(result.ax.ok).toBe(true)
      if (result.aria.ok) expect(result.aria.yaml).toBe(yamlContent)
      if (result.ax.ok) expect(result.ax.json).toEqual(axData)
    })

    it('captures partial results when one fails', async () => {
      const yamlContent = '- heading "Test"'

      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => yamlContent),
        })),
        _snapshotForAI: vi.fn(async () => {
          throw new Error('AX failed')
        }),
      }

      const result = await captureSnapshots(page)

      expect(result.aria.ok).toBe(true)
      expect(result.ax.ok).toBe(false)
    })
  })
})

describe('snapshot write', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `autoqa-snapshot-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  describe('writeSnapshots', () => {
    it('writes ARIA and AX snapshots to correct paths', async () => {
      const capture = {
        aria: { ok: true as const, yaml: '- heading "Test"' },
        ax: { ok: true as const, json: { role: 'WebArea' } },
      }

      const result = await writeSnapshots(capture, {
        cwd: testDir,
        runId: 'run-123',
        fileBaseName: 'click-1',
      })

      expect(result.ariaPath).toBe('.autoqa/runs/run-123/snapshots/click-1.aria.yaml')
      expect(result.axPath).toBe('.autoqa/runs/run-123/snapshots/click-1.ax.json')
      expect(result.ariaError).toBeUndefined()
      expect(result.axError).toBeUndefined()

      const ariaFile = resolve(testDir, '.autoqa/runs/run-123/snapshots/click-1.aria.yaml')
      const axFile = resolve(testDir, '.autoqa/runs/run-123/snapshots/click-1.ax.json')
      expect(existsSync(ariaFile)).toBe(true)
      expect(existsSync(axFile)).toBe(true)
    })

    it('returns relative paths without absolute path leakage', async () => {
      const capture = {
        aria: { ok: true as const, yaml: '- heading "Test"' },
        ax: { ok: true as const, json: { role: 'WebArea' } },
      }

      const result = await writeSnapshots(capture, {
        cwd: testDir,
        runId: 'run-123',
        fileBaseName: 'navigate-1',
      })

      expect(result.ariaPath).not.toContain(testDir)
      expect(result.axPath).not.toContain(testDir)
      expect(result.ariaPath).toMatch(/^\.autoqa\/runs\//)
      expect(result.axPath).toMatch(/^\.autoqa\/runs\//)
    })

    it('sanitizes runId and fileBaseName to prevent path traversal', async () => {
      const capture = {
        aria: { ok: true as const, yaml: '- heading "Test"' },
        ax: { ok: true as const, json: { role: 'WebArea' } },
      }

      const result = await writeSnapshots(capture, {
        cwd: testDir,
        runId: '../../../etc',
        fileBaseName: '../../passwd',
      })

      expect(result.ariaPath).toBeDefined()
      expect(result.axPath).toBeDefined()
      expect(result.ariaPath).not.toMatch(/\.\.\//g)
      expect(result.axPath).not.toMatch(/\.\.\//g)
      expect(result.ariaPath).toMatch(/^\.autoqa\/runs\//)
      expect(result.axPath).toMatch(/^\.autoqa\/runs\//)
    })

    it('handles capture failures gracefully', async () => {
      const capture = {
        aria: { ok: false as const, error: 'ARIA capture failed' },
        ax: { ok: false as const, error: 'AX capture failed' },
      }

      const result = await writeSnapshots(capture, {
        cwd: testDir,
        runId: 'run-123',
        fileBaseName: 'click-1',
      })

      expect(result.ariaPath).toBeUndefined()
      expect(result.axPath).toBeUndefined()
      expect(result.ariaError).toBe('ARIA capture failed')
      expect(result.axError).toBe('AX capture failed')
    })

    it('writes partial results when one capture fails', async () => {
      const capture = {
        aria: { ok: true as const, yaml: '- heading "Test"' },
        ax: { ok: false as const, error: 'AX capture failed' },
      }

      const result = await writeSnapshots(capture, {
        cwd: testDir,
        runId: 'run-123',
        fileBaseName: 'click-1',
      })

      expect(result.ariaPath).toBe('.autoqa/runs/run-123/snapshots/click-1.aria.yaml')
      expect(result.axPath).toBeUndefined()
      expect(result.ariaError).toBeUndefined()
      expect(result.axError).toBe('AX capture failed')
    })
  })

  describe('captureAndWriteSnapshots', () => {
    it('captures and writes snapshots successfully', async () => {
      const yamlContent = '- heading "Test Page"'
      const axData = { role: 'WebArea', name: 'Test' }

      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => yamlContent),
        })),
        _snapshotForAI: vi.fn(async () => axData),
      }

      const result = await captureAndWriteSnapshots({
        page,
        runId: 'run-456',
        debug: true,
        cwd: testDir,
        fileBaseName: 'fill-1',
      })

      expect(result.captured).toBe(true)
      expect(result.ariaPath).toBe('.autoqa/runs/run-456/snapshots/fill-1.aria.yaml')
      expect(result.axPath).toBe('.autoqa/runs/run-456/snapshots/fill-1.ax.json')
      expect(result.error).toBeUndefined()
    })

    it('does not write snapshots when debug=false and capture succeeds', async () => {
      const yamlContent = '- heading "Test Page"'
      const axData = { role: 'WebArea', name: 'Test' }

      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => yamlContent),
        })),
        _snapshotForAI: vi.fn(async () => axData),
      }

      const result = await captureAndWriteSnapshots({
        page,
        runId: 'run-no-write',
        debug: false,
        cwd: testDir,
        fileBaseName: 'navigate-1',
      })

      expect(result.captured).toBe(true)
      expect(result.ariaPath).toBeUndefined()
      expect(result.axPath).toBeUndefined()
      expect(result.error).toBeUndefined()

      const ariaFile = resolve(testDir, '.autoqa/runs/run-no-write/snapshots/navigate-1.aria.yaml')
      const axFile = resolve(testDir, '.autoqa/runs/run-no-write/snapshots/navigate-1.ax.json')
      expect(existsSync(ariaFile)).toBe(false)
      expect(existsSync(axFile)).toBe(false)
    })

    it('does not throw when capture fails; returns error info', async () => {
      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => {
            throw new Error('Page crashed')
          }),
        })),
        _snapshotForAI: vi.fn(async () => {
          throw new Error('AX unavailable')
        }),
      }

      const result = await captureAndWriteSnapshots({
        page,
        runId: 'run-789',
        debug: false,
        cwd: testDir,
        fileBaseName: 'scroll-1',
      })

      expect(result.captured).toBe(false)
      expect(result.error).toContain('Failed to capture ARIA snapshot')
      expect(result.error).toContain('Failed to capture AX snapshot')
      expect(result.ariaPath).toBeUndefined()
      expect(result.axPath).toBeUndefined()
    })

    it('writes snapshots when debug=true even if capture partially fails', async () => {
      const yamlContent = '- heading "Test"'

      const page: any = {
        locator: vi.fn(() => ({
          ariaSnapshot: vi.fn(async () => yamlContent),
        })),
        _snapshotForAI: vi.fn(async () => {
          throw new Error('AX failed')
        }),
      }

      const result = await captureAndWriteSnapshots({
        page,
        runId: 'run-partial',
        debug: true,
        cwd: testDir,
        fileBaseName: 'wait-1',
      })

      expect(result.captured).toBe(true)
      expect(result.ariaPath).toBe('.autoqa/runs/run-partial/snapshots/wait-1.aria.yaml')
      expect(result.axPath).toBeUndefined()
      expect(result.error).toContain('Failed to capture AX snapshot')
    })
  })
})

describe('snapshot path security', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `autoqa-snapshot-security-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('output paths do not contain absolute paths', async () => {
    const capture = {
      aria: { ok: true as const, yaml: '- heading "Test"' },
      ax: { ok: true as const, json: { role: 'WebArea' } },
    }

    const result = await writeSnapshots(capture, {
      cwd: testDir,
      runId: 'test-run',
      fileBaseName: 'action-1',
    })

    expect(result.ariaPath).not.toMatch(/^\//)
    expect(result.axPath).not.toMatch(/^\//)
    expect(result.ariaPath).not.toContain('/Users/')
    expect(result.ariaPath).not.toContain('/home/')
    expect(result.ariaPath).not.toContain('C:')
  })
})
