# Story 3.1: 实现断言工具（`assertTextPresent` / `assertElementVisible`）

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA 工程师,
I want 通过断言工具表达“页面应该包含某段文本 / 某个元素应该可见”，
so that 系统可以自动判定验收是否通过，并在失败时把错误回流给 Agent 触发自愈重试闭环。

## Acceptance Criteria

1. **Given** Agent 调用 `assertTextPresent(text)`
   **When** 页面包含目标文本
   **Then** 断言应返回 `ok: true`
   **And** ToolResult 必须可序列化、字段满足项目 ToolResult 契约

2. **Given** Agent 调用 `assertTextPresent(text)`
   **When** 页面不包含目标文本
   **Then** 断言应返回 `ok: false`
   **And** 必须带有可机器处理的 `error.code`（建议使用 `ASSERTION_FAILED`）

3. **Given** Agent 调用 `assertElementVisible(description)`
   **When** 页面存在并可见目标元素
   **Then** 断言应返回 `ok: true`

4. **Given** Agent 调用 `assertElementVisible(description)`
   **When** 元素不存在或不可见
   **Then** 断言应返回 `ok: false`
   **And** 必须带有可机器处理的 `error.code`（建议使用 `ASSERTION_FAILED`）
   **And** `error.retriable` 应设置为 `true`（允许模型通过等待/重新定位/替代路径自愈；护栏由后续 story 统一约束）

5. **Given** 断言工具内部调用 Playwright API（例如 `locator.count()`/`locator.isVisible()`）
   **When** Playwright 抛出异常（含 Timeout）
   **Then** 工具不得 `throw` 终止进程
   **And** 必须返回 `{ ok: false, error: { code, message, retriable } }`

6. **Given** 断言工具已实现
   **When** Agent 通过 MCP 工具面调用断言（toolName：`assertTextPresent` / `assertElementVisible`）
   **Then** MCP 层必须把失败映射为 `isError: true`（使 SDK 进入下一轮推理）
   **And** `run-agent.ts` 的 `allowedTools` 与 prompt 工具列表必须包含上述断言工具

7. **Given** 实现完成
   **When** 执行 `npm test`
   **Then** 必须新增单元测试覆盖：成功/失败、错误码、以及“工具不抛异常”的行为

## Tasks / Subtasks

- [x] 扩展错误码（AC: 2, 4, 5）
  - [x] 在 `src/tools/playwright-error.ts` 的 `ToolErrorCode` union 中加入 `ASSERTION_FAILED`
  - [x] 明确 `ASSERTION_FAILED` 的 `retriable` 语义（建议 `true`）

- [x] 实现断言工具（Tools 层）（AC: 1-5）
  - [x] 新增 `src/tools/assertions/assert-text-present.ts`
    - [x] 输入：`{ page, text }`
    - [x] 成功：返回 `{ ok: true, data: { textLength } }`（避免回传超长文本）
    - [x] 失败：返回 `{ ok: false, error: { code: 'ASSERTION_FAILED', message, retriable: true } }`
  - [x] 新增 `src/tools/assertions/assert-element-visible.ts`
    - [x] 输入：`{ page, targetDescription }`（语义描述定位）
    - [x] 复用/对齐 `src/tools/click.ts` 的语义定位策略（role/text/fuzzy/attribute selectors + pickFirstMatch），但不得产生点击副作用
    - [x] 失败同样返回 `ASSERTION_FAILED`（retriable: true）
  - [x] 更新 `src/tools/index.ts` 导出断言工具与类型

- [x] MCP 集成（Agent 层）（AC: 6）
  - [x] 在 `src/agent/browser-tools-mcp.ts` 注册 MCP tools：`assertTextPresent` / `assertElementVisible`
    - [x] 复用现有 `logToolCall` / `logToolResult` 事件结构
    - [x] 复用 `runWithPreActionScreenshot(...)` 的 wrapper（保持与其他 tools 一致的截图/产物策略；由 `AUTOQA_TOOL_CONTEXT` 控制成本）
    - [x] 返回 content 时保持 token 友好（沿用 `summarizeToolResult(...)`，避免返回大段 page 文本/stack）
    - [x] 对失败结果设置 `isError: true`
    - [x] （可选但推荐）支持 `ref`：
      - schema 增加 `ref?: string`（与 click/fill 保持一致）
      - ref 存在时使用 `resolveRefLocator(ref)` 做可见性断言
  - [x] 更新 `src/agent/run-agent.ts`
    - [x] prompt 中 "Use ONLY the provided browser tools (...)" 列表加入断言工具
    - [x] `allowedTools` 加入：`mcp__browser__assertTextPresent`、`mcp__browser__assertElementVisible`

- [x] 单元测试（AC: 7）
  - [x] 新增 `tests/unit/tools-assertion-tools.test.ts`（或并入既有 `tools-action-tools.test.ts`）
    - [x] `assertTextPresent`：文本存在 → ok=true；不存在 → ok=false + ASSERTION_FAILED
    - [x] `assertElementVisible`：元素可见 → ok=true；不存在/不可见 → ok=false + ASSERTION_FAILED
    - [x] timeout → code=TIMEOUT（由 `toToolError` 映射），且不 throw
  - [x] （可选）增加最小回归测试，确保 `run-agent.ts` 的 `allowedTools` 包含断言 toolName（避免集成遗漏）

## Dev Notes

- 分层边界（强约束）：
  - 断言的 Playwright 封装必须放在 `src/tools/**`（建议 `src/tools/assertions/**`）
  - MCP tool 注册与“isError 语义”映射必须放在 `src/agent/**`
  - `src/cli/**` 与 `src/runner/**` 禁止直接调用 Playwright API

- ToolResult / 错误模型（一致性关键点）：
  - 断言失败不得 `throw`；必须返回 `ToolResult` 失败分支
  - `error.code` 必须稳定、可机器处理（本 story 推荐新增 `ASSERTION_FAILED`）
  - 断言失败建议 `retriable: true`，以便后续 story（3.2/3.3）统一实现自愈与护栏

- 语义定位（避免重复造轮子）：
  - `assertElementVisible` 不要重新发明一套定位器；优先复用 `src/tools/click.ts` 已实现的“语义描述 → Locator”策略（role/text/fuzzy/属性选择器 + pickFirstMatch）
  - 如果需要抽取公共逻辑，优先新增 `src/tools/locator-heuristics.ts` 并让 `click`/`assertElementVisible` 共用（避免复制粘贴漂移）

- Token/隐私与可观测性：
  - 断言工具的 `data` 应保持短小（建议只返回 `textLength`、`targetDescription` 等摘要信息）
  - MCP 返回内容沿用 `summarizeToolResult(...)`，避免把完整 stack 或大段文本塞回模型
  - 日志字段由 `browser-tools-mcp.ts` 统一输出（`autoqa.tool.called` / `autoqa.tool.result`），`redactToolInput(...)` 会截断过长字符串

### Project Structure Notes

- 预计新增：
  - `src/tools/assertions/assert-text-present.ts`
  - `src/tools/assertions/assert-element-visible.ts`
  - `tests/unit/tools-assertion-tools.test.ts`

- 预计修改：
  - `src/tools/index.ts`
  - `src/tools/playwright-error.ts`（新增 `ASSERTION_FAILED`）
  - `src/agent/browser-tools-mcp.ts`（注册 MCP tools）
  - `src/agent/run-agent.ts`（允许工具 + prompt 列表）

### References

- [Source: docs/epics.md#Story 3.1]
- [Source: docs/architecture.md#Format Patterns（数据契约/返回格式）]
- [Source: docs/architecture.md#Structure Patterns（结构与边界规范）]
- [Source: docs/project_context.md#4. ToolResult / 错误处理契约]
- [Source: src/tools/tool-result.ts]
- [Source: src/tools/click.ts]
- [Source: src/agent/browser-tools-mcp.ts]
- [Source: src/agent/run-agent.ts]

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

- `npm test`
- `npm run build`

### Completion Notes List

- ✅ 实现了 `assertTextPresent` 和 `assertElementVisible` 两个断言工具
- ✅ 新增 `ASSERTION_FAILED` 错误码，`retriable: true`
- ✅ 断言工具复用了 `click.ts` 的语义定位策略（role/text/fuzzy/attribute selectors）
- ✅ MCP 层正确映射失败为 `isError: true`
- ✅ `assertElementVisible` 支持 `ref` 参数用于基于快照的元素定位
- ✅ 所有断言工具测试通过（14 个测试用例）
- ✅ 构建成功，无类型错误

### Change Log

- 2025-12-17: 实现 Story 3.1 - 断言工具 (assertTextPresent / assertElementVisible)

### File List

- `docs/sprint-artifacts/3-1-assert-tools-asserttextpresent-assertelementvisible.md`
- `src/tools/playwright-error.ts` (修改: 新增 ASSERTION_FAILED 错误码)
- `src/tools/assertions/assert-text-present.ts` (新增)
- `src/tools/assertions/assert-element-visible.ts` (新增)
- `src/tools/assertions/index.ts` (新增)
- `src/tools/index.ts` (修改: 导出断言工具)
- `src/agent/browser-tools-mcp.ts` (修改: 注册 MCP 断言工具)
- `src/agent/run-agent.ts` (修改: allowedTools 和 prompt 更新)
- `tests/unit/tools-assertion-tools.test.ts` (新增: 14 个测试用例)

### Code Review Notes

- Review Date: 2025-12-17

#### Findings (Actionable)

- **[High] Debug 日志可能泄露敏感信息（text/描述/ref）**
  - **Evidence**
    - `src/agent/browser-tools-mcp.ts`：`writeDebug(... text=${text})`（约 609 行）
    - `src/agent/browser-tools-mcp.ts`：`writeDebug(... target=${targetDescription} ... ref=${ref})`（约 659 行）
  - **Risk**
    - 断言入参可能包含验证码、邮箱、token、业务数据等；debug 日志会原样落盘/输出。
  - **Recommendation**
    - 在 debug 日志中对 `text/targetDescription/ref` 做截断或脱敏（例如仅记录长度、hash、或使用统一的 redact helper）。

- **[High] MCP schema 允许 `targetDescription`/`ref` 同时缺失，导致行为不明确**
  - **Evidence**
    - `src/agent/browser-tools-mcp.ts`：`targetDescription: z.string().optional(), ref: z.string().optional()`（约 649-651 行）
    - 当 `ref` 为空时仍会调用 `assertElementVisible({ ..., targetDescription: '' })`（约 704 行），Tools 层返回 `INVALID_INPUT`。
  - **Risk**
    - Agent 调用时很容易传空参数，产生不可预期的失败类型（与“断言失败”语义混淆）。
  - **Recommendation**
    - 使用 zod 做“二选一”校验（`ref` 与 `targetDescription` 至少提供一个），或在 MCP handler 内显式返回更清晰的 `INVALID_INPUT` 错误信息。

- **[High] `assertElementVisible` 的 `ref` 分支返回数据结构与 Tools 层类型不一致**
  - **Evidence**
    - Tools 层：`AssertElementVisibleData` 仅包含 `{ targetDescription }`（`src/tools/assertions/assert-element-visible.ts`：约 12-14 行）
    - MCP ref 分支：`return { ok: true, data: { ref, targetDescription } }`（`src/agent/browser-tools-mcp.ts`：约 688-690 行）
  - **Risk**
    - 数据契约漂移，后续如果有统一的 `summarizeToolResult`/类型收敛/遥测上报，可能出现字段不一致。
  - **Recommendation**
    - 统一 data 契约：
      - 要么扩展 Tools 层 data 类型为 `{ targetDescription: string; ref?: string }`
      - 要么 MCP 层始终返回 `{ targetDescription }`，将 `ref` 仅用于内部定位。

- **[Medium] `assertTextPresent` 通过 `body.innerText()` 全量拉取页面文本，可能性能差/不稳定**
  - **Evidence**
    - `src/tools/assertions/assert-text-present.ts`：`page.locator('body').innerText()` + `includes()`（约 50-52 行）
  - **Risk**
    - 大页面会有明显性能开销；`innerText()` 也可能受布局/异步渲染影响而波动。
  - **Recommendation**
    - 优先使用 Playwright 文本定位器进行断言（例如 `page.getByText(text).first().isVisible()` 或更可控的 locator），并为断言设置可控 timeout/范围（避免全页扫描）。

- **[Medium] `assertTextPresent` 的匹配策略大小写敏感且仅做 trim，可能导致误判**
  - **Evidence**
    - `src/tools/assertions/assert-text-present.ts`：`bodyText.includes(text)`（约 51 行）
  - **Risk**
    - 真实 UI 文案可能存在大小写/多空格/换行差异，造成“本应通过但失败”。
  - **Recommendation**
    - 明确匹配语义（严格/宽松），或提供可选参数（例如 `caseSensitive?: boolean`），至少在 message 中提示当前为严格匹配。

- **[Medium] Timeout 识别逻辑重复，存在漂移风险**
  - **Evidence**
    - `src/tools/assertions/assert-element-visible.ts`：自定义 `isTimeoutError`（约 77-83 行）
    - `src/tools/playwright-error.ts`：`toToolError(...)` 内部亦会识别 timeout
  - **Risk**
    - 两套逻辑未来不一致会导致行为差异（例如某些 timeout 被吞掉/被误判）。
  - **Recommendation**
    - 抽取共享 timeout helper（或从 `playwright-error.ts` 导出统一方法）并复用。

- **[Medium] `assertElementVisible` 的语义定位策略与 `click.ts` 未完全对齐，可能导致能力漂移**
  - **Evidence**
    - `src/tools/assertions/assert-element-visible.ts`：候选包含 attribute selectors / button/link/heading/getByText + fuzzy（约 107-149 行）
  - **Risk**
    - 未来 `click.ts` 的定位能力增强/修复后，断言工具未同步更新，导致“能点但不能断言可见”。
  - **Recommendation**
    - 抽取公共 locator heuristics（例如 `src/tools/locator-heuristics.ts`）并让 click/assert 共用。

- **[Low] `allowedTools` 集成测试通过读源码做字符串匹配，维护成本偏高**
  - **Evidence**
    - `tests/unit/tools-assertion-tools.test.ts`：读取 `run-agent.ts` 源码并 `toContain(...)`
  - **Risk**
    - 文件重构/格式化容易导致测试非功能性失败。
  - **Recommendation**
    - 若后续允许，考虑导出 `allowedTools` 常量供测试直接引用，或集中在一个清单文件中由测试验证。
