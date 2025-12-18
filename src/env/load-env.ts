import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type LoadEnvFilesResult =
  | { ok: true; loadedFiles: string[] }
  | { ok: false; message: string }

type LoadFileOptions = {
  required: boolean
  initialEnvKeys: Set<string>
}

function stripQuotes(value: string): string {
  const s = value.trim()
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1)
  }
  return s
}

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = (content ?? '').split(/\r?\n/g)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line

    const eqIndex = withoutExport.indexOf('=')
    if (eqIndex <= 0) continue

    const key = withoutExport.slice(0, eqIndex).trim()
    if (!key) continue

    const rawValue = withoutExport.slice(eqIndex + 1)
    const value = stripQuotes(rawValue)

    out[key] = value
  }

  return out
}

function loadOneFile(cwd: string, fileName: string, options: LoadFileOptions, loadedFiles: string[]): LoadEnvFilesResult {
  const absPath = join(cwd, fileName)
  if (!existsSync(absPath)) {
    if (options.required) {
      return { ok: false, message: `Env file not found: ${absPath}` }
    }
    return { ok: true, loadedFiles }
  }

  let content: string
  try {
    content = readFileSync(absPath, 'utf8')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Failed to read env file: ${absPath}: ${msg}` }
  }

  const parsed = parseDotEnv(content)

  for (const [k, v] of Object.entries(parsed)) {
    if (options.initialEnvKeys.has(k)) continue
    process.env[k] = v
  }

  loadedFiles.push(absPath)
  return { ok: true, loadedFiles }
}

export type LoadEnvFilesOptions = {
  cwd?: string
  envName?: string
  requireEnvNameFile?: boolean
}
export function loadEnvFiles(options: LoadEnvFilesOptions = {}): LoadEnvFilesResult {
  const cwd = options.cwd ?? process.cwd()
  const requestedEnvName = (options.envName ?? '').trim()
  const requireEnvNameFile = Boolean(options.requireEnvNameFile)

  const initialEnvKeys = new Set(Object.keys(process.env))
  const loadedFiles: string[] = []

  const base = loadOneFile(cwd, '.env', { required: false, initialEnvKeys }, loadedFiles)
  if (!base.ok) return base

  const resolvedEnvName = requestedEnvName.length > 0
    ? requestedEnvName
    : ((process.env.AUTOQA_ENV ?? '').trim())

  if (resolvedEnvName) {
    const envSpecific = loadOneFile(
      cwd,
      `.env.${resolvedEnvName}`,
      { required: requireEnvNameFile, initialEnvKeys },
      loadedFiles,
    )
    if (!envSpecific.ok) return envSpecific
  } else if (requireEnvNameFile) {
    return { ok: false, message: 'Missing --env <name> (required)' }
  }

  return { ok: true, loadedFiles }
}
