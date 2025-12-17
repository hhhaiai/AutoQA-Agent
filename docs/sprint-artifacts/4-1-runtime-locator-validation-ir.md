# Story 4.1: 运行时生成并验证 locator 候选，并写入动作 IR

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA 工程师,
I want 在 Agent 成功完成 click/fill 等动作后自动生成并验证稳定 locator 候选，并把结果记录到结构化动作 IR 中，
so that 后续可以稳定导出可维护的 Playwright 测试代码，而不是依赖一次性会话内的 `ref`。

## Acceptance Criteria

1. **Given** Agent 通过工具成功执行一次 `click(target_description)` 或 `fill(target_description, text)`
   **When** 工具返回 `ok: true`
   **Then** 系统必须为“实际命中的元素”生成多种稳定 locator 候选（优先 testId/role/label/placeholder/id 等稳定定位方式）
   **And** 对每个候选进行无副作用验证（不得点击/输入/提交；至少包含唯一性与可用性校验）
   **And** 仅将验证通过的候选写入动作 IR（按优先级排序；并可选产出 `chosenLocator`）。

2. **Given** 某个 locator 候选验证失败
   **When** 系统筛选候选池
   **Then** 该候选不得被写入 IR
   **And** 不得因此中断 spec 执行（仅记录验证失败摘要用于 debug）。

3. **Given** 任一动作被记录到 IR
   **When** spec 执行结束
   **Then** IR 产物应与本次 run 绑定（按 `runId` 归档到受控目录），并可用于后续导出与回放。

## Tasks / Subtasks

- [x] 定义 IR Schema 与序列化格式（AC: 1, 3）
  - [x] 按 tech spec 定义 `ActionRecord`（建议 JSONL：每条动作一行 JSON）
  - [x] 明确“命中具体元素”的动作（至少 `click/fill`）才写入 `element.fingerprint/locatorCandidates/chosenLocator`
  - [x] `toolInput` 必须可导出/可调试，同时遵守敏感信息策略（例如 `fill.text` 仅记录长度或标记）

- [x] IR 落盘与路径安全（AC: 3）
  - [x] IR 文件写入到 `.autoqa/runs/<runId>/ir.jsonl`（与现有产物根目录约定保持一致）
  - [x] `runId/specPath` 等用于拼接路径的输入必须 sanitize，避免目录穿越
  - [x] 产物路径对外输出（日志/错误）必须为受控相对路径（不得泄露绝对路径）

- [x] 在运行时生成 locator 候选（AC: 1）
  - [x] 从“实际命中元素”提取 `ElementFingerprint`（tagName/role/accessibleName/id/nameAttr/typeAttr/placeholder/ariaLabel/testId/textSnippet 等，截断大字段）
  - [x] 基于可观测的稳定属性生成 `LocatorCandidate`，并按优先级排序：
    - [x] `getByTestId`
    - [x] `getByRole` + `name`
    - [x] `getByLabel`
    - [x] `getByPlaceholder`
    - [x] `cssId`
    - [x] `cssAttr`
    - [x] `text`
  - [x] 候选生成不得依赖一次性会话内 `ref` 作为导出定位（`ref` 仅允许作为运行时执行/自愈信息）

- [x] No-side-effect 验证候选 locator（AC: 1, 2）
  - [x] 唯一性：`locator.count() === 1`
  - [x] 可用性：
    - [x] click：`visible` 且（若可判定）`enabled`
    - [x] fill：`visible` 且 `editable`
  - [x] 一致性：候选命中的元素需与 `ElementFingerprint` 匹配（允许定义合理容错规则）
  - [x] 仅将验证通过的候选写入 IR；验证失败候选仅保留摘要（不要污染导出输入）

- [x] 集成点与回归测试
  - [x] 在不破坏现有分层边界前提下，把 IR 记录接入工具调用链（优先在 Agent 层统一落点）
  - [x] 补齐单元测试覆盖：
    - [x] IR 写盘路径与 sanitize（不得出现绝对路径）
    - [x] `fill` 输入脱敏（不落盘明文）
    - [x] 候选验证失败不应导致工具/runner throw

## Dev Notes

- 现有实现与约束（避免重复造轮子 / 避免结构漂移）：
  - 产物根目录当前统一为 `.autoqa/runs/<runId>/...`（不要引入 `.autoqa/<runId>/...` 新结构）。[Source: docs/architecture.md#Data Architecture（数据与状态）]
  - 分层边界为强约束：CLI/Runner 禁止直接调用 Playwright；工具失败不得 throw，必须返回 ToolResult 并让 SDK 继续推理自愈。[Source: docs/project_context.md#2. 分层边界（强约束）][Source: docs/project_context.md#4. ToolResult / 错误处理契约（核心一致性点）]
  - `fill` 的输入脱敏已有既定策略：日志侧通过 `redactToolInput()` 把 `text` 转为 `textLength`；工具 data 也仅回传长度。[Source: src/logging/redact.ts][Source: src/tools/fill.ts]

- 实现提示（防踩坑）：
  - **点击后元素可能消失**：`click` 可能触发导航/重渲染，建议在执行 click 前就提取 fingerprint 并生成/验证候选；成功后再写入 IR。
  - **ref 与导出解耦**：当前 agent 采用 ref-first 执行（`snapshot` → 取 `[ref=e15]` → `click/fill(ref=...)`），但 `ref` 仅允许用于运行时执行/自愈，IR 中用于导出的 `chosenLocator` 必须是稳定 locator（如 testId/role/name 等）。
  - **无副作用验证**：验证阶段只允许 read-only 操作（`count/isVisible/isEnabled/isEditable` 等），禁止 click/fill/submit。

### Project Structure Notes

- 建议修改/新增落点（遵守分层边界）：
  - `src/agent/browser-tools-mcp.ts`：在 tool handler 侧记录 ActionRecord（拥有 `runId/specPath/stepIndex/toolInput/outcome/page` 等上下文）。
  - （建议新增）`src/ir/**`：IR 类型定义、写盘与 locator 候选生成/验证的纯函数（便于单测）。
  - `tests/unit/**`：新增 IR/locator 相关单元测试。

### References

- [Source: docs/epics.md#Story 4.1]
- [Source: docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md]
- [Source: docs/project_context.md#2. 分层边界（强约束）]
- [Source: docs/project_context.md#4. ToolResult / 错误处理契约（核心一致性点）]
- [Source: docs/architecture.md#Data Architecture（数据与状态）]
- [Source: src/agent/browser-tools-mcp.ts]
- [Source: src/tools/click.ts]
- [Source: src/tools/fill.ts]
- [Source: src/logging/redact.ts]

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

### Completion Notes List

- 实现了完整的 IR 模块 (`src/ir/`)，包含类型定义、fingerprint 提取、locator 候选生成、无副作用验证和 JSONL 写盘功能
- IR 记录已集成到 `browser-tools-mcp.ts` 的 click 和 fill 工具处理程序中
- 在执行动作前提取 fingerprint 并生成/验证候选（解决"点击后元素可能消失"问题）
- 仅在动作成功后将验证通过的候选写入 IR
- 验证失败不会导致工具/runner throw，仅记录摘要用于 debug
- `fill` 输入已脱敏（仅记录 textLength，不落盘明文）
- 路径安全：sanitize 防止目录穿越，对外输出仅使用相对路径
- 新增 5 个测试文件，共 86 个新测试用例，全部通过
- 全部 257 个测试通过，无回归

### File List

- docs/sprint-artifacts/4-1-runtime-locator-validation-ir.md (新增/更新)
- docs/sprint-artifacts/sprint-status.yaml (修改)
- src/agent/browser-tools-mcp.ts (修改)
- src/ir/types.ts (新增)
- src/ir/fingerprint.ts (新增)
- src/ir/locator-generator.ts (新增)
- src/ir/locator-validator.ts (新增)
- src/ir/writer.ts (新增)
- src/ir/recorder.ts (新增)
- src/ir/index.ts (新增)
- src/tools/click.ts (修改)
- src/tools/fill.ts (修改)
- tests/unit/ir-types.test.ts (新增)
- tests/unit/ir-fingerprint.test.ts (新增)
- tests/unit/ir-locator-generator.test.ts (新增)
- tests/unit/ir-writer.test.ts (新增)
- tests/unit/ir-recorder.test.ts (新增)

## Change Log

- 2025-12-17: 实现 Story 4.1 - 运行时生成并验证 locator 候选，并写入动作 IR
- 2025-12-17: Code review 完成并修复 HIGH/MED 问题（AC 补齐、验证门槛强化、路径与脱敏一致性改进）
- 2025-12-17: Senior Developer Review 完成并修复问题，审查通过

## Senior Developer Review (AI)

Date: 2025-12-17

Outcome: Approved

### Action Items

- [x] [HIGH] 补齐 targetDescription 路径的 IR 记录：click/fill 在非 ref 路径下也会在动作前提取 fingerprint 并生成/验证候选
- [x] [HIGH] 将 enabled/editable 纳入验证与过滤（click 需 enabled，fill 需 editable）
- [x] [MED] 收紧并规范化 runId 路径 sanitize（去除前导 '_'，提升可读性）
- [x] [MED] IR 脱敏逻辑复用 logging 的 redactToolInput，并保持 IR 更严格截断
- [x] [MED] 当前 story 文件在 git 状态为未跟踪（??），需要加入版本控制以保证审查记录可追溯

### Notes

- 全量构建与测试已通过：`npm run build`、`npm test`。
