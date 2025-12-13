import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createProgram } from '../../src/cli/program.js'

describe('autoqa init', () => {
  it('creates autoqa.config.json with schemaVersion', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'autoqa-init-'))
    const originalCwd = process.cwd()

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      process.chdir(tempDir)

      const program = createProgram()
      program.configureOutput({
        writeOut: () => {},
        writeErr: () => {},
      })

      program.parse(['init'], { from: 'user' })

      const configPath = join(tempDir, 'autoqa.config.json')
      const contents = readFileSync(configPath, 'utf8')

      expect(contents.endsWith('\n')).toBe(true)
      expect(JSON.parse(contents)).toEqual({ schemaVersion: 1 })
    } finally {
      logSpy.mockRestore()
      process.chdir(originalCwd)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite existing autoqa.config.json and exits with code 2', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'autoqa-init-'))
    const originalCwd = process.cwd()

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      process.chdir(tempDir)

      const configPath = join(tempDir, 'autoqa.config.json')
      writeFileSync(configPath, '{\n  "schemaVersion": 999\n}\n', 'utf8')

      let errOutput = ''

      const program = createProgram()
      program.configureOutput({
        writeOut: () => {},
        writeErr: (str) => {
          errOutput += str
        },
      })
      program.exitOverride()

      let exitCode: number | undefined

      try {
        program.parse(['init'], { from: 'user' })
      } catch (err: any) {
        exitCode = err.exitCode
      }

      expect(exitCode).toBe(2)
      expect(errOutput).toContain('Refusing to overwrite')
      expect(JSON.parse(readFileSync(configPath, 'utf8'))).toEqual({ schemaVersion: 999 })
    } finally {
      logSpy.mockRestore()
      process.chdir(originalCwd)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
