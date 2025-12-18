import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadEnvFiles } from '../../src/env/load-env.js'

function withCleanEnv<T>(fn: () => T): T {
  const prev = { ...process.env }
  try {
    return fn()
  } finally {
    process.env = prev
  }
}

describe('loadEnvFiles', () => {
  it('loads .env and .env.<env> and does not override existing keys', () => {
    withCleanEnv(() => {
      const dir = mkdtempSync(join(tmpdir(), 'autoqa-env-'))
      try {
        writeFileSync(join(dir, '.env'), 'AUTOQA_BASE_URL=https://base.from.env\nFOO=from-dotenv\n', 'utf8')
        writeFileSync(join(dir, '.env.test'), 'AUTOQA_BASE_URL=https://base.from.test\nLOGIN=from-test\n', 'utf8')

        process.env.FOO = 'already-set'

        const out = loadEnvFiles({ cwd: dir, envName: 'test', requireEnvNameFile: true })
        expect(out.ok).toBe(true)
        if (!out.ok) return

        expect(process.env.AUTOQA_BASE_URL).toBe('https://base.from.test')
        expect(process.env.LOGIN).toBe('from-test')
        expect(process.env.FOO).toBe('already-set')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })

  it('infers envName from AUTOQA_ENV loaded in .env', () => {
    withCleanEnv(() => {
      const dir = mkdtempSync(join(tmpdir(), 'autoqa-env-'))
      try {
        writeFileSync(join(dir, '.env'), 'AUTOQA_ENV=test\nX=from-dotenv\n', 'utf8')
        writeFileSync(join(dir, '.env.test'), 'Y=from-env-specific\n', 'utf8')

        const out = loadEnvFiles({ cwd: dir })
        expect(out.ok).toBe(true)
        if (!out.ok) return

        expect(process.env.AUTOQA_ENV).toBe('test')
        expect(process.env.X).toBe('from-dotenv')
        expect(process.env.Y).toBe('from-env-specific')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
