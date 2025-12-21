import { describe, it, expect, vi } from 'vitest'
import { filterGraphByScope } from '../../src/plan/url-scope.js'
import type { PlanConfig, ExplorationGraph } from '../../src/plan/types.js'

describe('URL Scope Logging', () => {
  const createMockGraph = (): ExplorationGraph => ({
    pages: [
      {
        id: 'p1',
        url: 'https://example.com/page1',
        title: 'Page 1',
        depth: 0,
        visitedAt: '2024-01-01T00:00:00Z',
        elementSummary: [],
        forms: [],
        links: [],
      },
      {
        id: 'p2',
        url: 'https://example.com/page2',
        title: 'Page 2',
        depth: 1,
        visitedAt: '2024-01-01T00:01:00Z',
        elementSummary: [],
        forms: [],
        links: [],
      },
      {
        id: 'p3',
        url: 'https://example.com/admin',
        title: 'Admin',
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
    ],
  })

  it('should filter graph correctly when URL scope is applied', () => {
    const graph = createMockGraph()
    const config: PlanConfig = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      exploreScope: 'focused',
      excludePatterns: ['/admin*'],
    }

    const filtered = filterGraphByScope(graph, config)

    expect(filtered.pages).toHaveLength(2)
    expect(filtered.pages.map(p => p.id)).toEqual(['p1', 'p2'])
    expect(filtered.edges).toHaveLength(1)
  })

  it('should handle invalid exploreScope gracefully', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const graph = createMockGraph()
    const config: PlanConfig = {
      baseUrl: 'https://example.com',
      maxDepth: 3,
      exploreScope: 'invalid' as any,
    }

    const filtered = filterGraphByScope(graph, config)

    // Should fall back to 'site' mode behavior
    expect(filtered.pages).toHaveLength(3)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[url-scope] Invalid exploreScope value: invalid')
    )

    consoleWarnSpy.mockRestore()
  })

  it('should not warn for valid exploreScope values', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const graph = createMockGraph()
    const validScopes: Array<'site' | 'focused' | 'single_page'> = ['site', 'focused', 'single_page']

    for (const scope of validScopes) {
      const config: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: scope,
      }

      filterGraphByScope(graph, config)
    }

    expect(consoleWarnSpy).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })
})
