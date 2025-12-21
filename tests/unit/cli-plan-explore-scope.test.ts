import { describe, it, expect } from 'vitest'
import { loadPlanConfig } from '../../src/config/read.js'
import type { AutoqaConfig } from '../../src/config/schema.js'
import type { PlanCliOptions } from '../../src/config/read.js'

describe('CLI --explore-scope parameter', () => {
  const baseFileConfig: AutoqaConfig = {
    schemaVersion: 1,
    plan: {
      baseUrl: 'https://example.com',
    },
  }

  it('should override config file exploreScope with CLI parameter', () => {
    const fileConfig: AutoqaConfig = {
      ...baseFileConfig,
      plan: {
        baseUrl: 'https://example.com',
        exploreScope: 'site',
      },
    }

    const cliOptions: PlanCliOptions = {
      exploreScope: 'focused',
    }

    const config = loadPlanConfig(fileConfig, cliOptions)

    expect(config.exploreScope).toBe('focused')
  })

  it('should accept "site" from CLI', () => {
    const cliOptions: PlanCliOptions = {
      exploreScope: 'site',
    }

    const config = loadPlanConfig(baseFileConfig, cliOptions)

    expect(config.exploreScope).toBe('site')
  })

  it('should accept "focused" from CLI', () => {
    const cliOptions: PlanCliOptions = {
      exploreScope: 'focused',
    }

    const config = loadPlanConfig(baseFileConfig, cliOptions)

    expect(config.exploreScope).toBe('focused')
  })

  it('should accept "single_page" from CLI', () => {
    const cliOptions: PlanCliOptions = {
      exploreScope: 'single_page',
    }

    const config = loadPlanConfig(baseFileConfig, cliOptions)

    expect(config.exploreScope).toBe('single_page')
  })

  it('should use config file value when CLI parameter not provided', () => {
    const fileConfig: AutoqaConfig = {
      ...baseFileConfig,
      plan: {
        baseUrl: 'https://example.com',
        exploreScope: 'focused',
      },
    }

    const cliOptions: PlanCliOptions = {}

    const config = loadPlanConfig(fileConfig, cliOptions)

    expect(config.exploreScope).toBe('focused')
  })

  it('should use default "site" when neither CLI nor config provides value', () => {
    const cliOptions: PlanCliOptions = {}

    const config = loadPlanConfig(baseFileConfig, cliOptions)

    expect(config.exploreScope).toBe('site')
  })

  it('should work with other CLI options', () => {
    const cliOptions: PlanCliOptions = {
      url: 'https://console.polyv.net/live/index.html#/channel',
      depth: 2,
      exploreScope: 'focused',
    }

    const config = loadPlanConfig(baseFileConfig, cliOptions)

    expect(config.baseUrl).toBe('https://console.polyv.net/live/index.html#/channel')
    expect(config.maxDepth).toBe(2)
    expect(config.exploreScope).toBe('focused')
  })
})
