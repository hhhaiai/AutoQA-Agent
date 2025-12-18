import { describe, expect, it } from 'vitest'

import { renderMarkdownTemplate } from '../../src/markdown/template.js'

describe('renderMarkdownTemplate', () => {
  it('replaces known variables', () => {
    const md = 'Navigate to {{BASE_URL}}/login\nEnv={{ENV}}\n'
    const out = renderMarkdownTemplate(md, { BASE_URL: 'https://app.example.com', ENV: 'test' })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toBe('Navigate to https://app.example.com/login\nEnv=test\n')
  })

  it('replaces USERNAME and PASSWORD variables', () => {
    const md = 'Fill username with {{USERNAME}}\nFill password with {{PASSWORD}}\n'
    const out = renderMarkdownTemplate(md, {
      USERNAME: 'test_user',
      PASSWORD: 'test_pass',
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toBe('Fill username with test_user\nFill password with test_pass\n')
  })

  it('allows USERNAME and PASSWORD to be optional (undefined)', () => {
    const md = 'Navigate to {{BASE_URL}}/login\n'
    const out = renderMarkdownTemplate(md, {
      BASE_URL: 'https://app.example.com',
      USERNAME: undefined,
      PASSWORD: undefined,
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.value).toBe('Navigate to https://app.example.com/login\n')
  })

  it('fails when USERNAME is used but not provided', () => {
    const md = 'Fill username with {{USERNAME}}\n'
    const out = renderMarkdownTemplate(md, {
      BASE_URL: 'https://app.example.com',
      USERNAME: undefined,
    })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.message).toContain('Missing template variables')
    expect(out.message).toContain('USERNAME')
  })

  it('fails when PASSWORD is used but not provided', () => {
    const md = 'Fill password with {{PASSWORD}}\n'
    const out = renderMarkdownTemplate(md, {
      BASE_URL: 'https://app.example.com',
      PASSWORD: undefined,
    })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.message).toContain('Missing template variables')
    expect(out.message).toContain('PASSWORD')
  })

  it('fails on unknown variables', () => {
    const md = 'Hello {{UNKNOWN}}'
    const out = renderMarkdownTemplate(md, { BASE_URL: 'x' })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.message).toContain('Unknown template variables')
    expect(out.message).toContain('UNKNOWN')
  })

  it('fails on missing variables', () => {
    const md = 'Login={{LOGIN_BASE_URL}}'
    const out = renderMarkdownTemplate(md, { LOGIN_BASE_URL: undefined })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.message).toContain('Missing template variables')
    expect(out.message).toContain('LOGIN_BASE_URL')
  })
})
