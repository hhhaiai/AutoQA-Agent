import { describe, it, expect } from 'vitest'
import { extractRelativeUrl, isUrlInScope, filterGraphByScope } from '../../src/plan/url-scope.js'
import type { PlanConfig, ExplorationGraph } from '../../src/plan/types.js'

describe('URL Scope Utilities', () => {
  describe('extractRelativeUrl', () => {
    it('should extract pathname + hash from full URL', () => {
      expect(extractRelativeUrl('https://console.polyv.net/live/index.html#/channel'))
        .toBe('/live/index.html#/channel')
    })

    it('should handle URLs without hash', () => {
      expect(extractRelativeUrl('https://example.com/path/to/page'))
        .toBe('/path/to/page')
    })

    it('should handle URLs with only hash', () => {
      expect(extractRelativeUrl('https://example.com/#/dashboard'))
        .toBe('/#/dashboard')
    })

    it('should handle root URL', () => {
      expect(extractRelativeUrl('https://example.com/'))
        .toBe('/')
    })

    it('should return original string for invalid URLs', () => {
      expect(extractRelativeUrl('/relative/path'))
        .toBe('/relative/path')
    })
  })

  describe('isUrlInScope - site mode', () => {
    const config: PlanConfig = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      exploreScope: 'site',
    }

    it('should allow all URLs from same domain in site mode', () => {
      expect(isUrlInScope('https://example.com/', config)).toBe(true)
      expect(isUrlInScope('https://example.com/page1', config)).toBe(true)
      expect(isUrlInScope('https://example.com/deep/nested/page', config)).toBe(true)
    })

    it('should reject URLs from different domain in site mode', () => {
      expect(isUrlInScope('https://other-domain.com/', config)).toBe(false)
      expect(isUrlInScope('https://subdomain.example.com/', config)).toBe(false)
    })

    it('should respect excludePatterns in site mode', () => {
      const configWithExclude: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'site',
        excludePatterns: ['/admin*', '/internal*'],
      }

      expect(isUrlInScope('https://example.com/page1', configWithExclude)).toBe(true)
      expect(isUrlInScope('https://example.com/admin', configWithExclude)).toBe(false)
      expect(isUrlInScope('https://example.com/admin/users', configWithExclude)).toBe(false)
      expect(isUrlInScope('https://example.com/internal/api', configWithExclude)).toBe(false)
    })

    it('should respect includePatterns in site mode when specified', () => {
      const configWithInclude: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'site',
        includePatterns: ['/public*', '/docs*'],
      }

      expect(isUrlInScope('https://example.com/public', configWithInclude)).toBe(true)
      expect(isUrlInScope('https://example.com/public/page', configWithInclude)).toBe(true)
      expect(isUrlInScope('https://example.com/docs', configWithInclude)).toBe(true)
      expect(isUrlInScope('https://example.com/other', configWithInclude)).toBe(false)
    })

    it('should apply both include and exclude patterns in site mode', () => {
      const configWithBoth: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'site',
        includePatterns: ['/api*'],
        excludePatterns: ['/api/internal*'],
      }

      expect(isUrlInScope('https://example.com/api/public', configWithBoth)).toBe(true)
      expect(isUrlInScope('https://example.com/api/internal', configWithBoth)).toBe(false)
      expect(isUrlInScope('https://example.com/other', configWithBoth)).toBe(false)
    })
  })

  describe('isUrlInScope - focused mode', () => {
    it('should match URLs with include patterns', () => {
      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net/live/index.html#/channel',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/live/index.html#/channel*'],
      }

      expect(isUrlInScope('https://console.polyv.net/live/index.html#/channel', config)).toBe(true)
      expect(isUrlInScope('https://console.polyv.net/live/index.html#/channel/list', config)).toBe(true)
      expect(isUrlInScope('https://console.polyv.net/live/index.html#/statistics', config)).toBe(false)
    })

    it('should exclude URLs matching exclude patterns', () => {
      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/live/index.html#/*'],
        excludePatterns: ['/live/index.html#/statistics*', '/live/index.html#/settings*'],
      }

      expect(isUrlInScope('https://console.polyv.net/live/index.html#/channel', config)).toBe(true)
      expect(isUrlInScope('https://console.polyv.net/live/index.html#/statistics', config)).toBe(false)
      expect(isUrlInScope('https://console.polyv.net/live/index.html#/settings', config)).toBe(false)
    })

    it('should auto-derive include pattern from baseUrl when not specified', () => {
      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net/live/index.html#/channel',
        maxDepth: 3,
        exploreScope: 'focused',
      }

      expect(isUrlInScope('https://console.polyv.net/live/index.html#/channel', config)).toBe(true)
      expect(isUrlInScope('https://console.polyv.net/live/index.html#/channel/list', config)).toBe(true)
      expect(isUrlInScope('https://console.polyv.net/live/index.html#/statistics', config)).toBe(false)
    })

    it('should handle exact pattern matching (no wildcard)', () => {
      const config: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/exact/path'],
      }

      expect(isUrlInScope('https://example.com/exact/path', config)).toBe(true)
      expect(isUrlInScope('https://example.com/exact/path/sub', config)).toBe(false)
    })
  })

  describe('isUrlInScope - single_page mode', () => {
    it('should allow URLs with same prefix as baseUrl', () => {
      const config: PlanConfig = {
        baseUrl: 'https://example.com/app#/dashboard',
        maxDepth: 3,
        exploreScope: 'single_page',
      }

      expect(isUrlInScope('https://example.com/app#/dashboard', config)).toBe(true)
      expect(isUrlInScope('https://example.com/app#/dashboard/tab1', config)).toBe(true)
      expect(isUrlInScope('https://example.com/app#/settings', config)).toBe(false)
    })

    it('should respect include patterns in single_page mode', () => {
      const config: PlanConfig = {
        baseUrl: 'https://example.com/app',
        maxDepth: 3,
        exploreScope: 'single_page',
        includePatterns: ['/app#/dashboard*', '/app#/profile*'],
      }

      expect(isUrlInScope('https://example.com/app#/dashboard', config)).toBe(true)
      expect(isUrlInScope('https://example.com/app#/profile', config)).toBe(true)
      expect(isUrlInScope('https://example.com/app#/settings', config)).toBe(false)
    })

    it('should exclude URLs matching exclude patterns', () => {
      const config: PlanConfig = {
        baseUrl: 'https://example.com/app',
        maxDepth: 3,
        exploreScope: 'single_page',
        includePatterns: ['/app#/*'],
        excludePatterns: ['/app#/admin*'],
      }

      expect(isUrlInScope('https://example.com/app#/dashboard', config)).toBe(true)
      expect(isUrlInScope('https://example.com/app#/admin', config)).toBe(false)
    })
  })

  describe('filterGraphByScope', () => {
    const createMockGraph = (): ExplorationGraph => ({
      pages: [
        {
          id: 'p1',
          url: 'https://console.polyv.net/live/index.html#/channel',
          title: 'Channel List',
          depth: 0,
          visitedAt: '2024-01-01T00:00:00Z',
          elementSummary: [],
          forms: [],
          links: [],
        },
        {
          id: 'p2',
          url: 'https://console.polyv.net/live/index.html#/channel/detail',
          title: 'Channel Detail',
          depth: 1,
          visitedAt: '2024-01-01T00:01:00Z',
          elementSummary: [],
          forms: [],
          links: [],
        },
        {
          id: 'p3',
          url: 'https://console.polyv.net/live/index.html#/statistics',
          title: 'Statistics',
          depth: 1,
          visitedAt: '2024-01-01T00:02:00Z',
          elementSummary: [],
          forms: [],
          links: [],
        },
      ],
      edges: [
        { from: 'p1', to: 'p2', action: 'click' },
        { from: 'p1', to: 'p3', action: 'click' },
        { from: 'p2', to: 'p1', action: 'navigate' },
      ],
    })

    it('should not filter in site mode', () => {
      const graph = createMockGraph()
      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net',
        maxDepth: 3,
        exploreScope: 'site',
      }

      const filtered = filterGraphByScope(graph, config)

      expect(filtered.pages).toHaveLength(3)
      expect(filtered.edges).toHaveLength(3)
    })

    it('should filter pages and edges in focused mode', () => {
      const graph = createMockGraph()
      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/live/index.html#/channel*'],
      }

      const filtered = filterGraphByScope(graph, config)

      expect(filtered.pages).toHaveLength(2)
      expect(filtered.pages.map(p => p.id)).toEqual(['p1', 'p2'])
      expect(filtered.edges).toHaveLength(2)
      expect(filtered.edges).toEqual([
        { from: 'p1', to: 'p2', action: 'click' },
        { from: 'p2', to: 'p1', action: 'navigate' },
      ])
    })

    it('should remove edges connecting to out-of-scope pages', () => {
      const graph = createMockGraph()
      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net',
        maxDepth: 3,
        exploreScope: 'focused',
        excludePatterns: ['/live/index.html#/statistics*'],
      }

      const filtered = filterGraphByScope(graph, config)

      expect(filtered.pages).toHaveLength(2)
      const edgeToStatistics = filtered.edges.find(e => e.to === 'p3')
      expect(edgeToStatistics).toBeUndefined()
    })

    it('should handle empty graph', () => {
      const graph: ExplorationGraph = { pages: [], edges: [] }
      const config: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/app*'],
      }

      const filtered = filterGraphByScope(graph, config)

      expect(filtered.pages).toHaveLength(0)
      expect(filtered.edges).toHaveLength(0)
    })
  })
})
