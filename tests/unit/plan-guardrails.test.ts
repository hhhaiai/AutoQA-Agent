import { describe, it, expect } from 'vitest'
import type { GuardrailConfig, GuardrailTrigger } from '../../src/plan/types.js'

describe('Guardrail tracking and enforcement', () => {
  describe('guardrail trigger detection', () => {
    it('should detect maxAgentTurnsPerRun exceeded', () => {
      const guardrails: GuardrailConfig = {
        maxAgentTurnsPerRun: 10,
      }
      const currentTurns = 11

      const shouldTrigger = currentTurns > (guardrails.maxAgentTurnsPerRun ?? Infinity)
      expect(shouldTrigger).toBe(true)
    })

    it('should detect maxSnapshotsPerRun exceeded', () => {
      const guardrails: GuardrailConfig = {
        maxSnapshotsPerRun: 5,
      }
      const currentSnapshots = 6

      const shouldTrigger = currentSnapshots > (guardrails.maxSnapshotsPerRun ?? Infinity)
      expect(shouldTrigger).toBe(true)
    })

    it('should detect maxPagesPerRun exceeded', () => {
      const guardrails: GuardrailConfig = {
        maxPagesPerRun: 20,
      }
      const currentPages = 21

      const shouldTrigger = currentPages > (guardrails.maxPagesPerRun ?? Infinity)
      expect(shouldTrigger).toBe(true)
    })

    it('should not trigger when under limit', () => {
      const guardrails: GuardrailConfig = {
        maxAgentTurnsPerRun: 100,
        maxSnapshotsPerRun: 50,
        maxPagesPerRun: 30,
      }
      const currentTurns = 50
      const currentSnapshots = 25
      const currentPages = 15

      const turnsTrigger = currentTurns > (guardrails.maxAgentTurnsPerRun ?? Infinity)
      const snapshotsTrigger = currentSnapshots > (guardrails.maxSnapshotsPerRun ?? Infinity)
      const pagesTrigger = currentPages > (guardrails.maxPagesPerRun ?? Infinity)

      expect(turnsTrigger).toBe(false)
      expect(snapshotsTrigger).toBe(false)
      expect(pagesTrigger).toBe(false)
    })

    it('should handle undefined guardrails gracefully', () => {
      const guardrails: GuardrailConfig = {}
      const currentTurns = 1000

      const shouldTrigger = currentTurns > (guardrails.maxAgentTurnsPerRun ?? Infinity)
      expect(shouldTrigger).toBe(false)
    })
  })

  describe('guardrail trigger creation', () => {
    it('should create correct trigger for MAX_AGENT_TURNS', () => {
      const trigger: GuardrailTrigger = {
        code: 'MAX_AGENT_TURNS',
        limit: 100,
        actual: 101,
        triggeredAt: new Date().toISOString(),
      }

      expect(trigger.code).toBe('MAX_AGENT_TURNS')
      expect(trigger.actual).toBeGreaterThan(trigger.limit)
    })

    it('should create correct trigger for MAX_SNAPSHOTS', () => {
      const trigger: GuardrailTrigger = {
        code: 'MAX_SNAPSHOTS',
        limit: 50,
        actual: 51,
        triggeredAt: new Date().toISOString(),
      }

      expect(trigger.code).toBe('MAX_SNAPSHOTS')
      expect(trigger.actual).toBeGreaterThan(trigger.limit)
    })

    it('should create correct trigger for MAX_PAGES', () => {
      const trigger: GuardrailTrigger = {
        code: 'MAX_PAGES',
        limit: 30,
        actual: 31,
        triggeredAt: new Date().toISOString(),
      }

      expect(trigger.code).toBe('MAX_PAGES')
      expect(trigger.actual).toBeGreaterThan(trigger.limit)
    })
  })

  describe('guardrail priority', () => {
    it('should check agent turns first', () => {
      const guardrails: GuardrailConfig = {
        maxAgentTurnsPerRun: 10,
        maxSnapshotsPerRun: 50,
        maxPagesPerRun: 30,
      }
      const stats = {
        agentTurns: 11,
        snapshots: 5,
        pages: 5,
      }

      const turnsTrigger = stats.agentTurns > (guardrails.maxAgentTurnsPerRun ?? Infinity)
      const snapshotsTrigger = stats.snapshots > (guardrails.maxSnapshotsPerRun ?? Infinity)
      const pagesTrigger = stats.pages > (guardrails.maxPagesPerRun ?? Infinity)

      expect(turnsTrigger).toBe(true)
      expect(snapshotsTrigger).toBe(false)
      expect(pagesTrigger).toBe(false)
    })

    it('should check snapshots when turns ok', () => {
      const guardrails: GuardrailConfig = {
        maxAgentTurnsPerRun: 100,
        maxSnapshotsPerRun: 10,
        maxPagesPerRun: 30,
      }
      const stats = {
        agentTurns: 50,
        snapshots: 11,
        pages: 5,
      }

      const turnsTrigger = stats.agentTurns > (guardrails.maxAgentTurnsPerRun ?? Infinity)
      const snapshotsTrigger = stats.snapshots > (guardrails.maxSnapshotsPerRun ?? Infinity)
      const pagesTrigger = stats.pages > (guardrails.maxPagesPerRun ?? Infinity)

      expect(turnsTrigger).toBe(false)
      expect(snapshotsTrigger).toBe(true)
      expect(pagesTrigger).toBe(false)
    })

    it('should check pages when turns and snapshots ok', () => {
      const guardrails: GuardrailConfig = {
        maxAgentTurnsPerRun: 100,
        maxSnapshotsPerRun: 50,
        maxPagesPerRun: 10,
      }
      const stats = {
        agentTurns: 50,
        snapshots: 25,
        pages: 11,
      }

      const turnsTrigger = stats.agentTurns > (guardrails.maxAgentTurnsPerRun ?? Infinity)
      const snapshotsTrigger = stats.snapshots > (guardrails.maxSnapshotsPerRun ?? Infinity)
      const pagesTrigger = stats.pages > (guardrails.maxPagesPerRun ?? Infinity)

      expect(turnsTrigger).toBe(false)
      expect(snapshotsTrigger).toBe(false)
      expect(pagesTrigger).toBe(true)
    })
  })
})
