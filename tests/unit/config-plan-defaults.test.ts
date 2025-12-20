import { describe, it, expect } from 'vitest'
import { DEFAULT_PLAN_CONFIG, DEFAULT_PLAN_GUARDRAILS } from '../../src/config/defaults.js'

describe('DEFAULT_PLAN_CONFIG', () => {
  it('should have reasonable default maxDepth', () => {
    expect(DEFAULT_PLAN_CONFIG.maxDepth).toBeGreaterThanOrEqual(1)
    expect(DEFAULT_PLAN_CONFIG.maxDepth).toBeLessThanOrEqual(10)
  })

  it('should have reasonable default maxPages', () => {
    expect(DEFAULT_PLAN_CONFIG.maxPages).toBeGreaterThan(0)
    expect(DEFAULT_PLAN_CONFIG.maxPages).toBeLessThanOrEqual(1000)
  })

  it('should have empty includePatterns by default', () => {
    expect(DEFAULT_PLAN_CONFIG.includePatterns).toEqual([])
  })

  it('should have empty excludePatterns by default', () => {
    expect(DEFAULT_PLAN_CONFIG.excludePatterns).toEqual([])
  })

  it('should have all test types enabled by default', () => {
    expect(DEFAULT_PLAN_CONFIG.testTypes).toContain('functional')
    expect(DEFAULT_PLAN_CONFIG.testTypes).toContain('form')
    expect(DEFAULT_PLAN_CONFIG.testTypes).toContain('navigation')
    expect(DEFAULT_PLAN_CONFIG.testTypes).toContain('responsive')
    expect(DEFAULT_PLAN_CONFIG.testTypes).toContain('boundary')
    expect(DEFAULT_PLAN_CONFIG.testTypes).toContain('security')
  })

  it('should have guardrails defined', () => {
    expect(DEFAULT_PLAN_CONFIG.guardrails).toBeDefined()
    expect(DEFAULT_PLAN_CONFIG.guardrails.maxAgentTurnsPerRun).toBeGreaterThan(0)
  })
})

describe('DEFAULT_PLAN_GUARDRAILS', () => {
  it('should have maxAgentTurnsPerRun limit', () => {
    expect(DEFAULT_PLAN_GUARDRAILS.maxAgentTurnsPerRun).toBeGreaterThan(0)
    expect(DEFAULT_PLAN_GUARDRAILS.maxAgentTurnsPerRun).toBeLessThanOrEqual(10000)
  })

  it('should have maxSnapshotsPerRun limit', () => {
    expect(DEFAULT_PLAN_GUARDRAILS.maxSnapshotsPerRun).toBeGreaterThan(0)
    expect(DEFAULT_PLAN_GUARDRAILS.maxSnapshotsPerRun).toBeLessThanOrEqual(1000)
  })

  it('should have maxPagesPerRun limit', () => {
    expect(DEFAULT_PLAN_GUARDRAILS.maxPagesPerRun).toBeGreaterThan(0)
    expect(DEFAULT_PLAN_GUARDRAILS.maxPagesPerRun).toBeLessThanOrEqual(1000)
  })

  it('should have maxTokenPerRun limit', () => {
    if (DEFAULT_PLAN_GUARDRAILS.maxTokenPerRun !== undefined) {
      expect(DEFAULT_PLAN_GUARDRAILS.maxTokenPerRun).toBeGreaterThan(0)
    }
  })

  it('should align with Epic 3 guardrail naming conventions', () => {
    expect(DEFAULT_PLAN_GUARDRAILS).toHaveProperty('maxAgentTurnsPerRun')
    expect(DEFAULT_PLAN_GUARDRAILS).toHaveProperty('maxSnapshotsPerRun')
    expect(DEFAULT_PLAN_GUARDRAILS).toHaveProperty('maxPagesPerRun')
  })
})
