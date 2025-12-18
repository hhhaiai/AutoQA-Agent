# Story 5.4: 敏感测试数据（账号/密码）从配置注入，避免写入 Markdown

Status: done

## Story

As a QA 工程师,
I want 将登录账号/密码等敏感测试数据放在环境配置中并在 spec 中通过占位符引用，
so that Markdown 用例可以提交到仓库且可在多环境复用，同时避免在日志/产物中泄漏敏感信息。

## Acceptance Criteria

1. **Given** `.env` 或 `.env.<env>`（例如 `.env.test`）中配置了登录凭据（例如 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD`）
   **When** spec 中包含 `{{USERNAME}}` / `{{PASSWORD}}` 占位符
   **Then** `autoqa run` 应在解析 Markdown spec 之前完成模板替换并可成功执行

2. **Given** spec 未使用 `{{USERNAME}}` / `{{PASSWORD}}` 占位符（仍使用字面量）
   **When** 运行 `autoqa run`
   **Then** 行为应保持兼容，不要求必须配置账号/密码环境变量

3. **Given** 执行过程中发生工具调用与 IR 记录
   **When** 调用 `fill`（输入框填充）
   **Then** 结构化日志与 IR 不应明文记录填充值（至少 password 不能出现），应保持现有脱敏策略或加强

4. **Given** 使用 `.env.example`/`.env.*.example` 模板
   **When** 用户按模板复制生成 `.env`/`.env.<env>`
   **Then** 可以清楚看到需要配置的 key（用户名/密码）及其用途

## Tasks / Subtasks

- [x] 扩展 spec 模板变量映射（AC: 1, 2）
  - [x] 在 `src/cli/commands/run.ts` 的 `renderMarkdownTemplate(..., vars)` 中增加：
    - [x] `USERNAME` → `process.env.AUTOQA_USERNAME`
    - [x] `PASSWORD` → `process.env.AUTOQA_PASSWORD`
  - [x] 保持变量命名分层：env 使用 `AUTOQA_*`，spec 使用 `{{...}}`
  - [x] 不引入新依赖（继续使用现有 `loadEnvFiles` 与 `renderMarkdownTemplate`）

- [x] 更新示例 env 模板（AC: 4）
  - [x] 在 `.env.example` 中补充（可带示例值或注释说明）：
    - [x] `AUTOQA_USERNAME=...`
    - [x] `AUTOQA_PASSWORD=...`
  - [x] 在 `.env.test.example` / `.env.prod.example` 中补充同样的可选项（注释即可）

- [x] 更新示例 specs（可选但推荐）（AC: 1, 2）
  - [x] 将 `specs/saucedemo-01-login.md`~`05-logout.md` 中的账号密码字面量替换为 `{{USERNAME}}` / `{{PASSWORD}}`
  - [x] 确保仓库内提供的 `.env.example` 让示例仍可开箱运行（通过复制即可）

- [x] 单元测试（AC: 1, 3）
  - [x] 增加 `tests/unit/markdown-template.test.ts` 覆盖 USERNAME/PASSWORD 模板变量替换
  - [x] 增强/新增测试覆盖脱敏：
    - [x] `src/logging/redact.ts`：`fill.text` 已脱敏（只记录长度），确保未来改动不回归
    - [x] `src/ir/writer.ts`：`fill` 的 `textRedacted=true` 行为存在且稳定

- [x] 安全与可观测性收口（AC: 3）
  - [x] 复核 debug 输出：确认渲染后的 spec 不会打印到 stderr（只打印 spec 路径和统计信息）
  - [x] agent prompt 已有规则：\"Keep tool inputs minimal and avoid leaking secrets.\"

## Dev Notes

- **当前实现的关键链路（本 Story 要扩展的点）**
  - env 加载：`src/env/load-env.ts`（先 `.env` 后 `.env.<env>`，且不覆盖进程启动前已有 env key）
  - 模板渲染：`src/markdown/template.ts`（严格 unknown/missing 校验）
  - CLI 渲染入口：`src/cli/commands/run.ts` 在 `parseMarkdownSpec` 前调用 `renderMarkdownTemplate`

- **脱敏现状（本 Story 需要保证/可加强）**
  - 结构化日志：`src/logging/redact.ts` 对 `fill.text` 只记录 `textLength`，不会记录明文
  - IR：`src/ir/writer.ts` 对 `fill` 标记 `textRedacted=true`

- **范围边界**
  - 本 Story 仅解决“敏感数据不写入 Markdown 文件”的仓库合规问题，以及日志/IR 脱敏不回归。
  - 不在本 Story 内实现更复杂的 Secret Manager / Keychain / Vault 集成（可在后续 Epic/Story 扩展）。

### Project Structure Notes

- 仍需遵守分层边界：`src/cli/**` 只做参数解析与编排；渲染/校验逻辑集中在 `src/env/**`、`src/markdown/**`、`src/runner/**`。
- 不要在 CLI/Runner 直接调用 Playwright API。

### References

- [Source: docs/epics.md#Story 5.4]
- [Source: docs/architecture.md#Authentication & Security（认证与安全）]
- [Source: src/env/load-env.ts]
- [Source: src/markdown/template.ts]
- [Source: src/cli/commands/run.ts]
- [Source: src/logging/redact.ts]
- [Source: src/ir/writer.ts]

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

### Completion Notes List

- 在 `src/cli/commands/run.ts` 中添加了 `USERNAME` 和 `PASSWORD` 模板变量映射
- 更新了 `.env.example`、`.env.test.example`、`.env.prod.example` 添加 `AUTOQA_USERNAME` 和 `AUTOQA_PASSWORD` 配置说明
- 更新了 `specs/saucedemo-01~05.md` 将硬编码账号密码替换为 `{{USERNAME}}` / `{{PASSWORD}}`
- 在 `tests/unit/markdown-template.test.ts` 添加了 USERNAME/PASSWORD 模板变量测试
- 在 `tests/unit/logging-redact.test.ts` 添加了敏感数据脱敏回归测试
- 在 `tests/unit/ir-writer.test.ts` 添加了 IR 脱敏回归测试
- 修复了 `tests/unit/run-args-spec-discovery.test.ts` 中的测试隔离问题，并补充了 run 命令模板变量 wiring 的入口级测试
- 修复了 debug 输出可能泄漏敏感输入的问题：对 tool_use / navigate debug 输出做脱敏
- 所有 321 个单元测试通过

### File List

- .gitignore
- .env.example
- .env.test.example
- .env.prod.example
- docs/epics.md
- docs/sprint-artifacts/sprint-status.yaml
- docs/sprint-artifacts/5-1-env-base-url.md
- docs/sprint-artifacts/5-2-env-login-base-url.md
- docs/sprint-artifacts/5-3-markdown-template-vars.md
- docs/sprint-artifacts/5-4-sensitive-testdata-injection.md
- specs/saucedemo-01-login.md
- specs/saucedemo-02-sorting.md
- specs/saucedemo-03-cart.md
- specs/saucedemo-04-checkout.md
- specs/saucedemo-05-logout.md
- src/agent/browser-tools-mcp.ts
- src/agent/run-agent.ts
- src/cli/commands/run.ts
- src/env/load-env.ts
- src/logging/redact.ts
- src/markdown/template.ts
- src/runner/validate-run-args.ts
- tests/unit/env-load-env.test.ts
- tests/unit/markdown-template.test.ts
- tests/unit/logging-redact.test.ts
- tests/unit/ir-writer.test.ts
- tests/unit/run-args-spec-discovery.test.ts

## Senior Developer Review (AI)

Reviewer: Nick on 2025-12-18

### Findings

1. HIGH: `--debug` 模式下 agent debug 输出会打印 tool_use 的完整 input，可能泄漏 `fill.text` 等敏感数据
2. HIGH: `redactToolInput` 仅按裸 toolName（如 `fill`）匹配，但实际 toolName 可能为 `mcp__browser__fill`，存在漏脱敏风险
3. MEDIUM: 缺少入口级测试验证 `autoqa run` 对 `{{USERNAME}}` 的缺失处理（exitCode=2，且不调用 runner）
4. MEDIUM: `mcp_tool=navigate url=...` 的 debug 输出可能包含 URL 中的敏感信息（凭据/查询参数）
5. MEDIUM: Story File List 与实际变更文件不一致，影响可审计性

### Fixes Applied

- 在 `src/agent/run-agent.ts`：
  - tool_use debug 输出改为打印 `redactToolInput(...)` 结果（避免明文）
  - `writeDebug` 增加基于环境变量值的文本级脱敏（AUTOQA_PASSWORD/AUTOQA_USERNAME/ANTHROPIC_API_KEY）
- 在 `src/logging/redact.ts`：
  - 支持 `mcp__<server>__<tool>` 前缀归一化，保证 `mcp__browser__fill` 等工具名也能命中脱敏规则
- 在 `src/agent/browser-tools-mcp.ts`：
  - navigate 的 debug 输出改为仅打印 `origin`（或相对路径）
- 在 `tests/unit/run-args-spec-discovery.test.ts`：
  - 新增入口级用例：spec 使用 `{{USERNAME}}` 但未设置 `AUTOQA_USERNAME` 时应 exitCode=2 且不调用 `runSpecs`
- 更新本 story 的 File List 与 Completion Notes，保证与实际变更一致

## Change Log

- 2025-12-18: Code review fixes applied (debug/tool input redaction hardening + CLI wiring tests + story audit trail)

