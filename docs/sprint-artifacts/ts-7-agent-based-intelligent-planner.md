# Epic 7: Agent 驱动智能测试规划器（基于 snapshot 的自动化测试计划生成）- Tech Spec（Story 7.1–7.5）

Status: draft

## Goals

- 让 Planner 主要由 Claude Agent 驱动：探索逻辑、测试类型选择与覆盖策略尽量通过 Agent + 工具协议实现，而不是写死在 TypeScript 规则引擎中。
- 复用 `autoqa run` 现有的视觉感知与浏览器工具层（screenshot + AX/ARIA snapshot + `navigate/click/fill/scroll/wait`）。
- 在成本与 guardrail 约束下，自动生成一组可直接由 `autoqa run` 执行、并可进一步导出为 Playwright Test 的 Markdown 测试计划。

## Non-goals

- 不在本 Epic 内实现端到端的 CI 编排（例如自动将规划结果提交 PR 或接入特定 CI 平台）。
- 不在 TypeScript 中为每类页面/组件维护复杂的规则引擎（这部分交给 Agent 推理完成）。
- 不重新设计 Markdown spec 语法；Planner 输出必须兼容现有 `autoqa run` 期望的结构。

## User-facing Behavior

- `autoqa plan explore -u <url> [-d <depth>] [...options]`  
  - 触发 Story 7.1：Agent 驱动的探索 Session。  
  - 产物输出到 `.autoqa/runs/<runId>/plan-explore/*`。

- `autoqa plan -u <url> [--config <path>] [...options]`  
  - 触发 Story 7.3：顶层编排，顺序执行探索（7.1）和用例生成（7.2），并使用 Story 7.4 的配置策略。  
  - 在 `.autoqa/runs/<runId>/plan/` 下生成：  
    - `plan-summary.json`：规划摘要与 guardrail 信息  
    - `test-plan.json`：结构化测试计划（`TestPlan`）  
    - `specs/*.md`：可由 `autoqa run` 直接执行的 Markdown 测试用例

- `autoqa run <generated-spec-or-dir>`  
  - 复用现有执行管线与 Epic 4 的导出机制，对规划生成的 specs 无特殊分支。

## Architecture Overview

### 分层结构

- **CLI 层（`src/cli/commands/plan.ts`）**  
  - 解析 `autoqa plan` / `autoqa plan explore` 参数与环境。  
  - 调用 `PlanOrchestrator` 并处理退出码与日志。

- **Plan Orchestrator（`src/plan/orchestrator.ts`）**  
  - 暴露统一入口（例如 `runPlan(config)`、`runExplore(config)`）。  
  - 管理 runId、产物目录、与 Planner Agent 的对话循环。  
  - 执行 Story 7.3 的编排逻辑与 Story 7.4 的 guardrail 检查。

- **Planner Agent 集成层（`src/agent/*` 或新模块）**  
  - 定义 Planner Agent 的 system prompt、tool schema、超参数（如 temperature、max tokens）。  
  - 复用已有 Agent SDK 护栏（超时、最大工具调用次数等），并为 Planner 增加特定 guardrail。

- **Browser & Snapshot 层（`src/browser/*`, `src/agent/pre-action-screenshot.ts`）**  
  - 提供统一的 snapshot API：在需要时生成 screenshot + AX/ARIA snapshot + metadata。  
  - 提供基础浏览器动作工具：`navigate/click/fill/scroll/wait`。  
  - 由 Planner Agent 调用这些工具推进探索或验证页面假设。

- **Artifacts & Output 层（`src/plan/output.ts`）**  
  - 管理探索产物（ExplorationGraph）、测试计划（TestPlan）、以及 Markdown spec 的写入。  
  - 统一 runId 与目录布局：`.autoqa/runs/<runId>/plan-explore/*`、`.autoqa/runs/<runId>/plan/*`。

## Core Types & Data Models

建议在 `src/plan/types.ts` 中集中定义：

### PlanConfig（Story 7.4）

- `baseUrl: string`
- `maxDepth: number` （最大探索深度）
- `maxPages: number` （最大页面数量）
- `includePatterns: string[]` （URL 包含模式，glob/regex 按实际选型）
- `excludePatterns: string[]` （URL 排除模式）
- `testTypes: ('functional' | 'form' | 'navigation' | 'responsive' | 'boundary' | 'security')[]`
- `guardrails: { maxAgentTurnsPerRun?: number; maxSnapshotsPerRun?: number; maxTokenPerRun?: number }`
- `auth?: { loginUrl?: string; usernameVar?: string; passwordVar?: string; extra?: Record<string, unknown> }`

### ExplorationGraph（Story 7.1）

- `pages: PageNode[]`
- `edges: NavigationEdge[]`

`PageNode`（与现有探索引擎模型对齐/超集）：

- `id: string`
- `url: string`
- `title?: string`
- `depth: number`
- `snapshotRef?: string`（指向 snapshot 文件路径）
- `elementSummary: ElementSummary[]`

`ElementSummary`：

- `id: string`
- `kind: 'button' | 'link' | 'input' | 'textarea' | 'select' | 'form' | 'other'`
- `text?: string`
- `role?: string`
- `locatorCandidates?: LocatorCandidate[]`（可与 Epic 4 中定义复用/对齐）

### TestPlan & TestCasePlan（Story 7.2）

- `TestPlan`：
  - `runId: string`
  - `generatedAt: string`
  - `configSnapshot: PlanConfig`（最终生效的配置）
  - `flows: FlowPlan[]`
  - `cases: TestCasePlan[]`

- `TestCasePlan`：
  - `id: string`
  - `name: string`
  - `type: 'functional' | 'form' | 'navigation' | 'responsive' | 'boundary' | 'security'`
  - `priority: 'p0' | 'p1' | 'p2'`
  - `relatedPageIds: string[]`
  - `markdownPath: string`（相对 `.autoqa/runs/<runId>/plan/specs/`）

## Planner Agent Design

### System Prompt（要点）

- 角色：资深 QA / 测试架构师，熟悉 Web 应用常见模式与质量风险。
- 职责：
  - 利用有限的探索预算识别应用的主要用户旅程与高风险区域。
  - 设计覆盖合理的测试计划，而不是穷举所有组合。
  - 严格输出结构化的建议（通过工具返回的 JSON），由 TypeScript 渲染为最终 Markdown。

### Planner 工具（抽象协议）

这些是对 Agent 暴露的“虚拟工具”，实现层可组合现有浏览器与存储逻辑：

- `open_url(url: string)`  
  - 行为：打开指定 URL，返回 snapshot 引用与简要结构化描述（标题、主区域、交互元素统计等）。

- `observe_current_page()`  
  - 行为：在当前页面生成 snapshot 并返回解析后的结构（与 `open_url` 输出类似）。

- `list_known_pages()` / `get_page(pageId: string)`  
  - 行为：基于当前 `ExplorationGraph` 返回已发现页面的信息。

- `propose_test_cases_for_page(input: { pageId: string; config: PlanConfig })`  
  - 行为：针对单个页面输出一组候选 `TestCasePlan` 片段（尚未绑定 markdownPath）。

- `finalize_test_plan(input: { partialCases: Partial<TestCasePlan>[]; graphSummary: ... })`  
  - 行为：对整体测试计划做去重、优先级排序与补全，输出最终 `TestPlan`。

> 实际实现时，可通过“单一工具 + 模式字段”简化为一个多态工具，关键是保持输入输出结构在 tech-spec 中清晰定义。

## Execution Flow

### Phase 1：Exploration Session（Story 7.1）

1. Orchestrator 初始化：创建 runId、产物目录、PlanConfig。  
2. 启动浏览器与 Planner Agent。  
3. Agent 通过 `open_url` / `observe_current_page` / 浏览器动作工具执行多轮探索：
   - 每次动作前后由浏览器层生成 snapshot 并落盘。  
   - 更新 `ExplorationGraph` 与 transcript。  
4. 当 Agent 判定“探索足够”或触发 guardrail 时，结束 Phase 1。

### Phase 2：Test Plan Generation（Story 7.2）

1. Orchestrator 汇总 `ExplorationGraph` 与关键 snapshot（可按启发式挑选）。  
2. 调用 Planner Agent 的规划工具：
   - 针对重点页面调用 `propose_test_cases_for_page`。  
   - 汇总并通过 `finalize_test_plan` 生成 `TestPlan`。  
3. Orchestrator 将 `TestPlan` 渲染为 Markdown specs 并写入磁盘。

### Phase 3：Summary & Integration（Story 7.3 / 7.5）

1. 生成 `plan-summary.json`，包含：页数、用例数、类型覆盖、guardrail 触发情况等。  
2. 输出 CLI 总结日志（成功/失败、产物路径）。  
3. 用户可直接对生成的 specs 运行 `autoqa run` 并通过 Epic 4 导出 Playwright Test。

## Guardrails & Failure Semantics

- `maxAgentTurnsPerRun`：Agent 工具调用总次数上限。  
- `maxSnapshotsPerRun`：snapshot 生成次数上限，用于控制视觉成本。  
- `maxTokenPerRun`（可选）：对 Planner 整体 token 消耗设定预算。

触发任一 guardrail 时：

- Orchestrator 应中断当前 Phase，标记本次 run 被 guardrail 截断。  
- `plan-summary.json` 中记录具体触发的 guardrail 与当时的计数。  
- CLI 退出码为 `1`，并在日志中给出可理解提示。

## Security & Cost Notes

- 不在 Planner 层持久化任何 API Key 或敏感凭据；登录相关凭据通过环境变量与占位符机制传入。  
- snapshot 复用现有压缩策略（宽度约 1024px、JPEG 等），避免 Planner 成本显著高于 `autoqa run`。  
- 规划日志与产物中应避免记录明文密码等敏感信息，仅记录占位符或脱敏摘要。

## References

- [Source: docs/epics.md#Epic-7-Agent-驱动智能测试规划器（基于-snapshot-的自动化测试计划生成）]  
- [Source: docs/epics.md#Story-7.1-Agent-驱动的应用探索-Session（autoqa-plan-explore）]  
- [Source: docs/epics.md#Story-7.2-Agent-驱动的智能测试用例生成器]  
- [Source: docs/epics.md#Story-7.3-autoqa-plan-命令编排（探索-规划-用例生成）]  
- [Source: docs/epics.md#Story-7.4-配置化探索与生成策略]  
- [Source: docs/epics.md#Story-7.5-与现有执行导出工具链的集成]  
- [Source: docs/architecture.md#Core Architectural Decisions（核心架构决策）]  
- [Source: docs/prd.md#Functional Requirements]
