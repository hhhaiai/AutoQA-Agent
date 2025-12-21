import { describe, it, expect } from 'vitest'
import { loadPlanConfig } from '../../src/config/read.js'
import type { AutoqaConfig } from '../../src/config/schema.js'

describe('URL Scope Configuration', () => {
  describe('exploreScope field', () => {
    it('should default to "site" when not specified', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.exploreScope).toBe('site')
    })

    it('should accept "site" value from config file', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          exploreScope: 'site',
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.exploreScope).toBe('site')
    })

    it('should accept "focused" value from config file', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          exploreScope: 'focused',
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.exploreScope).toBe('focused')
    })

    it('should accept "single_page" value from config file', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
          exploreScope: 'single_page',
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.exploreScope).toBe('single_page')
    })
  })

  describe('includePatterns and excludePatterns', () => {
    it('should default to empty arrays when not specified', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://example.com',
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.includePatterns).toEqual([])
      expect(config.excludePatterns).toEqual([])
    })

    it('should accept includePatterns from config file', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://console.polyv.net',
          includePatterns: ['/live/index.html#/channel*', '/live/index.html#/live-room*'],
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.includePatterns).toEqual([
        '/live/index.html#/channel*',
        '/live/index.html#/live-room*',
      ])
    })

    it('should accept excludePatterns from config file', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://console.polyv.net',
          excludePatterns: ['/live/index.html#/statistics*', '/live/index.html#/settings*'],
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.excludePatterns).toEqual([
        '/live/index.html#/statistics*',
        '/live/index.html#/settings*',
      ])
    })

    it('should accept both includePatterns and excludePatterns', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://console.polyv.net',
          includePatterns: ['/live/index.html#/channel*'],
          excludePatterns: ['/live/index.html#/statistics*'],
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.includePatterns).toEqual(['/live/index.html#/channel*'])
      expect(config.excludePatterns).toEqual(['/live/index.html#/statistics*'])
    })
  })

  describe('combined exploreScope with patterns', () => {
    it('should work with focused mode and includePatterns', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://console.polyv.net/live/index.html#/channel',
          exploreScope: 'focused',
          includePatterns: ['/live/index.html#/channel*'],
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.exploreScope).toBe('focused')
      expect(config.includePatterns).toEqual(['/live/index.html#/channel*'])
    })

    it('should work with single_page mode', () => {
      const fileConfig: AutoqaConfig = {
        schemaVersion: 1,
        plan: {
          baseUrl: 'https://console.polyv.net/live/index.html#/channel',
          exploreScope: 'single_page',
        },
      }

      const config = loadPlanConfig(fileConfig, {})

      expect(config.exploreScope).toBe('single_page')
      expect(config.baseUrl).toBe('https://console.polyv.net/live/index.html#/channel')
    })
  })
})
