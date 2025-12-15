# Story 2.8: 生成并落盘结构化页面快照（AX/ARIA snapshot）

Status: done

## Story

As a QA 工程师,
I want 在 spec 执行过程中按需生成结构化页面快照（AX/ARIA snapshot）并落盘归档，
so that 我可以用更低成本的结构化信息辅助定位/自愈与排障。

## Acceptance Criteria

1. **Given** 正在执行某个 spec
   **When** 系统采集结构化快照
   **Then** 必须产出可读的文本表示（例如 ARIA snapshot 的 YAML）并与本次 run 绑定落盘归档（与现有产物根目录一致：`.autoqa/runs/<runId>/`）
   **And** 落盘路径必须稳定、可预测，并且不得泄露绝对本机路径（只允许输出受控的相对路径）。

2. **Given** 正在执行某个 spec
   **When** 系统采集结构化快照
   **Then** 应同时产出一份可机器处理的结构化表示（例如 `page.accessibility.snapshot()` 的 JSON tree）并与本次 run 绑定落盘归档
   **And** 该 JSON 与文本快照应能互相对应（同一工具调用/同一序号）。

3. **Given** 工具执行失败或发生多次重试/连续错误（进入自愈或接近护栏触发）
   **When** `autoqa run` 输出失败上下文
   **Then** CLI/结构化日志必须输出本次 run 的快照产物路径（至少包含快照目录或最近一次快照文件路径），便于快速定位页面结构变化。

4. **Given** 快照采集或写盘过程中发生错误（Playwright 抛错、超时、磁盘写入失败等）
   **When** 继续执行当前工具调用/后续步骤
   **Then** 该错误不得导致 spec 直接崩溃或中断自愈闭环
   **And** 必须记录可定位的错误信息（建议记录到结构化日志字段，例如 `snapshotError`），但不得泄露敏感信息。

## Tasks / Subtasks

- [x] 新增“结构化快照”采集能力（AC: 1, 2, 4）
  - [x] ARIA snapshot（可读文本）采集：优先使用 Playwright `await page.locator('body').ariaSnapshot()`
  - [x] AX snapshot（结构化 JSON）采集：优先尝试 `await page.accessibility.snapshot()`（若存在），失败时 fallback 到 `await page._snapshotForAI()`（Playwright 1.57.0 内部 API）
  - [x] 为上述采集函数补齐超时/异常处理（不得 throw 终止主流程）

- [x] 新增快照落盘与目录结构（AC: 1, 2, 3）
  - [x] 将快照归档到 `.autoqa/runs/<runId>/snapshots/**`
  - [x] 目录/文件命名需与现有“工具调用序号”对齐（建议复用 `src/agent/browser-tools-mcp.ts` 的 `nextFileBaseName(toolName)` 作为 basename，例如 `click-3`）
  - [x] 同一次快照建议至少生成两份文件：
    - [x] `<basename>.aria.yaml`
    - [x] `<basename>.ax.json`
  - [x] 写盘需使用受控相对路径返回值，并避免 absolute path 泄露（复用/对齐现有 `src/browser/screenshot.ts` 的路径规范化策略）。

- [x] 将快照采集接入现有工具调用链（AC: 1-4）
  - [x] 在 MCP tool handler 中（`src/agent/browser-tools-mcp.ts`）把“采集快照”放在动作执行之前（与 pre-action screenshot 一致）
  - [x] 保持现有约束：工具失败不得 throw；必须返回 `isError: true` 给 Agent SDK 以触发下一轮推理
  - [x] 成本控制：禁止把完整、未截断的大体量快照原文无条件注入到 agent turn；若需要提供给模型，必须采用“截断/聚焦片段 + 落盘路径”的组合（与 tech spec 对齐）。

- [x] 可观测性与失败可发现性（AC: 3, 4）
  - [x] 在结构化日志中记录快照路径（建议扩展 `autoqa.tool.result` 事件，新增 `snapshot.ariaRelativePath` 和 `snapshot.axRelativePath`）
  - [x] 在 spec 失败汇总中输出快照目录（保持 stdout 干净；信息输出到 stderr 或写入日志文件）。

- [x] 单元测试（覆盖 AC: 1-4）
  - [x] 测试快照采集成功（返回 YAML + JSON，且文件落盘路径可预测）
  - [x] 测试快照采集失败不应阻断工具执行（与 `runWithPreActionScreenshot` 的策略一致）
  - [x] 测试日志/输出中不包含绝对路径

## Dev Notes

- 现有实现可复用点（避免重复造轮子/破坏契约）：
  - `src/agent/browser-tools-mcp.ts` 已有“每次工具调用一个递增序号”的 `nextFileBaseName(toolName)`，可直接用于快照文件命名。
  - `src/agent/pre-action-screenshot.ts` 已实现“pre-action 截图失败不 throw、debug/失败时写盘”的稳健策略；快照实现应保持同样的失败语义与可观测性。
  - 产物根目录当前统一为 `.autoqa/runs/<runId>/`（参见 `src/logging/logger.ts` / `src/cli/commands/run.ts`）；快照目录应与之对齐，避免引入 `.autoqa/<runId>` 这种与现有不一致的新结构。

- Playwright API 关键点（版本：`playwright@1.57.0`）：
  - ARIA snapshot（YAML 文本）：`await page.locator('body').ariaSnapshot()`
  - AX snapshot（JSON tree）：优先 `await page.accessibility.snapshot()`（若存在），否则使用 `await page._snapshotForAI()`

- 安全与隐私：
  - 快照/trace 可能包含页面敏感信息；本 story 默认要求落盘快照产物，因此必须确保 `.autoqa/` 继续保持在 `.gitignore` 中（当前已存在），并避免在日志中泄露敏感内容/绝对路径。

### Project Structure Notes

- 预计新增：
  - `src/browser/snapshot.ts`（或等价命名：封装 ariaSnapshot/axSnapshot 采集 + 写盘）

- 预计修改：
  - `src/agent/browser-tools-mcp.ts`（在每次工具调用前采集快照并记录日志）
  - `src/logging/types.ts` / `src/logging/logger.ts`（如需要扩展事件字段以记录 snapshot path；注意保持向后兼容）

### References

- [Source: docs/epics.md#Story 2.8]
- [Source: docs/sprint-artifacts/ts-2-8-2-9-ax-aria-snapshot-playwright-trace.md]
- [Source: docs/architecture.md#产物与状态（.autoqa/runs/<runId>）]
- [Source: src/agent/browser-tools-mcp.ts]
- [Source: src/agent/pre-action-screenshot.ts]
- [Source: src/browser/screenshot.ts]
- [Source: src/logging/*]
- [Source: Playwright docs - locator.ariaSnapshot()]
- [Source: Playwright docs - page.accessibility.snapshot()]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Cascade

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Implemented `src/browser/snapshot.ts` with `captureAriaSnapshot`, `captureAxSnapshot`, `captureSnapshots`, `writeSnapshots`, and `captureAndWriteSnapshots` functions
- Extended `src/logging/types.ts` with `snapshot` and `snapshotError` fields in `ToolResultEvent`
- Integrated snapshot capture into all MCP tool handlers (navigate, click, fill, scroll, wait) in `src/agent/browser-tools-mcp.ts`
- Added 17 unit tests in `tests/unit/snapshot.test.ts` covering capture, write, and security scenarios
- All 103 tests pass with no regressions

### File List

- `src/browser/snapshot.ts` (new)
- `src/agent/browser-tools-mcp.ts` (modified)
- `src/logging/types.ts` (modified)
- `tests/unit/snapshot.test.ts` (new)

## Change Log

- 2025-12-16: Implemented AX/ARIA snapshot capture and persistence (Story 2.8)
