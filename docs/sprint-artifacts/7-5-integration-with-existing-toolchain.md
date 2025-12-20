# Story 7.5: 与现有执行/导出工具链的集成

Status: draft

## Story

As a 开发者,
I want 生成的测试计划可以直接作为 `autoqa run` 与 Epic 4 导出流水线的上游输入,
so that 规划、执行与导出 Playwright Test 可以无缝衔接。

## Acceptance Criteria

1. **Given** 使用 `autoqa plan` 生成了测试计划（若干 Markdown specs）  
   **When** 运行 `autoqa run <生成的目录或文件>`  
   **Then** 应无需修改即可执行，且执行模型与手写 spec 完全一致（同样支持截图、自愈、IR 记录与 Playwright Test 导出）

2. **Given** 生成的 spec 中使用了模板变量与环境变量（例如 `{{BASE_URL}}`、`{{LOGIN_BASE_URL}}`、`{{USERNAME}}`）  
   **When** 通过 Epic 5 配置的环境变量运行 `autoqa run`  
   **Then** 变量替换与登录态复用等行为应与手写 spec 保持一致  
   **And** Epic 6 中关于登录态复用的约束同样适用于规划生成的用例

3. **Given** 用户从规划生成的 specs 导出 Playwright Test（Epic 4）  
   **When** 在 CI 中运行导出的 `@playwright/test`  
   **Then** 不应依赖 Planner 特有的元数据，仅依赖标准 IR、稳定 locator 与断言描述

## Tasks / Subtasks

- [ ] 确认生成 specs 满足 `autoqa run` 的所有输入约束（AC: 1, 2）  
  - [ ] 复用/调用现有 Markdown 解析逻辑对规划生成的 specs 进行自测，确保结构合法  
  - [ ] 增加一组集成测试：`autoqa plan` 生成 specs 后，直接用 `autoqa run` + 导出流水线跑通

- [ ] 与 Epic 4 导出流水线对齐（AC: 3）  
  - [ ] 确保规划生成的 specs 在 IR/locator 沉淀逻辑上与手写 spec 无差异  
  - [ ] 若 Planner 在 `TestPlan` 中附加了额外元数据（如标签/优先级），需要明确哪些会进入 IR/导出，哪些仅用于规划  
  - [ ] 更新 `docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md` 的引用说明（如有必要），确保包括“规划生成的 specs”场景

## Dev Notes

- 本故事保证 Epic 7 产出的测试计划不会形成一条“平行的执行通路”，而是完全复用现有 `autoqa run` 与 Epic 4 导出机制。  
  - **来源:** [Source: docs/epics.md#Story-7.5-与现有执行导出工具链的集成]
- 规划生成的 specs 在语义上应尽量贴近“人写的用例”，从而减少后续对导出器或 Runner 的特殊处理。  
  - **来源:** [Source: docs/sprint-artifacts/ts-7-agent-based-intelligent-planner.md]

### Project Structure Notes

- 不在 `src/plan` 中实现任何直接执行或导出逻辑，仅通过写入标准 Markdown specs 与 IR 间接接入。  
  - **来源:** [Source: docs/architecture.md#Project Structure & Boundaries（项目结构与边界）]

### References

- [Source: docs/epics.md#Story-7.5-与现有执行导出工具链的集成]  
- [Source: docs/epics.md#Epic-7-Agent-驱动智能测试规划器（基于-snapshot-的自动化测试计划生成）]  
- [Source: docs/sprint-artifacts/ts-7-agent-based-intelligent-planner.md]  
- [Source: docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md]  
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

- 2025-12-20: 初始创建 Story 7.5 文档（与现有执行/导出工具链的集成），尚未实现
