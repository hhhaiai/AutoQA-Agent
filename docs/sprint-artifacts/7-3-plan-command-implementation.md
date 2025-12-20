# Story 7.3: `autoqa plan` 命令编排（探索 + 规划 + 用例生成）

Status: draft

## Story

As a QA 工程师,
I want 使用 `autoqa plan` 命令一键完成“探索 + 规划 + 用例生成”,
so that 我可以在不同项目上快速得到可直接执行的测试计划。

## Acceptance Criteria

1. **Given** 需要为应用生成测试计划  
   **When** 运行 `autoqa plan -u https://example.com`  
   **Then** CLI 应按顺序触发：  
   - Story 7.1 定义的 Agent 探索 Session  
   - Story 7.2 定义的用例生成流程  
   **And** 运行结束后在 `.autoqa/runs/<runId>/plan/` 下产生探索产物、规划产物与生成的 Markdown specs

2. **Given** 存在 `autoqa.config.json` 中的 `plan` 配置段  
   **When** 运行 `autoqa plan`  
   **Then** CLI 应从配置中读取基础参数（如 `baseUrl`、`maxDepth`、test types 等），并传递给 orchestrator 与 Planner Agent  
   **And** 日志中有清晰的阶段划分（explore/generate），便于排障与性能分析

3. **Given** 探索或生成过程中触发 guardrail（如 `maxAgentTurnsPerRun`、`maxSnapshotsPerRun` 或等效配置）  
   **When** 本次 `autoqa plan` 结束  
   **Then** 应以退出码 `1` 结束（表示规划不完整），并在总结产物（如 `plan-summary.json`）中标记被 guardrail 截断的原因

4. **Given** 用户仅想执行探索或仅想执行用例生成  
   **When** 分别运行 `autoqa plan explore ...` 或未来的 `autoqa plan generate ...`（或等效子命令）  
   **Then** CLI 应只执行对应阶段，但仍复用同一 orchestrator 与产物布局约定

## Tasks / Subtasks

- [ ] 实现 `autoqa plan` 顶层命令（AC: 1, 2, 3）  
  - [ ] 在 `src/cli/commands/plan.ts` 中扩展现有命令，增加默认子流程编排逻辑  
  - [ ] 解析 `-u/--url`、`--env`、`--config` 等参数，并与 `autoqa.config.json` 中的 `plan` 段合并  
  - [ ] 约定退出码语义：`0=规划成功`、`1=运行时失败或被 guardrail 截断`、`2=参数/配置错误`

- [ ] 编排 orchestrator 调用（AC: 1, 2, 4）  
  - [ ] 在 `src/plan/orchestrator.ts` 中提供单一入口（如 `runPlan(config)`），内部依次调用探索与生成  
  - [ ] 支持仅执行探索或仅执行生成的模式，供子命令/后续扩展使用  
  - [ ] 在 orchestrator 内集中管理 runId 与产物输出位置

- [ ] 总结产物与日志（AC: 1, 2, 3）  
  - [ ] 设计并实现 `plan-summary.json` 结构，记录：页数、用例数、覆盖的测试类型、guardrail 是否触发等  
  - [ ] 扩展 `src/logging/types.ts`，增加 `autoqa.plan.started/finished/failed` 等事件，并在 CLI 中打印关键信息  
  - [ ] 确保日志与现有 `autoqa.run` 日志格式对齐，方便统一收集与分析

## Dev Notes

- 本故事聚焦 CLI 与 orchestrator 层面的编排，不重新定义探索或用例生成本身的算法。  
  - **来源:** [Source: docs/epics.md#Story-7.3-autoqa-plan-命令编排（探索-规划-用例生成）]
- `autoqa plan` 的执行模型应尽量与 `autoqa run` 一致（单进程、按 runId 管理产物），以降低用户心智成本。  
  - **来源:** [Source: docs/sprint-artifacts/ts-7-agent-based-intelligent-planner.md]
- 配置合并与优先级策略（命令行 > 配置文件 > 默认值）需要在 tech-spec 中有明确约定，并在实现中集中处理。  
  - **来源:** [Source: docs/epics.md#Story-7.4-配置化探索与生成策略]

### Project Structure Notes

- CLI 命令仍位于 `src/cli/commands/plan.ts`，仅负责参数解析与调用 orchestrator。  
  - **来源:** [Source: docs/architecture.md#Project Structure & Boundaries（项目结构与边界）]
- 规划编排逻辑集中在 `src/plan/orchestrator.ts`，不得在 CLI 层直接操作 Playwright 或 Agent SDK。  
  - **来源:** [Source: docs/architecture.md#Core Architectural Decisions（核心架构决策）]

### References

- [Source: docs/epics.md#Story-7.3-autoqa-plan-命令编排（探索-规划-用例生成）]  
- [Source: docs/epics.md#Epic-7-Agent-驱动智能测试规划器（基于-snapshot-的自动化测试计划生成）]  
- [Source: docs/sprint-artifacts/ts-7-agent-based-intelligent-planner.md]  
- [Source: docs/architecture.md#Core Architectural Decisions（核心架构决策）]  
- [Source: docs/prd.md#Functional Requirements]

## Dev Agent Record

### Agent Model Used

Cascade

### Implementation Plan

TBD

### Debug Log References

TBD

### Completion Notes List

TBD

### File List

TBD

### Change Log

- 2025-12-20: 初始创建 Story 7.3 文档（`autoqa plan` 命令编排），尚未实现
