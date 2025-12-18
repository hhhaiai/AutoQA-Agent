export type RenderTemplateResult =
  | { ok: true; value: string }
  | { ok: false; message: string }

const TEMPLATE_VAR_PATTERN = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g

export function renderMarkdownTemplate(
  markdown: string,
  vars: Record<string, string | undefined>,
): RenderTemplateResult {
  const unknownVars = new Set<string>()
  const missingVars = new Set<string>()

  const out = (markdown ?? '').replace(TEMPLATE_VAR_PATTERN, (full: string, key: string) => {
    const k = String(key ?? '').trim()
    if (!k) return full

    if (!(k in vars)) {
      unknownVars.add(k)
      return full
    }

    const value = vars[k]
    if (!value) {
      missingVars.add(k)
      return full
    }

    return value
  })

  if (unknownVars.size > 0 || missingVars.size > 0) {
    const unknown = unknownVars.size > 0 ? Array.from(unknownVars).sort().join(', ') : ''
    const missing = missingVars.size > 0 ? Array.from(missingVars).sort().join(', ') : ''

    const parts: string[] = []
    if (unknown) parts.push(`Unknown template variables: ${unknown}`)
    if (missing) parts.push(`Missing template variables: ${missing}`)

    return { ok: false, message: parts.join('\n') }
  }

  return { ok: true, value: out }
}
