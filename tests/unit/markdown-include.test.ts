import { describe, it, expect } from 'vitest'
import {
  isIncludeStep,
  parseIncludeName,
  validateIncludeName,
  resolveIncludePath,
  expandIncludes,
  getIncludeRoot,
  type ExpandIncludesResult,
} from '../../src/markdown/include.js'

describe('isIncludeStep', () => {
  it('returns true for valid include step', () => {
    expect(isIncludeStep('include: login')).toBe(true)
    expect(isIncludeStep('Include: login')).toBe(true)
    expect(isIncludeStep('INCLUDE: login')).toBe(true)
    expect(isIncludeStep('  include: login  ')).toBe(true)
    expect(isIncludeStep('include:login')).toBe(true)
  })

  it('returns false for non-include steps', () => {
    expect(isIncludeStep('Click the login button')).toBe(false)
    expect(isIncludeStep('Navigate to /login')).toBe(false)
    expect(isIncludeStep('includes: login')).toBe(false)
    expect(isIncludeStep('include login')).toBe(false)
  })
})

describe('parseIncludeName', () => {
  it('extracts include name from valid step', () => {
    expect(parseIncludeName('include: login')).toBe('login')
    expect(parseIncludeName('Include: my-steps')).toBe('my-steps')
    expect(parseIncludeName('INCLUDE: step_1')).toBe('step_1')
    expect(parseIncludeName('  include:  common-setup  ')).toBe('common-setup')
  })

  it('returns null for non-include steps', () => {
    expect(parseIncludeName('Click the login button')).toBeNull()
    expect(parseIncludeName('Navigate to /login')).toBeNull()
  })
})

describe('validateIncludeName', () => {
  it('returns ok for valid names', () => {
    expect(validateIncludeName('login')).toEqual({ ok: true })
    expect(validateIncludeName('my-steps')).toEqual({ ok: true })
    expect(validateIncludeName('step_1')).toEqual({ ok: true })
    expect(validateIncludeName('CommonSetup')).toEqual({ ok: true })
    expect(validateIncludeName('a')).toEqual({ ok: true })
    expect(validateIncludeName('A1_b-c')).toEqual({ ok: true })
    // Now also support relative paths
    expect(validateIncludeName('polyv/login')).toEqual({ ok: true })
    expect(validateIncludeName('polyv/login.md')).toEqual({ ok: true })
    expect(validateIncludeName('auth/sso/login.md')).toEqual({ ok: true })
  })

  it('returns error for names with forbidden characters', () => {
    // Backslashes are not allowed
    const result1 = validateIncludeName('path\\to\\file')
    expect(result1.ok).toBe(false)
    if (!result1.ok) {
      expect(result1.error.code).toBe('INCLUDE_INVALID_NAME')
    }

    // Path traversal (..) is not allowed
    const result2 = validateIncludeName('../parent')
    expect(result2.ok).toBe(false)

    const result3 = validateIncludeName('..\\parent')
    expect(result3.ok).toBe(false)
    
    const result4 = validateIncludeName('foo/../bar')
    expect(result4.ok).toBe(false)
    
    // Invalid characters
    const result5 = validateIncludeName('my steps')
    expect(result5.ok).toBe(false)
    
    const result6 = validateIncludeName('step@123')
    expect(result6.ok).toBe(false)
  })

  it('returns error for empty name', () => {
    const result = validateIncludeName('')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INCLUDE_INVALID_NAME')
    }
  })

  it('normalizes include names with .md extension', () => {
    // Simple names get .md appended
    expect(resolveIncludePath('login', '/project')).toBe('/project/steps/login.md')
    // Already has .md, no change
    expect(resolveIncludePath('login.md', '/project')).toBe('/project/steps/login.md')
    // Relative paths work
    expect(resolveIncludePath('polyv/login', '/project')).toBe('/project/steps/polyv/login.md')
    expect(resolveIncludePath('polyv/login.md', '/project')).toBe('/project/steps/polyv/login.md')
  })
})

describe('resolveIncludePath', () => {
  it('resolves path to primary steps/ directory', () => {
    const result = resolveIncludePath('login', '/project')
    expect(result).toBe('/project/steps/login.md')
  })

  it('resolves path with different names', () => {
    expect(resolveIncludePath('common-setup', '/project')).toBe('/project/steps/common-setup.md')
    expect(resolveIncludePath('step_1', '/project')).toBe('/project/steps/step_1.md')
  })
  
  it('uses fallback path when primary does not exist', () => {
    const mockReadFile = (path: string) => {
      if (path === '/project/steps/login.md') return null
      if (path === '/project/specs/steps/login.md') return '# Login steps'
      return null
    }
    
    const result = resolveIncludePath('login', '/project', mockReadFile)
    expect(result).toBe('/project/specs/steps/login.md')
  })
  
  it('prefers primary path when both exist', () => {
    const mockReadFile = (path: string) => {
      if (path === '/project/steps/login.md') return '# Primary login'
      if (path === '/project/specs/steps/login.md') return '# Fallback login'
      return null
    }
    
    const result = resolveIncludePath('login', '/project', mockReadFile)
    expect(result).toBe('/project/steps/login.md')
  })
})

describe('getIncludeRoot', () => {
  it('returns path as-is for directory input', () => {
    const result = getIncludeRoot('/project/specs', true)
    expect(result).toBe('/project/specs')
  })

  it('returns dirname for file input', () => {
    const result = getIncludeRoot('/project/specs/test.md', false)
    expect(result).toBe('/project/specs')
  })
})

describe('expandIncludes', () => {
  const mockReadFile = (files: Record<string, string>) => {
    return (path: string): string | null => {
      return files[path] ?? null
    }
  }

  it('expands single include step', () => {
    const steps = ['Navigate to /', 'include: login', 'Verify dashboard']
    const files: Record<string, string> = {
      '/specs/steps/login.md': `## Steps
1. Fill username field
2. Fill password field
3. Click login button`,
    }

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([
        'Navigate to /',
        'Fill username field',
        'Fill password field',
        'Click login button',
        'Verify dashboard',
      ])
    }
  })

  it('expands multiple include steps', () => {
    const steps = ['include: setup', 'Do something', 'include: teardown']
    const files: Record<string, string> = {
      '/specs/steps/setup.md': `1. Step A
2. Step B`,
      '/specs/steps/teardown.md': `1. Step X
2. Step Y`,
    }

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(['Step A', 'Step B', 'Do something', 'Step X', 'Step Y'])
    }
  })

  it('returns error for missing include file', () => {
    const steps = ['include: nonexistent']
    const files: Record<string, string> = {}

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INCLUDE_FILE_NOT_FOUND')
      expect(result.error.message).toContain('nonexistent')
      expect(result.error.message).toContain('steps/nonexistent.md')
    }
  })

  it('returns error for invalid include name', () => {
    const steps = ['include: ../evil']
    const files: Record<string, string> = {}

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INCLUDE_INVALID_NAME')
    }
  })

  it('returns error for include file with no ordered list', () => {
    const steps = ['include: empty']
    const files: Record<string, string> = {
      '/specs/steps/empty.md': `## Steps
- unordered item
- another item`,
    }

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INCLUDE_NO_STEPS')
    }
  })

  it('returns error for nested include (MVP: no recursion)', () => {
    const steps = ['include: outer']
    const files: Record<string, string> = {
      '/specs/steps/outer.md': `1. Step one
2. include: inner
3. Step three`,
    }

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INCLUDE_NESTED_NOT_ALLOWED')
    }
  })

  it('preserves steps without include', () => {
    const steps = ['Step 1', 'Step 2', 'Step 3']
    const files: Record<string, string> = {}

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(['Step 1', 'Step 2', 'Step 3'])
    }
  })

  it('handles steps library without ## Steps heading', () => {
    const steps = ['include: simple']
    const files: Record<string, string> = {
      '/specs/steps/simple.md': `1. First step
2. Second step`,
    }

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(['First step', 'Second step'])
    }
  })

  it('handles steps library with template variables', () => {
    const steps = ['include: login-template']
    const files: Record<string, string> = {
      '/specs/steps/login-template.md': `1. Fill username with {{USERNAME}}
2. Fill password with {{PASSWORD}}`,
    }

    const result = expandIncludes(steps, '/specs', mockReadFile(files))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([
        'Fill username with {{USERNAME}}',
        'Fill password with {{PASSWORD}}',
      ])
    }
  })
})
