import { describe, it, expect } from 'vitest'
import { loadPlanConfig } from '../../src/config/read.js'
import type { PlanConfig } from '../../src/plan/types.js'
import type { AutoqaConfig } from '../../src/config/schema.js'

describe('loadPlanConfig', () => {
  describe('priority order: CLI > planner config > autoqa config > defaults', () => {
    it('should use CLI options when provided', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://file.example.com',
          maxDepth: 5,
          maxPages: 100,
        },
      }
      const cliOptions = {
        url: 'https://cli.example.com',
        depth: 2,
        maxPages: 50,
      }

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.baseUrl).toBe('https://cli.example.com')
      expect(result.maxDepth).toBe(2)
      expect(result.maxPages).toBe(50)
    })

    it('should fall back to file config when CLI not provided', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://file.example.com',
          maxDepth: 5,
          testTypes: ['functional', 'form'],
        },
      }
      const cliOptions = {}

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.baseUrl).toBe('https://file.example.com')
      expect(result.maxDepth).toBe(5)
      expect(result.testTypes).toEqual(['functional', 'form'])
    })

    it('should use defaults when neither CLI nor file provided', () => {
      const fileConfig = {
        schemaVersion: 1,
      }
      const cliOptions = {
        url: 'https://example.com',
      }

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.baseUrl).toBe('https://example.com')
      expect(result.maxDepth).toBe(3)
      expect(result.includePatterns).toEqual([])
      expect(result.excludePatterns).toEqual([])
    })

    it('should throw error when baseUrl not provided anywhere', () => {
      const fileConfig = {
        schemaVersion: 1,
      }
      const cliOptions = {}

      expect(() => loadPlanConfig(fileConfig, cliOptions)).toThrow('baseUrl is required')
    })
  })

  describe('guardrails merging', () => {
    it('should merge CLI guardrails with file guardrails', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          guardrails: {
            maxAgentTurnsPerRun: 500,
            maxSnapshotsPerRun: 200,
          },
        },
      }
      const cliOptions = {
        maxAgentTurns: 1000,
      }

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.guardrails?.maxAgentTurnsPerRun).toBe(1000)
      expect(result.guardrails?.maxSnapshotsPerRun).toBe(200)
    })

    it('should use defaults for missing guardrails', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
        },
      }
      const cliOptions = {}

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.guardrails).toBeDefined()
      expect(result.guardrails?.maxAgentTurnsPerRun).toBeGreaterThan(0)
    })
  })

  describe('URL patterns', () => {
    it('should preserve includePatterns from file config', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          includePatterns: ['/app/*', '/dashboard/*'],
        },
      }
      const cliOptions = {}

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.includePatterns).toEqual(['/app/*', '/dashboard/*'])
    })

    it('should preserve excludePatterns from file config', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          excludePatterns: ['/admin/*', '/api/*'],
        },
      }
      const cliOptions = {}

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.excludePatterns).toEqual(['/admin/*', '/api/*'])
    })
  })

  describe('auth configuration', () => {
    it('should merge CLI auth with file auth', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          auth: {
            loginUrl: 'https://example.com/login',
            usernameVar: 'USERNAME',
          },
        },
      }
      const cliOptions = {
        username: 'testuser',
        password: 'testpass',
      }

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.auth?.loginUrl).toBe('https://example.com/login')
      expect(result.auth?.usernameVar).toBe('USERNAME')
      expect(result.auth?.username).toBe('testuser')
      expect(result.auth?.password).toBe('testpass')
    })

    it('should create auth from CLI options only', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
        },
      }
      const cliOptions = {
        loginUrl: 'https://example.com/signin',
        username: 'user',
        password: 'pass',
      }

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.auth?.loginUrl).toBe('https://example.com/signin')
      expect(result.auth?.username).toBe('user')
      expect(result.auth?.password).toBe('pass')
    })
  })

  describe('test types', () => {
    it('should parse comma-separated test types from CLI', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
        },
      }
      const cliOptions = {
        testTypes: 'functional,form,security',
      }

      const result = loadPlanConfig(fileConfig, cliOptions)

      expect(result.testTypes).toEqual(['functional', 'form', 'security'])
    })

    it('should reject invalid test types', () => {
      const fileConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
        },
      }
      const cliOptions = {
        testTypes: 'functional,invalid-type',
      }

      expect(() => loadPlanConfig(fileConfig, cliOptions)).toThrow('Invalid test types')
    })
  })
})
