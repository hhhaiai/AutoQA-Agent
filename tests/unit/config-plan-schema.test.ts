import { describe, it, expect } from 'vitest'
import { planConfigSchema, planGuardrailsSchema } from '../../src/config/schema.js'

describe('planConfigSchema', () => {
  it('should validate minimal valid config', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate config with all fields', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 5,
      maxPages: 100,
      includePatterns: ['/app/*', '/dashboard/*'],
      excludePatterns: ['/admin/*', '/api/*'],
      testTypes: ['functional', 'form', 'security'],
      guardrails: {
        maxAgentTurnsPerRun: 500,
        maxSnapshotsPerRun: 200,
        maxPagesPerRun: 50,
        maxTokenPerRun: 1000000,
      },
      auth: {
        loginUrl: 'https://example.com/login',
        usernameVar: 'TEST_USERNAME',
        passwordVar: 'TEST_PASSWORD',
      },
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.includePatterns).toEqual(['/app/*', '/dashboard/*'])
      expect(result.data.excludePatterns).toEqual(['/admin/*', '/api/*'])
      expect(result.data.auth?.loginUrl).toBe('https://example.com/login')
    }
  })

  it('should reject invalid baseUrl', () => {
    const config = {
      baseUrl: 'not-a-url',
      maxDepth: 3,
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('should reject maxDepth out of range', () => {
    const config1 = {
      baseUrl: 'https://example.com',
      maxDepth: -1,
    }
    const result1 = planConfigSchema.safeParse(config1)
    expect(result1.success).toBe(false)

    const config2 = {
      baseUrl: 'https://example.com',
      maxDepth: 11,
    }
    const result2 = planConfigSchema.safeParse(config2)
    expect(result2.success).toBe(false)
  })

  it('should reject invalid test types', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      testTypes: ['functional', 'invalid-type'],
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('should accept optional fields as undefined', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.includePatterns).toBeUndefined()
      expect(result.data.excludePatterns).toBeUndefined()
      expect(result.data.auth).toBeUndefined()
    }
  })

  it('should validate URL patterns as string arrays', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      includePatterns: ['/app/*'],
      excludePatterns: ['/admin/*', '/api/*'],
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should reject non-string patterns', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      includePatterns: [123, '/app/*'],
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})

describe('planGuardrailsSchema', () => {
  it('should validate all guardrail fields', () => {
    const guardrails = {
      maxAgentTurnsPerRun: 500,
      maxSnapshotsPerRun: 200,
      maxPagesPerRun: 50,
      maxTokenPerRun: 1000000,
    }
    const result = planGuardrailsSchema.safeParse(guardrails)
    expect(result.success).toBe(true)
  })

  it('should accept partial guardrails', () => {
    const guardrails = {
      maxAgentTurnsPerRun: 500,
    }
    const result = planGuardrailsSchema.safeParse(guardrails)
    expect(result.success).toBe(true)
  })

  it('should reject negative values', () => {
    const guardrails = {
      maxAgentTurnsPerRun: -1,
    }
    const result = planGuardrailsSchema.safeParse(guardrails)
    expect(result.success).toBe(false)
  })

  it('should reject zero values', () => {
    const guardrails = {
      maxSnapshotsPerRun: 0,
    }
    const result = planGuardrailsSchema.safeParse(guardrails)
    expect(result.success).toBe(false)
  })

  it('should accept empty object', () => {
    const result = planGuardrailsSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('auth config validation', () => {
  it('should validate auth config with all fields', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      auth: {
        loginUrl: 'https://example.com/login',
        usernameVar: 'USERNAME',
        passwordVar: 'PASSWORD',
      },
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate auth config with optional fields', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      auth: {
        loginUrl: 'https://example.com/login',
      },
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should reject invalid loginUrl in auth', () => {
    const config = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      auth: {
        loginUrl: 'not-a-url',
      },
    }
    const result = planConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})
