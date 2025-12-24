# Tech Spec: 基于 IR 直接生成 Playwright Test 代码

Status: draft

## Goals

- 以 IR 的 `toolName` 为**单一真相源**生成测试代码，消除当前导出逻辑中的类型不匹配问题
- 消除对文本解析的依赖（`parseClickStep`、`parseSelectStep` 等），文本解析仅用于模板变量提取
- 确保生成的代码类型安全（不会出现 `getByText().selectOption()` 这种非法代码）

## Non-goals

- 不改变 IR Schema（复用现有 `ActionRecord` 结构）
- 不改变 IR 记录方式（继续使用 `irRecorder.recordAction`）
- 不删除旧的 `export-playwright-test.ts`（保留为 `export-playwright-test-legacy.ts`）

## Problem Statement

当前 `export-playwright-test.ts` 存在设计问题：

1. **文本解析作为主要手段**：使用 `parseSelectStep` 等函数解析 spec 文本，决定操作类型
2. **IR 作为补充**：只在需要定位器时才使用 IR
3. **类型不匹配**：当 spec 文本被误解析（如 "选择 '活动营销' 从 菜单"）但 IR 的 `toolName` 是 `'click'` 时，会生成非法代码：
   ```typescript
   await page.getByText('活动营销', { exact: true }).selectOption()  // ❌ 非法
   ```

## Proposed Solution

### 核心原则

**以 IR 的 `toolName` 分发代码生成逻辑**，而不是解析文本。

### 新的代码生成流程

```
1. 通过 stepIndex 找到对应的 ActionRecord
2. 读取 record.toolName
3. 根据 toolName 分发到对应的生成函数
4. 从 record 中提取所需信息（locator、url、label 等）
5. 生成代码
```

### 代码结构

新文件：`src/runner/export-from-ir.ts`

```typescript
// 主入口：按 toolName 分发
function generateStepCode(
  step: MarkdownSpecStep,
  records: ActionRecord[],
  baseUrl: string,
  loginBaseUrl: string | undefined,
  stepVarInfo?: StepVarInfo,
): CodeResult {
  const record = records.find((r) => r.stepIndex === step.index && r.outcome.ok)
  if (!record) {
    return { code: `  // TODO: Step ${step.index} - No IR record` }
  }

  // 以 toolName 为单一真相源
  switch (record.toolName) {
    case 'navigate':      return generateNavigateCode(record, baseUrl, loginBaseUrl, stepVarInfo)
    case 'click':         return generateClickCode(record)
    case 'fill':          return generateFillCode(record, stepVarInfo)
    case 'select_option': return generateSelectCode(record)
    case 'assertTextPresent':    return generateAssertTextCode(record, stepVarInfo)
    case 'assertElementVisible': return generateAssertElementCode(record)
    default: return { code: `  // TODO: Unsupported tool: ${record.toolName}` }
  }
}
```

### 各工具的生成函数

| toolName | 生成函数 | 数据来源 |
|----------|----------|----------|
| `navigate` | `generateNavigateCode` | `record.toolInput.url` |
| `click` | `generateClickCode` | `record.element.chosenLocator.code` |
| `fill` | `generateFillCode` | `record.element.chosenLocator.code` + `record.toolInput.fillValue` |
| `select_option` | `generateSelectCode` | `record.element.chosenLocator.code` + `record.toolInput.label` |
| `assertTextPresent` | `generateAssertTextCode` | `record.toolInput.text` |
| `assertElementVisible` | `generateAssertElementCode` | `record.element.chosenLocator.code` |

## IR 补充：navigate 记录

当前 `navigate` 工具没有记录 IR，需要补充。

### 修改文件

`src/agent/browser-tools-mcp.ts`（约第 422 行后）

```diff
logToolResult('navigate', startTime, result as any, stepIndex, { ...meta, snapshot: snapshotMeta })

+ // Record navigate IR
+ if (result.ok && irRecorder.isEnabled()) {
+   await irRecorder.recordAction(
+     {
+       page: options.page,
+       toolName: 'navigate' as IRToolName,
+       toolInput: { url },
+       stepIndex,
+     },
+     { ok: true },
+     null, // navigate doesn't need element locator
+   )
+ }

const content: ContentBlock[] = []
```

## 模板变量处理

文本解析仍然保留，但**仅用于提取 `{{VAR}}` 模板变量**：

```typescript
// 解析原始 spec 文本，提取 {{VAR}} 占位符
const rawSpecContent = await fs.readFile(specPath, 'utf-8')
const { stepVars } = parseRawSpecVars(rawSpecContent)

// 导出时使用
const stepVarInfo = stepVars.get(step.index)
if (stepVarInfo?.vars.includes('USERNAME')) {
  // 生成: const username = getEnvVar('AUTOQA_USERNAME')
  // 生成: await locator.fill(username)
}
```

## Migration Plan

### Phase 1: 创建新实现

- 创建 `src/runner/export-from-ir.ts`
- 实现基于 `toolName` 分发的代码生成逻辑

### Phase 2: 补充 IR 记录

- 在 `browser-tools-mcp.ts` 为 `navigate` 添加 IR 记录

### Phase 3: 测试对比

- 对比新旧实现的导出结果
- 验证修复了原有的 bug（如 `getByText().selectOption()`）

### Phase 4: 切换

1. 将 `export-playwright-test.ts` 重命名为 `export-playwright-test-legacy.ts`
2. 将 `export-from-ir.ts` 重命名为 `export-playwright-test.ts`
3. 更新所有 import 引用

## Key Files

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agent/browser-tools-mcp.ts` | 修改 | 为 navigate 工具添加 IR 记录 |
| `src/runner/export-from-ir.ts` | 新建 | 新实现：基于 IR 直接生成 |
| `src/runner/export-playwright-test.ts` | → legacy | 测试后重命名，保留 |

## Design Benefits

1. **类型安全**：`toolName` 直接决定生成的代码类型，不会产生类型不匹配的代码
2. **单一真相源**：IR 是唯一的数据来源，代码生成逻辑更清晰
3. **易于维护**：每种工具类型有独立的生成函数，职责明确
4. **向后兼容**：旧文件保留，不影响现有功能

## References

- [Source: docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md]
- [Source: docs/sprint-artifacts/4-2-auto-export-playwright-test.md]
