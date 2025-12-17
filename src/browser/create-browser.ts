import { chromium, type Browser, type BrowserContext } from 'playwright'

export type CreateBrowserOptions = {
  headless: boolean
  slowMo?: number
}

export type CreateBrowserResult = {
  browser: Browser
  persistentContext?: BrowserContext
}

export async function createBrowser(options: CreateBrowserOptions): Promise<CreateBrowserResult> {
  const explicitChannel = (process.env.AUTOQA_CHROMIUM_CHANNEL ?? '').trim()
  const shouldDefaultToChromeChannel = !options.headless && !explicitChannel
  const channel = explicitChannel || (shouldDefaultToChromeChannel ? 'chrome' : '')

  const rawUserDataDir = (process.env.AUTOQA_CHROMIUM_USER_DATA_DIR ?? '').trim()
  const userDataDir = rawUserDataDir.length > 0 ? rawUserDataDir : undefined

  const rawDisableTranslate = (process.env.AUTOQA_CHROME_DISABLE_TRANSLATE ?? '').trim().toLowerCase()
  const disableTranslate = rawDisableTranslate === '' || rawDisableTranslate === '1' || rawDisableTranslate === 'true'
  const translateArgs = disableTranslate ? ['--disable-features=Translate,TranslateUI', '--disable-translate'] : []

  const args = options.headless
    ? ['--window-size=1440,900', ...translateArgs]
    : ['--start-maximized', ...translateArgs]

  try {
    if (userDataDir) {
      const persistentContext = await chromium.launchPersistentContext(userDataDir, {
        headless: options.headless,
        slowMo: options.slowMo,
        args,
        ...(channel ? { channel } : {}),
      })

      const browser = persistentContext.browser()
      return { browser, persistentContext }
    }

    const browser = await chromium.launch({
      headless: options.headless,
      slowMo: options.slowMo,
      args,
      ...(channel ? { channel } : {}),
    })
    return { browser }
  } catch (err: unknown) {
    if (!shouldDefaultToChromeChannel) throw err

    if (userDataDir) {
      const persistentContext = await chromium.launchPersistentContext(userDataDir, {
        headless: options.headless,
        slowMo: options.slowMo,
        args,
      })

      const browser = persistentContext.browser()
      return { browser, persistentContext }
    }

    const browser = await chromium.launch({
      headless: options.headless,
      slowMo: options.slowMo,
      args,
    })
    return { browser }
  }
}
