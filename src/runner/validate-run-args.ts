export type ValidatedRunArgs = {
  baseUrl: string
  loginBaseUrl?: string
  headless: boolean
  debug: boolean
}

export type ValidateRunArgsInput = {
  url?: string
  loginUrl?: string
  headless?: boolean
  debug?: boolean
}

export type ValidateRunArgsResult =
  | { ok: true; value: ValidatedRunArgs }
  | { ok: false; message: string }

function normalizeBaseUrl(urlStr: string): string {
  let s = urlStr.trim()
  while (s.endsWith('/')) s = s.slice(0, -1)
  return s
}

function validateHttpUrl(urlStr: string, optionName: string): { ok: true; url: string } | { ok: false; message: string } {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return {
      ok: false,
      message: `Invalid ${optionName}: ${urlStr}. Must be a valid http(s) URL.`,
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      message: `Invalid ${optionName}: ${urlStr}. Must use http: or https:.`,
    }
  }

  return { ok: true, url: normalizeBaseUrl(parsed.toString()) }
}

export function validateRunArgs(input: ValidateRunArgsInput): ValidateRunArgsResult {
  if (!input.url || input.url.trim().length === 0) {
    return {
      ok: false,
      message: 'Base URL is required. Provide --url <baseUrl> or set AUTOQA_BASE_URL.',
    }
  }

  if (input.debug && input.headless) {
    return {
      ok: false,
      message: 'Conflicting options: --debug and --headless cannot be used together.',
    }
  }

  const baseUrlResult = validateHttpUrl(input.url, '--url')
  if (!baseUrlResult.ok) {
    return { ok: false, message: baseUrlResult.message }
  }

  const baseUrl = baseUrlResult.url

  const loginUrlRaw = typeof input.loginUrl === 'string' ? input.loginUrl.trim() : ''
  let loginBaseUrl: string | undefined
  if (loginUrlRaw.length > 0) {
    const loginUrlResult = validateHttpUrl(loginUrlRaw, '--login-url')
    if (!loginUrlResult.ok) {
      return { ok: false, message: loginUrlResult.message }
    }
    loginBaseUrl = loginUrlResult.url
  }
  const debug = Boolean(input.debug)
  const headless = debug ? false : (input.headless ?? true)

  return {
    ok: true,
    value: {
      baseUrl,
      ...(loginBaseUrl ? { loginBaseUrl } : {}),
      headless,
      debug,
    },
  }
}
