# AutoQA 元素选择器

基于 Playwright 的交互式元素选择器，用于修复失败测试的 locator。

## 功能

- ✅ 启动 Playwright 浏览器
- ✅ 实时高亮悬停元素
- ✅ 点击元素生成 Playwright locator
- ✅ 验证 locator 唯一性
- ✅ 按优先级排序候选 locator

## 运行

```bash
# 方式 1: 直接运行 tsx
npx tsx examples/repair-dashboard/playwright-picker.ts https://example.com

# 方式 2: 先构建再运行
npm run build
node examples/repair-dashboard/playwright-picker.ts https://example.com

# 默认使用 example.com
node examples/repair-dashboard/playwright-picker.ts
```

## 使用示例

```
$ npx tsx examples/repair-dashboard/playwright-picker.ts https://github.com

🔧 AutoQA 元素选择器
════════════════════════════════════════════════════
目标页面: https://github.com

⏳ 正在加载页面...
✅ 页面加载完成

🎯 元素选择模式已启用!
   - 将鼠标悬停在元素上查看高亮
   - 点击任意元素生成 locator
   - 按 Ctrl+C 退出
```

## 点击元素后的输出

```
═════════════════════════════════════════════════════
📌 选中的元素:
═════════════════════════════════════════════════════
  Tag:        button
  Class:      btn-primary
  Text:       Sign up

═════════════════════════════════════════════════════
🎯 生成的 Locator (按优先级排序):
═════════════════════════════════════════════════════
  1. ⚠️  page.getByText('Sign up', { exact: true })
       (3 个匹配)
  2. ⚠️  page.getByText('Sign up')
       (3 个匹配)
  3. ⚠️  page.locator('.btn-primary')
       (5 个匹配)
  4. ⚠️  page.locator('button')
       (15 个匹配)

═════════════════════════════════════════════════════
💡 推荐:
═════════════════════════════════════════════════════
  ⚠️  page.getByText('Sign up', { exact: true })

💾 复制上述 locator 到剪贴板，或继续点击其他元素
   按 Ctrl+C 退出
```

## Locator 优先级

| 优先级 | 策略 | 示例 |
|--------|------|------|
| 100 | data-testid | `page.getByTestId('submit-btn')` |
| 95 | data-test | `page.getByTestId('submit')` |
| 90 | data-cy | `page.getByTestId('cy-submit')` |
| 80 | ID | `page.locator('#submit')` |
| 70 | Role + Name | `page.getByRole('button', { name: 'Submit' })` |
| 60 | Placeholder | `page.getByPlaceholder('Enter email')` |
| 50 | Exact Text | `page.getByText('Submit', { exact: true })` |
| 40 | Partial Text | `page.getByText('Sub')` |
| 30 | Name 属性 | `page.locator('[name="email"]')` |
| 20 | CSS Class | `page.locator('.btn')` |
| 10 | Tag Name | `page.locator('button')` |

## 与修复流程集成

```typescript
import { chromium } from 'playwright'
import { readline } from 'node:readline/promises'

// 1. 启动选择器
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()

// 2. 从 IR 读取失败的步骤信息
const failedStep = {
  stepIndex: 3,
  pageUrl: 'https://example.com/checkout',
  stepText: '点击"提交订单"按钮'
}

// 3. 导航到页面
await page.goto(failedStep.pageUrl)

// 4. 注入选择器脚本
await injectElementPicker(page)

// 5. 等待用户选择元素
const selectedLocator = await new Promise((resolve) => {
  page.on('autoqa:element-selected', (info) => {
    const locators = generatePlaywrightLocator(info)
    resolve(locators[0]) // 使用优先级最高的
  })
})

// 6. 保存修复
await saveRepair(failedStep.stepIndex, selectedLocator)
```
