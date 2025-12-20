# Story 7.4: 配置化探索与生成策略

Status: draft

## Story

As a QA 工程师,
I want 通过配置文件与命令行参数自定义探索和测试生成规则,
so that 我可以根据不同项目的需求调整规划器的行为与覆盖范围。

## Acceptance Criteria

1. **Given** 需要定制探索行为  
   **When** 创建 `autoqa.planner.config.json` 或在 `autoqa.config.json` 中新增 `plan` 段  
   **Then** 至少支持配置：  
   - 探索深度 `maxDepth` 与最大页面数 `maxPages`  
   - URL 包含/排除模式（如 `/admin/*`、`/api/*`）  
   - 需要启用的测试类型集合（功能/表单/导航/响应式/边界/安全性）  
   - 登录/认证相关配置（登录 URL、凭据占位符等）

2. **Given** 同时提供配置文件和命令行参数  
   **When** 运行 `autoqa plan ...`  
   **Then** 命令行参数应优先于配置文件中的对应设置  
   **And** 最终生效的合并配置应被记录到本次 run 的总结产物中（例如 `plan-summary.json`）

3. **Given** 在大型站点或成本敏感场景下运行 `autoqa plan`  
   **When** 设置相关 guardrail（如 `maxAgentTurnsPerRun`、`maxSnapshotsPerRun`、`maxTokenPerRun`）  
   **Then** 规划过程应在达到上限时提前终止，并在 CLI 日志与总结产物中给出清晰说明

## Tasks / Subtasks

- [ ] 设计 `PlanConfig` 结构与默认值（AC: 1, 2, 3）  
  - [ ] 在 `src/plan/types.ts` 中定义 `PlanConfig`，包括探索/生成相关的配置字段  
  - [ ] 在 `src/config` 或等效模块中实现从 `autoqa.config.json`/`autoqa.planner.config.json` 读取与校验逻辑（使用 zod）  
  - [ ] 定义合理的默认值与上限（如最大深度、最大页面数、最大 Agent 回合数）

- [ ] 配置合并与优先级（AC: 2）  
  - [ ] 在单一位置实现配置合并（例如 `loadPlanConfig()`），避免在多个调用点重复合并  
  - [ ] 明确优先级：命令行参数 > `autoqa.planner.config.json` > `autoqa.config.json` > 内建默认值  
  - [ ] 为冲突配置项输出 debug 级别日志，便于排查配置问题

- [ ] Guardrail 支持（AC: 3）  
  - [ ] 在 `src/plan/orchestrator.ts` 中引入 guardrail 检查逻辑，统一计数 Agent 回合数、snapshot 数量等  
  - [ ] 在 `plan-summary.json` 中记录是否因 guardrail 提前终止，以及对应指标值  
  - [ ] 为超限场景增加单元测试

## Dev Notes

- 本故事对应 FR17“配置化探索策略：支持自定义探索深度、排除模式、认证信息等，灵活控制测试计划生成过程”。  
  - **来源:** [Source: docs/epics.md#Story-7.4-配置化探索与生成策略]
- 配置模型应尽量与 `autoqa run` 现有配置方式保持一致（如使用 zod 校验、统一的错误语义与退出码）。  
  - **来源:** [Source: docs/architecture.md#Configuration & Validation]
- Guardrail 相关字段与 Epic 3 中自愈护栏的命名/语义应尽量对齐，以减少用户理解成本。  
  - **来源:** [Source: docs/sprint-artifacts/3-3-self-heal-guardrails-max-tool-calls-errors-retries.md]
- Planner 层的配置约定由核心 tech-spec 统一定义，避免在多个 story 中各自扩展。  
  - **来源:** [Source: docs/sprint-artifacts/ts-7-agent-based-intelligent-planner.md]

### Project Structure Notes

- 配置解析与校验逻辑建议集中在 `src/config` 或单独模块中，避免散落在 CLI 与 orchestrator。  
  - **来源:** [Source: docs/architecture.md#Project Structure & Boundaries（项目结构与边界）]
- 规划相关的 guardrail 状态由 orchestrator 维护，并通过统一的 summary/日志对外暴露。  
  - **来源:** [Source: docs/architecture.md#Core Architectural Decisions（核心架构决策）]

### References

- [Source: docs/epics.md#Story-7.4-配置化探索与生成策略]  
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

- 2025-12-20: 初始创建 Story 7.4 文档（配置化探索与生成策略），尚未实现
