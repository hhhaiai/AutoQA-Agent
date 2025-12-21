import { describe, it, expect } from 'vitest'
import { filterGraphByScope } from '../../src/plan/url-scope.js'
import type { PlanConfig, ExplorationGraph } from '../../src/plan/types.js'

describe('URL Scope Integration Tests', () => {
  describe('End-to-end graph filtering', () => {
    it('should filter mixed in-scope and out-of-scope pages correctly', () => {
      const graph: ExplorationGraph = {
        pages: [
          {
            id: 'p1',
            url: 'https://console.polyv.net/live/index.html#/channel',
            title: 'Channel List',
            depth: 0,
            visitedAt: '2024-01-01T00:00:00Z',
            elementSummary: [
              { id: 'e1', kind: 'button', text: 'Create Channel' },
              { id: 'e2', kind: 'link', text: 'Statistics', href: '/live/index.html#/statistics' },
            ],
            forms: [],
            links: [
              { text: 'Channel Detail', href: '/live/index.html#/channel/detail', external: false },
              { text: 'Statistics', href: '/live/index.html#/statistics', external: false },
            ],
          },
          {
            id: 'p2',
            url: 'https://console.polyv.net/live/index.html#/channel/detail',
            title: 'Channel Detail',
            depth: 1,
            visitedAt: '2024-01-01T00:01:00Z',
            elementSummary: [
              { id: 'e3', kind: 'button', text: 'Edit' },
            ],
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
          {
            id: 'p4',
            url: 'https://console.polyv.net/live/index.html#/settings',
            title: 'Settings',
            depth: 1,
            visitedAt: '2024-01-01T00:03:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
        ],
        edges: [
          { from: 'p1', to: 'p2', action: 'click' },
          { from: 'p1', to: 'p3', action: 'click' },
          { from: 'p1', to: 'p4', action: 'click' },
          { from: 'p2', to: 'p1', action: 'navigate' },
        ],
      }

      const config: PlanConfig = {
        baseUrl: 'https://console.polyv.net/live/index.html#/channel',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/live/index.html#/channel*'],
      }

      const filtered = filterGraphByScope(graph, config)

      // Should only keep channel-related pages
      expect(filtered.pages).toHaveLength(2)
      expect(filtered.pages.map(p => p.id).sort()).toEqual(['p1', 'p2'])
      
      // Should only keep edges between in-scope pages
      expect(filtered.edges).toHaveLength(2)
      expect(filtered.edges).toEqual([
        { from: 'p1', to: 'p2', action: 'click' },
        { from: 'p2', to: 'p1', action: 'navigate' },
      ])
    })

    it('should handle complex include/exclude patterns', () => {
      const graph: ExplorationGraph = {
        pages: [
          {
            id: 'p1',
            url: 'https://example.com/api/public/users',
            title: 'Public Users API',
            depth: 0,
            visitedAt: '2024-01-01T00:00:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
          {
            id: 'p2',
            url: 'https://example.com/api/public/posts',
            title: 'Public Posts API',
            depth: 1,
            visitedAt: '2024-01-01T00:01:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
          {
            id: 'p3',
            url: 'https://example.com/api/internal/users',
            title: 'Internal Users API',
            depth: 1,
            visitedAt: '2024-01-01T00:02:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
          {
            id: 'p4',
            url: 'https://example.com/docs/api',
            title: 'API Docs',
            depth: 1,
            visitedAt: '2024-01-01T00:03:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
        ],
        edges: [
          { from: 'p1', to: 'p2', action: 'click' },
          { from: 'p1', to: 'p3', action: 'click' },
          { from: 'p1', to: 'p4', action: 'click' },
        ],
      }

      const config: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/api/*'],
        excludePatterns: ['/api/internal*'],
      }

      const filtered = filterGraphByScope(graph, config)

      // Should keep public API pages but exclude internal
      expect(filtered.pages).toHaveLength(2)
      expect(filtered.pages.map(p => p.id).sort()).toEqual(['p1', 'p2'])
      
      // Should only keep edge between public API pages
      expect(filtered.edges).toHaveLength(1)
      expect(filtered.edges[0]).toEqual({ from: 'p1', to: 'p2', action: 'click' })
    })

    it('should handle single_page mode correctly', () => {
      const graph: ExplorationGraph = {
        pages: [
          {
            id: 'p1',
            url: 'https://example.com/app#/dashboard',
            title: 'Dashboard',
            depth: 0,
            visitedAt: '2024-01-01T00:00:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
          {
            id: 'p2',
            url: 'https://example.com/app#/dashboard/tab1',
            title: 'Dashboard Tab 1',
            depth: 1,
            visitedAt: '2024-01-01T00:01:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
          {
            id: 'p3',
            url: 'https://example.com/app#/settings',
            title: 'Settings',
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
      }

      const config: PlanConfig = {
        baseUrl: 'https://example.com/app#/dashboard',
        maxDepth: 3,
        exploreScope: 'single_page',
      }

      const filtered = filterGraphByScope(graph, config)

      // Should only keep dashboard and its sub-routes
      expect(filtered.pages).toHaveLength(2)
      expect(filtered.pages.map(p => p.id).sort()).toEqual(['p1', 'p2'])
      
      // Should only keep edge within dashboard scope
      expect(filtered.edges).toHaveLength(1)
      expect(filtered.edges[0]).toEqual({ from: 'p1', to: 'p2', action: 'click' })
    })

    it('should preserve graph structure when all pages are in scope', () => {
      const graph: ExplorationGraph = {
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
        ],
        edges: [
          { from: 'p1', to: 'p2', action: 'click' },
        ],
      }

      const config: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'site',
      }

      const filtered = filterGraphByScope(graph, config)

      // Should keep all pages and edges
      expect(filtered.pages).toHaveLength(2)
      expect(filtered.edges).toHaveLength(1)
      expect(filtered).toEqual(graph)
    })

    it('should handle empty graph gracefully', () => {
      const graph: ExplorationGraph = {
        pages: [],
        edges: [],
      }

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

    it('should handle graph with all pages filtered out', () => {
      const graph: ExplorationGraph = {
        pages: [
          {
            id: 'p1',
            url: 'https://example.com/admin',
            title: 'Admin',
            depth: 0,
            visitedAt: '2024-01-01T00:00:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
          {
            id: 'p2',
            url: 'https://example.com/internal',
            title: 'Internal',
            depth: 1,
            visitedAt: '2024-01-01T00:01:00Z',
            elementSummary: [],
            forms: [],
            links: [],
          },
        ],
        edges: [
          { from: 'p1', to: 'p2', action: 'click' },
        ],
      }

      const config: PlanConfig = {
        baseUrl: 'https://example.com',
        maxDepth: 3,
        exploreScope: 'focused',
        includePatterns: ['/public*'],
      }

      const filtered = filterGraphByScope(graph, config)

      // All pages should be filtered out
      expect(filtered.pages).toHaveLength(0)
      expect(filtered.edges).toHaveLength(0)
    })
  })
})
