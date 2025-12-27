# Epic 9: 交互式修复模式（Interactive Repair Mode）- Tech Spec

Status: draft

## Goals

- 当 `autoqa run` 导出失败时（缺少 `chosenLocator`），自动启动交互式修复模式。
- 通过 Playwright 重放 IR 到失败步骤，恢复页面状态。
- 提供元素选择器（Element Picker），让用户通过点击页面元素生成 Playwright locator。
- 支持用户手动继续操作，记录到 IR 并导出。
- 保存修复结果到 `repairs.json`，支持重新导出。
- 提供 `autoqa repair` 命令，支持离线修复。

## Non-goals

- 不修复 Agent 执行阶段的失败（仅修复导出阶段失败）。
- 不提供完整的 Web UI（交互通过终端 + Playwright 浏览器）。
- 不自动修复 locator（需要用户确认）。

## User-facing Behavior

### 自动修复模式触发

```bash
$ autoqa run specs/login.spec.md --url https://example.com

# ... Agent 执行过程 ...

✅ Agent 执行完成 (6/6 steps passed)
⚠️  导出失败: 2 个步骤缺少有效的 chosenLocator

  - Step 3: click "登录按钮" (缺少 locator)
  - Step 5: fill "验证码输入框" (缺少 locator)

是否启动交互式修复模式？[Y/n]
```

### 修复模式交互

```bash
$ autoqa repair --runId abc123 --spec login.spec.md

🔧 交互式修复模式
════════════════════════════════════════════════════

正在重放步骤到失败点...
  ✅ Step 1: navigate
  ✅ Step 2: fill username
  ✅ Step 3: fill password
  ⏸️  Step 4: click login (需要修复)

当前页面: https://example.com/login

选项:
  [1] 启动元素选择器 - 在页面上点击目标元素
  [2] 手动继续 - 自己在浏览器中操作
  [3] 跳过此步骤
  [q] 退出修复模式

请选择: _
```

### 元素选择器

```bash
$ autoqa repair --runId abc123 --spec login.spec.md

🎯 元素选择模式已启用
════════════════════════════════════════════════════

将鼠标悬停在元素上查看高亮，点击任意元素生成 locator

[浏览器已打开，显示目标页面]

# 用户点击某个按钮后...

═════════════════════════════════════════════════════
📌 选中的元素:
═════════════════════════════════════════════════════
  Tag:        button
  ID:         submit-btn
  Class:      btn-primary
  Text:       登录
  Role:       button

═════════════════════════════════════════════════════
🎯 生成的 Locator (按优先级排序):
═════════════════════════════════════════════════════
  1. ✅ page.locator('#submit-btn')
     (唯一)

  2. ✅ page.getByRole('button', { name: '登录' })
     (唯一)

  3. ⚠️  page.getByText('登录')
     (3 个匹配)

═════════════════════════════════════════════════════
💡 推荐: page.locator('#submit-btn')
═════════════════════════════════════════════════════

使用此 locator? [Y/n] 或输入序号: _
```

## Architecture

### 组件结构

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI 入口层                              │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │  autoqa run     │  │  autoqa repair   │                   │
│  │  (导出失败触发)  │  │  (手动启动)      │                   │
│  └────────┬─────────┘  └────────┬─────────┘                   │
└───────────┼────────────────────┼──────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RepairCoordinator                          │
│  - 检测导出失败                                               │
│  - 读取 IR 和失败步骤                                         │
│  - 编排修复流程                                               │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   IRReplayer (重放器)                          │
│  - 重放成功的步骤到失败点                                     │
│  - 使用 IR 中的 chosenLocator                                │
│  - 处理重放失败                                             │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                ElementPicker (元素选择器)                      │
│  - 注入选择脚本到页面                                        │
│  - 监听鼠标悬停和点击                                        │
│  - 生成 Playwright locator 候选                              │
│  - 验证唯一性                                                │
└───────────┬─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RepairStorage (修复存储)                       │
│  - 保存到 repairs.json                                        │
│  - 加载已有修复                                              │
│  - 合并到导出流程                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
.autoqa/
├── runs/
│   └── <runId>/
│       ├── ir.jsonl              # 原始 IR 记录
│       ├── repairs.json          # 修复记录 (新增)
│       └── screenshots/          # 失败截图
└── repairs/                     # 跨 run 修复历史 (可选)
    └── <runId>.repairs.json

examples/
└── repair-dashboard/
    ├── playwright-picker.ts     # 元素选择器实现
    └── README.md
```

## IR Schema Updates

### repairs.json 结构

```typescript
interface RepairRecord {
  runId: string
  specPath: string
  stepIndex: number
  stepText: string
  timestamp: number
  chosenLocator: LocatorCandidate
  repairedAt: string  // ISO timestamp
  userConfirmed: boolean
}

interface RepairFile {
  runId: string
  createdAt: string
  updatedAt: string
  repairs: RepairRecord[]
}
```

### 增强的 ActionRecord（可选扩展）

```typescript
interface ActionRecord {
  // ... 现有字段

  // 新增：用于修复的元数据
  repairMetadata?: {
    failedAtExport: boolean
    repairRecord?: {
      chosenLocator: LocatorCandidate
      source: 'user_picker' | 'user_manual' | 'manual_entry'
      repairedAt: string
    }
  }
}
```

## IRReplayer (重放器)

### 重放逻辑

```typescript
class IRReplayer {
  async replayToStep(
    page: Page,
    records: ActionRecord[],
    targetStep: number
  ): Promise<ReplayResult>

  interface ReplayResult {
    success: boolean
    replayedCount: number
    failedAtStep?: number
    error?: string
    canContinueManually: boolean
  }
}
```

### 重放规则

| 条件 | 行为 |
|------|------|
| 步骤有 `chosenLocator` | 使用 locator 重放 |
| 步骤是 `navigate` | 使用 IR 中的 url 重放 |
| 步骤是 `wait` | 使用 IR 中的 seconds 重放 |
| 步骤缺少 `chosenLocator` 且 < targetStep | 尝试自动重放，失败则停止 |
| 步骤缺少 `chosenLocator` 且 >= targetStep | 停止，这是需要修复的步骤 |

### 重放失败处理

```typescript
// 场景 1: 前面步骤重放失败
if (replayResult.failedAtStep < targetStep) {
  console.log(`⚠️  重放失败于 Step ${replayResult.failedAtStep}`)
  console.log(`   原因: ${replayResult.error}`)
  console.log(`   建议: 手动操作到目标状态后继续`)
}

// 场景 2: 第一个步骤就缺少 locator
if (firstRecordMissingLocator === 0) {
  console.log(`⚠️  从第一个步骤就缺少 locator`)
  console.log(`   尝试使用 pageUrl 导航: ${records[0].pageUrl}`)
  await page.goto(records[0].pageUrl)
  console.log(`   请手动登录/准备状态后继续`)
}
```

## ElementPicker (元素选择器)

### 注入脚本

```typescript
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
      const info = analyzeElement(target)

      // 发送到控制台
      console.log('__AUTOQA_SELECTED__:' + JSON.stringify(info))
    }, true)
  })
}
```

### Locator 生成优先级

| 优先级 | 来源 | 示例 |
|--------|------|------|
| 100 | data-testid | `page.getByTestId('submit-btn')` |
| 95 | data-test | `page.getByTestId('submit')` |
| 90 | data-cy | `page.getByTestId('cy-submit')` |
| 80 | ID | `page.locator('#submit')` |
| 70 | Role + Name | `page.getByRole('button', { name: 'Submit' })` |
| 60 | Placeholder | `page.getByPlaceholder('Email')` |
| 50 | Exact Text | `page.getByText('Submit', { exact: true })` |
| 40 | Partial Text | `page.getByText('Sub')` |
| 30 | ARIA Label | `page.getByLabel('Email')` |
| 20 | Name 属性 | `page.locator('[name="email"]')` |
| 10 | CSS Class | `page.locator('.btn')` |
| 5 | Tag | `page.locator('button')` |

### 唯一性验证

```typescript
async function validateLocator(
  page: Page,
  locatorCode: string
): Promise<{ isUnique: boolean; count: number }> {
  // 从 locatorCode 提取 selector
  const selector = extractSelector(locatorCode)

  try {
    const count = await page.locator(selector).count()
    return {
      isUnique: count === 1,
      count,
    }
  } catch {
    return { isUnique: false, count: 0 }
  }
}
```

## RepairStorage (修复存储)

### 保存修复

```typescript
class RepairStorage {
  async saveRepair(
    runId: string,
    specPath: string,
    stepIndex: number,
    chosenLocator: LocatorCandidate
  ): Promise<void>

  async loadRepairs(runId: string): Promise<RepairFile>

  async getRepair(
    runId: string,
    specPath: string,
    stepIndex: number
  ): Promise<RepairRecord | null>
}
```

### 文件格式

```json
{
  "runId": "abc123",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T11:00:00Z",
  "repairs": [
    {
      "runId": "abc123",
      "specPath": "specs/login.spec.md",
      "stepIndex": 3,
      "stepText": "点击登录按钮",
      "timestamp": 1736944200000,
      "chosenLocator": {
        "kind": "cssId",
        "value": "submit-btn",
        "code": "page.locator('#submit-btn')",
        "validation": {
          "unique": true,
          "visible": true,
          "enabled": true
        }
      },
      "repairedAt": "2025-01-15T11:00:00Z",
      "userConfirmed": true
    }
  ]
}
```

## 导出流程集成

### 修改后的导出逻辑

```typescript
// export-from-ir.ts

async function exportFromIR(options: ExportOptions): Promise<ExportResult> {
  const { cwd, runId, specPath, spec } = options

  // 1. 读取 IR
  const records = await getSpecActionRecords(cwd, runId, specPath)

  // 2. 读取 repairs
  const repairs = await loadRepairsForSpec(cwd, runId, specPath)

  // 3. 合并 repairs 到 records
  const repairedRecords = applyRepairs(records, repairs)

  // 4. 检查是否还有缺失的 locator
  const missingLocatorActions = getMissingLocatorActions(repairedRecords)

  if (missingLocatorActions.length > 0) {
    // 进入修复模式
    return {
      ok: false,
      reason: `Export failed: ${missingLocatorActions.length} action(s) missing valid chosenLocator`,
      missingLocators: missingLocatorActions.map(r => ({
        stepIndex: r.stepIndex,
        toolName: r.toolName
      })),
      suggestRepairMode: true  // 新增字段
    }
  }

  // 5. 生成导出代码
  const content = generateTestFileContent(spec, repairedRecords)

  // 6. 写入文件
  await writeFile(exportPath, content, 'utf-8')

  return { ok: true, exportPath }
}
```

### 应用修复

```typescript
function applyRepairs(
  records: ActionRecord[],
  repairs: RepairRecord[]
): ActionRecord[] {
  const repairMap = new Map(
    repairs.map(r => [r.stepIndex, r.chosenLocator])
  )

  return records.map(record => {
    if (record.stepIndex === null) return record

    const repair = repairMap.get(record.stepIndex)
    if (repair && record.element) {
      return {
        ...record,
        element: {
          ...record.element,
          chosenLocator: repair
        }
      }
    }
    return record
  })
}
```

## CLI 命令

### autoqa repair

```bash
# 修复所有失败的 spec
$ autoqa repair --runId abc123

# 修复特定 spec
$ autoqa repair --runId abc123 --spec specs/login.spec.md

# 修复特定步骤
$ autoqa repair --runId abc123 --spec specs/login.spec.md --step 3

# 跳过重放，直接从 pageUrl 开始
$ autoqa repair --runId abc123 --no-replay

# 手动模式（不启用元素选择器）
$ autoqa repair --runId abc123 --manual
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--runId` | 运行 ID | 必需 |
| `--spec` | 指定 spec 路径 | 所有失败的 spec |
| `--step` | 指定步骤索引 | 所有失败的步骤 |
| `--no-replay` | 跳过重放，直接导航 | false |
| `--manual` | 手动模式，不启用选择器 | false |

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 修复成功，导出成功 |
| 1 | 修复失败或导出失败 |
| 2 | 参数错误或配置错误 |

## Error Handling

### 场景 1: 重放失败

```
⚠️  重放失败于 Step 2

原因: locator失效: page.locator('#username') 找到 0 个元素

选项:
  [1] 手动操作到目标状态后继续
  [2] 使用 pageUrl 直接导航
  [3] 退出修复模式

请选择: _
```

### 场景 2: 元素选择器无结果

```
⚠️  未找到可用的 locator

所有候选均不唯一:
  - page.getByText('登录') - 3 个匹配
  - page.locator('.btn') - 5 个匹配

选项:
  [1] 手动输入 selector
  [2] 跳过此步骤
  [3] 退出修复模式

请选择: _
```

### 场景 3: 用户中断

```
用户按 Ctrl+C 退出

📝 修复进度已保存
   已修复: 2/3 步骤
   修复文件: .autoqa/runs/abc123/repairs.json

提示: 运行 `autoqa repair --runId abc123` 继续修复
```

## Security Notes

- 修复模式中的敏感输入（如密码）应使用模板变量占位符
- `repairs.json` 不包含敏感数据
- 手动模式下填写的表单字段需要用户确认是否记录

## References

- [Source: docs/epics.md#Epic 9]
- [Source: docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md]
- [Related: Visual-Replay-Tester](https://github.com/auenger/Visual-Replay-Tester)
