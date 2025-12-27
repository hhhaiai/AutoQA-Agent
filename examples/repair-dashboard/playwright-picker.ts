#!/usr/bin/env node
/**
 * AutoQA 元素选择器 - Playwright 版本
 *
 * 功能：
 * 1. 启动 Playwright 浏览器
 * 2. 导航到目标页面
 * 3. 注入元素选择脚本
 * 4. 用户点击元素后生成 Playwright locator
 * 5. 实时验证 locator 唯一性
 */

import { chromium, type Page, type Browser } from 'playwright'
import { readline } from 'node:readline/promises'

interface SelectedElement {
  locator: string
  rawSelector: string
  isUnique: boolean
  matchCount: number
  elementInfo: {
    tagName: string
    id?: string
    className?: string
    text?: string
    role?: string
    name?: string
    type?: string
    placeholder?: string
    ariaLabel?: string
    testId?: string
  }
}

/**
 * 注入元素选择器脚本到页面
 */
async function injectElementPicker(page: Page): Promise<void> {
  await page.evaluate(() => {
    // 创建高亮框
    const highlightBox = document.createElement('div')
    highlightBox.id = '__autoqa_highlight_box__'
    highlightBox.style.cssText = `
      position: fixed;
      border: 2px solid #ff6b6b;
      background: rgba(255, 107, 107, 0.15);
      pointer-events: none;
      z-index: 999999;
      display: none;
      transition: all 0.1s ease;
    `
    document.body.appendChild(highlightBox)

    // 创建提示条
    const tooltip = document.createElement('div')
    tooltip.id = '__autoqa_tooltip__'
    tooltip.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #50fa7b;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: Monaco, Menlo, monospace;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `
    tooltip.textContent = '🔧 元素选择模式已启用 - 点击页面上的任意元素'
    document.body.appendChild(tooltip)

    // 存储原始的事件处理器（用于清理）
    ;(window as any).__autoqa_cleanup__ = () => {
      highlightBox.remove()
      tooltip.remove()
    }

    // 鼠标悬停效果
    document.body.addEventListener('mouseover', (e: Event) => {
      const target = e.target as HTMLElement
      const rect = target.getBoundingClientRect()

      highlightBox.style.display = 'block'
      highlightBox.style.left = rect.left + 'px'
      highlightBox.style.top = rect.top + 'px'
      highlightBox.style.width = rect.width + 'px'
      highlightBox.style.height = rect.height + 'px'

      // 更新提示
      const tagName = target.tagName.toLowerCase()
      const text = target.textContent?.trim().substring(0, 20) || ''
      tooltip.textContent = `${tagName}${text ? `: "${text}"` : ''}`
    }, true)

    // 鼠标移出时隐藏高亮
    document.body.addEventListener('mouseout', (e: Event) => {
      if ((e.target as Element) === highlightBox) return
      highlightBox.style.display = 'none'
    }, true)

    // 点击元素
    document.body.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const target = e.target as Element

      // 分析元素
      const info = analyzeElement(target)

      // 发送到控制台（Playwright 可以监听）
      console.log('__AUTOQA_SELECTED__:' + JSON.stringify(info))
    }, true)
  })

  // 监听控制台输出
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.startsWith('__AUTOQA_SELECTED__:')) {
      const data = JSON.parse(text.replace('__AUTOQA_SELECTED__:', ''))
      // 触发自定义事件，让外部可以监听
      ;(page as any).emit('autoqa:element-selected', data)
    }
  })
}

/**
 * 在页面上下文中分析元素
 */
function analyzeElement(el: Element): object {
  const htmlElement = el as HTMLElement

  // 提取元素信息
  const tagName = el.tagName.toLowerCase()
  const id = el.id
  const className = el.className
  const text = htmlElement.textContent?.trim().substring(0, 50) || ''
  const role = el.getAttribute('role')
  const name = el.getAttribute('name')
  const type = el.getAttribute('type')
  const placeholder = el.getAttribute('placeholder')
  const ariaLabel = el.getAttribute('aria-label')
  const testId = el.getAttribute('data-testid')
  const testName = el.getAttribute('data-test')
  const dataCy = el.getAttribute('data-cy')

  return {
    tagName,
    id,
    className: typeof className === 'string' ? className : '',
    text,
    role,
    name,
    type,
    placeholder,
    ariaLabel,
    testId,
    testName,
    dataCy,
    // 获取元素路径（用于调试）
    xpath: getXPath(el),
  }
}

/**
 * 生成元素的 XPath
 */
function getXPath(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0
    let sibling = current.previousSibling as Element

    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName === current.tagName) {
        index++
      }
      sibling = sibling.previousSibling as Element
    }

    const tagName = current.tagName.toLowerCase()
    const pathIndex = index > 0 ? `[${index + 1}]` : ''
    parts.unshift(`${tagName}${pathIndex}`)

    current = current.parentElement as Element
  }

  return '/' + parts.join('/')
}

/**
 * 生成 Playwright locator 代码
 */
function generatePlaywrightLocator(elementInfo: ReturnType<typeof analyzeElement>): string[] {
  const locators: Array<{ priority: number; code: string; reason: string }> = []

  const { tagName, id, className, text, role, name, type, placeholder, ariaLabel, testId, testName, dataCy } =
    elementInfo

  // 1. data-testid (最高优先级)
  if (testId) {
    locators.push({
      priority: 100,
      code: `page.getByTestId('${testId}')`,
      reason: 'data-testid attribute (recommended)',
    })
  }

  // 2. data-test
  if (testName) {
    locators.push({
      priority: 95,
      code: `page.getByTestId('${testName}')`,
      reason: 'data-test attribute',
    })
  }

  // 3. data-cy (Cypress 兼容)
  if (dataCy) {
    locators.push({
      priority: 90,
      code: `page.getByTestId('${dataCy}')`,
      reason: 'data-cy attribute',
    })
  }

  // 4. ID (如果简洁)
  if (id && id.length < 20 && !id.match(/^\d/)) {
    locators.push({
      priority: 80,
      code: `page.locator('#${id}')`,
      reason: 'ID attribute',
    })
  }

  // 5. Role + accessible name
  if (role) {
    const accessibleName = ariaLabel || placeholder || (text.length > 0 && text.length < 30 ? text : undefined)
    if (accessibleName) {
      locators.push({
        priority: 70,
        code: `page.getByRole('${role}', { name: '${accessibleName}' })`,
        reason: 'Semantic role with name',
      })
    }
  }

  // 6. Label (for form inputs)
  if (placeholder) {
    locators.push({
      priority: 60,
      code: `page.getByPlaceholder('${placeholder}')`,
      reason: 'Placeholder attribute',
    })
  }

  // 7. Text content (短文本)
  if (text && text.length > 0 && text.length < 30 && !text.match(/\n/)) {
    // 精确匹配
    locators.push({
      priority: 50,
      code: `page.getByText('${text}', { exact: true })`,
      reason: 'Exact text match',
    })
  }

  // 8. Text content (模糊匹配)
  if (text && text.length > 0 && text.length < 50) {
    locators.push({
      priority: 40,
      code: `page.getByText('${text.substring(0, 20)}')`,
      reason: 'Partial text match',
    })
  }

  // 9. ARIA label
  if (ariaLabel) {
    locators.push({
      priority: 35,
      code: `page.getByLabel('${ariaLabel}')`,
      reason: 'ARIA label',
    })
  }

  // 10. Name attribute (for forms)
  if (name) {
    locators.push({
      priority: 30,
      code: `page.locator('[name="${name}"]')`,
      reason: 'Name attribute',
    })
  }

  // 11. Class + Tag (第一个 class)
  if (className && typeof className === 'string' && className.length > 0) {
    const classes = className.split(' ').filter((c) => c && !c.match(/^(active|selected|hover|focus)$/i))
    if (classes.length > 0) {
      locators.push({
        priority: 20,
        code: `page.locator('.${classes[0]}')`,
        reason: 'CSS class',
      })
    }
  }

  // 12. Tag alone (最后备用)
  locators.push({
    priority: 10,
    code: `page.locator('${tagName}')`,
    reason: 'Tag name (fallback)',
  })

  // 按优先级排序
  locators.sort((a, b) => b.priority - a.priority)

  return locators.map((l) => l.code)
}

/**
 * 验证 locator 是否唯一
 */
async function validateLocator(page: Page, locatorCode: string): Promise<{ isUnique: boolean; count: number }> {
  try {
    // 提取 selector 部分
    let selector: string
    let options = ''

    if (locatorCode.includes("page.getByTestId('")) {
      const match = locatorCode.match(/getByTestId\('(.+?)'\)/)
      if (match) selector = `[data-testid="${match[1]}"]`
    } else if (locatorCode.includes("page.getByRole('")) {
      const roleMatch = locatorCode.match(/getByRole\('(.+?)'/)
      const nameMatch = locatorCode.match(/name:\s*['"](.+?)['"]/)
      if (roleMatch) {
        selector = `[role="${roleMatch[1]}"]`
        if (nameMatch) options += `[aria-label~="${nameMatch[1]}"]`
      }
    } else if (locatorCode.includes("page.getByPlaceholder('")) {
      const match = locatorCode.match(/getByPlaceholder\('(.+?)'\)/)
      if (match) selector = `[placeholder="${match[1]}"]`
    } else if (locatorCode.includes("page.getByText('")) {
      const match = locatorCode.match(/getByText\('(.+?)'/)
      if (match) {
        const exact = locatorCode.includes('{ exact: true }')
        if (exact) {
          selector = `:text("${match[1]}")`
        } else {
          selector = `:text-is("${match[1]}")`
        }
      }
    } else if (locatorCode.includes("page.getByLabel('")) {
      const match = locatorCode.match(/getByLabel\('(.+?)'\)/)
      if (match) selector = `[aria-label="${match[1]}"]`
    } else if (locatorCode.includes("page.locator('#")) {
      const match = locatorCode.match(/locator\('#(.+?)'\)/)
      if (match) selector = `#${match[1]}`
    } else if (locatorCode.includes("page.locator('[name=")) {
      const match = locatorCode.match(/locator\('\[name="(.+?)"\]'\)/)
      if (match) selector = `[name="${match[1]}"]`
    } else if (locatorCode.includes("page.locator('.")) {
      const match = locatorCode.match(/locator\('\.(.+?)'\)/)
      if (match) selector = `.${match[1]}`
    } else if (locatorCode.includes("page.locator('")) {
      const match = locatorCode.match(/locator\('(.+?)'\)/)
      if (match) selector = match[1]
    }

    if (!selector) return { isUnique: false, count: 0 }

    const fullSelector = selector + options
    const count = await page.locator(fullSelector).count()

    return {
      isUnique: count === 1,
      count,
    }
  } catch {
    return { isUnique: false, count: 0 }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const url = args[0] || 'https://example.com'

  console.log('\n🔧 AutoQA 元素选择器')
  console.log('═'.repeat(50))
  console.log(`目标页面: ${url}`)
  console.log('')

  // 启动浏览器
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  })

  const page = await context.newPage()

  // 导航到目标页面
  console.log('⏳ 正在加载页面...')
  await page.goto(url, { waitUntil: 'networkidle' })
  console.log('✅ 页面加载完成\n')

  // 注入元素选择器
  await injectElementPicker(page)

  console.log('🎯 元素选择模式已启用!')
  console.log('   - 将鼠标悬停在元素上查看高亮')
  console.log('   - 点击任意元素生成 locator')
  console.log('   - 按 Ctrl+C 退出\n')

  // 监听元素选择事件
  ;(page as any).on('autoqa:element-selected', async (elementInfo: any) => {
    console.clear()
    console.log('═════════════════════════════════════════════════════')
    console.log('📌 选中的元素:')
    console.log('═════════════════════════════════════════════════════')
    console.log(`  Tag:        ${elementInfo.tagName}`)
    if (elementInfo.id) console.log(`  ID:         ${elementInfo.id}`)
    if (elementInfo.className) console.log(`  Class:      ${elementInfo.className}`)
    if (elementInfo.role) console.log(`  Role:       ${elementInfo.role}`)
    if (elementInfo.text) console.log(`  Text:       ${elementInfo.text}`)
    if (elementInfo.testId) console.log(`  Test ID:    ${elementInfo.testId}`)
    console.log('')

    // 生成 locator 候选
    const locators = generatePlaywrightLocator(elementInfo)

    console.log('═════════════════════════════════════════════════════')
    console.log('🎯 生成的 Locator (按优先级排序):')
    console.log('═════════════════════════════════════════════════════')

    let bestLocator: string | null = null
    let bestUnique = false

    for (let i = 0; i < locators.length; i++) {
      const locator = locators[i]
      const { isUnique, count } = await validateLocator(page, locator)

      const status = isUnique ? '✅' : '⚠️ '
      const countText = isUnique ? '唯一' : `${count} 个匹配`

      console.log(`  ${i + 1}. ${status} ${locator}`)
      console.log(`       (${countText})`)

      if (!bestLocator) {
        bestLocator = locator
        bestUnique = isUnique
      }
    }

    console.log('')
    console.log('═════════════════════════════════════════════════════')
    console.log('💡 推荐:')
    console.log('═════════════════════════════════════════════════════')

    if (bestLocator) {
      const status = bestUnique ? '✅ 唯一' : '⚠️  可能不唯一'
      console.log(`  ${status} ${bestLocator}`)
      console.log('')
      console.log('💾 复制上述 locator 到剪贴板，或继续点击其他元素')
    }

    console.log('   按 Ctrl+C 退出\n')
  })

  // 保持浏览器打开
  await new Promise(() => {})
}

// 启动
main().catch(console.error)
