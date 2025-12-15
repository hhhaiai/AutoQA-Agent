# Story 2.4: 实现 Runner（按 spec 生命周期创建 Browser/Context/Page）

Status: Done

## Story

As a 开发者,
I want Runner 按 spec 隔离浏览器上下文并稳定执行，
so that 多个 spec 的运行结果可重复且互不污染（cookie/session 隔离）。

## Acceptance Criteria

1. **Given** `autoqa run` 需要执行多个 specs
   **When** Runner 逐个执行 specs
   **Then** 每个 spec 都应创建新的 Browser Context 并在结束后正确释放资源

2. **Given** 同一次 `autoqa run` 需要执行多个 specs
   **When** Runner 执行 specs
   **Then** 应复用同一个 Browser 实例以降低启动开销（满足启动性能目标的实现方向）

## Tasks / Subtasks

- [x] 定义 Runner 的输入/输出契约与核心类型（AC: 1, 2）
  - [x] 在 `src/runner/**` 新增 Runner 入口模块（例如 `run-specs.ts`，或按架构建议拆为 `run-directory.ts` / `run-spec-file.ts`）
  - [x] 明确 Runner 的最小输入：`runId`、`baseUrl`、`headless/debug`、以及待执行 spec 列表（建议直接复用 `src/cli/commands/run.ts` 已解析出的 `parsedSpecs`）
  - [x] 明确 Runner 的返回结构：成功/失败、失败原因（供 CLI 映射退出码；本 story 范围内的 Playwright/环境失败应视为用户可纠正问题 → 退出码 `2`）

- [x] 实现 Browser 生命周期（单次 run 复用）（AC: 2）
  - [x] 复用现有 `src/browser/create-browser.ts` 创建 Browser
  - [x] 在 Runner 内确保 Browser 只创建一次，并在 run 结束时 `await browser.close()`（使用 `try/finally` 保证释放）
  - [x] debug 模式下允许通过 `slowMo` 提升可观察性（参考 `src/runner/preflight.ts` 的做法）

- [x] 实现 per-spec 的 Browser Context / Page 生命周期（隔离 + 释放）（AC: 1）
  - [x] 对每个 spec：`browser.newContext()` → `context.newPage()`
  - [x] 结束时确保 `page`/`context` 被关闭（即使某个 spec 执行中途失败，也必须释放资源）
  - [x] 为后续 stories 预留 “把 `page` 注入到 tools/agent” 的扩展点：Runner 只负责生命周期与隔离，不在本 story 里实现具体 click/fill 等动作

- [x] 集成到 `autoqa run` 的执行路径（AC: 1, 2）
  - [x] 在 `src/cli/commands/run.ts` 中用 Runner 替代或前移当前的 `runPreflight()`（避免重复启动/关闭浏览器）
  - [x] 保持既有 stdout 行为稳定：仍输出 specPath 列表（避免破坏现有测试与脚本），将生命周期日志输出到 stderr（或后续 Story 2.7 的日志模块）

- [x] 单元测试（AC: 1, 2）
  - [x] 新增 `tests/unit/runner-spec-lifecycle.test.ts`（或等价命名）验证：
    - [x] 多个 specs 执行时 Browser 仅创建一次
    - [x] 每个 spec 都会创建新的 Context，并且在 spec 结束后关闭
    - [x] 任一 spec 失败时仍能正确关闭已创建的 Context/Browser（no leak）
  - [x] 通过 mock Playwright/Browser/Context/Page 对象避免单测真实启动浏览器（参考 `tests/unit/run-args-spec-discovery.test.ts` 对 `runPreflight` 的 mock 方式）

## Dev Notes

- 分层边界（强约束）：
  - `src/cli/**` 只做参数解析与命令路由，禁止直接调用 Playwright API。
  - Browser/Context/Page 生命周期管理属于 `src/runner/**`。

- 与现有实现的关系（避免重复造轮子）：
  - 已有 Browser 启动封装：`src/browser/create-browser.ts`。
  - 当前 `src/runner/preflight.ts` 仅用于“启动验证”；当 Runner 真正接管生命周期后，应避免在同一次 run 内重复 launch/close。
  - `autoqa run` 已能解析并校验 `--url/--debug/--headless`（`src/runner/validate-run-args.ts`），Runner 应直接复用该结果。

- 失败处理（本 story 范围）：
  - Playwright 启动失败、Context/Page 创建失败等应视为“环境/输入类问题”，由 CLI 映射为退出码 `2`。
  - 本 story 不实现断言与自愈闭环；测试失败（退出码 `1`）属于后续 Epic 3。

### Project Structure Notes

- 本 story 预计新增/修改的主要落点：
  - `src/runner/**`：新增 Runner 主流程（per-run 复用 browser、per-spec 创建 context/page）
  - `src/cli/commands/run.ts`：集成 Runner（替代 preflight-only 的 MVP 行为）
  - `tests/unit/**`：新增 runner 生命周期测试并更新必要的 mock

### References

- [Source: docs/epics.md#Story 2.4]
- [Source: docs/architecture.md#Structure Patterns（结构与边界规范）]
- [Source: docs/architecture.md#Data Flow（数据流）]
- [Source: docs/architecture.md#Requirements to Structure Mapping（需求到目录映射）]
- [Source: docs/project_context.md#2. 分层边界（强约束）]
- [Source: src/cli/commands/run.ts]
- [Source: src/runner/preflight.ts]
- [Source: src/browser/create-browser.ts]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Cascade

### Debug Log References

- `npm test`
- `npm run build`
- `node dist/cli.js run ./specs --url http://example.test`
- `node dist/cli.js run ./specs --url http://example.test --debug`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented Runner browser lifecycle: single Browser per run, per-spec Context/Page creation and guaranteed cleanup via try/finally
- Integrated Runner into `autoqa run` (replaced preflight-only execution path) while keeping stdout specPath output stable
- Added/updated unit tests to validate lifecycle and failure cleanup; `npm test` passes

### File List

- `src/runner/run-specs.ts`
- `src/cli/commands/run.ts`
- `tests/unit/runner-spec-lifecycle.test.ts`
- `tests/unit/run-args-spec-discovery.test.ts`
