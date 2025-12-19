# Story 2.10: 支持 include 可复用步骤库（例如 `include: login`）

Status: review

## Story

As a QA 工程师,
I want 在 Markdown 的 Steps 中引用可复用步骤片段（例如 `include: login`），
so that 我可以在多条用例中复用登录/导航等公共步骤，减少重复与漂移。

## Acceptance Criteria

1. **Given** 一个 Markdown spec 的步骤中包含 `include: login`
   **And** 存在可被加载的步骤库文件（例如 `specs/steps/login.md` 或等效约定路径）
   **When** 解析并执行该 spec
   **Then** 系统应将 `include: login` 展开为被引用文件中的步骤序列，并保持确定性的步骤顺序

2. **Given** include 引用的步骤库文件不存在或语法不合法
   **When** 解析并执行该 spec
   **Then** 系统应以退出码 `2` 失败，并输出清晰错误（包含缺失的 include 名称与期望路径）

## Tasks / Subtasks

- [x] 定义 include 规范（AC: 1, 2）
  - [x] 语法：步骤文本匹配 `include: <name>`（忽略首尾空白，`include` 大小写不敏感）
  - [x] `<name>` 仅允许安全字符（建议：`[A-Za-z0-9_-]+`），禁止 `/`、`\\`、`..`
  - [x] includeRoot：`autoqa run <dir>` 用 `<dir>`；`autoqa run <file.md>` 用 `dirname(<file.md>)`
  - [x] 期望路径：`${includeRoot}/steps/<name>.md`

- [x] 实现 include 展开（AC: 1, 2）
  - [x] 保持 `parseMarkdownSpec()` 纯函数（不读文件系统），include 展开放在 CLI 读取文件后、模板渲染前
  - [x] 读取 steps library 文件并提取其步骤（支持可选 `## Steps`；否则取文件内第一个有序列表）
  - [x] 将 include 步骤替换为步骤库内容，并对最终 steps 重新编号为连续序号（保证 stepIndex 稳定）
  - [x] 防循环：禁止 steps library 内再次 include（MVP），或提供最大深度/去重保护并在超限时报错（exitCode=2）

- [x] 错误处理与退出码（AC: 2）
  - [x] include 文件不存在：`exitCode=2`，错误信息包含 include 名称与期望路径
  - [x] include 文件无法解析/无有序列表：`exitCode=2`，指出原因与最小示例

- [x] 单元测试（AC: 1, 2）
  - [x] 新增 `tests/unit/markdown-include.test.ts`：覆盖展开成功（顺序与重编号）、缺文件、非法 name、循环/深度限制

## Dev Notes

- 分层边界：文件系统访问在 `src/cli/**`（或 runner 辅助）完成，Markdown 结构解析逻辑下沉到 `src/markdown/**`。
- 与既有能力对齐：include 展开应发生在 `renderMarkdownTemplate()` 之前（这样 steps library 里也可使用 `{{VAR}}`）。
- 可观测性/安全：错误信息可包含“期望相对路径”，避免泄露绝对路径；退出码遵循约定（用户输入/用例不合法=2）。

### References

- [Source: docs/epics.md#Story 2.10]
- [Source: docs/architecture.md#Structure Patterns（结构与边界规范）]
- [Source: src/cli/commands/run.ts]
- [Source: src/markdown/parse-markdown-spec.ts]
- [Source: docs/sprint-artifacts/2-3-parse-markdown-spec-preconditions-steps-assertions.md]
- [Source: docs/sprint-artifacts/5-3-markdown-template-vars.md]

## Dev Agent Record

### Agent Model Used

Cascade

### Implementation Plan

1. 创建 `src/markdown/include.ts` 模块，实现 include 语法解析、名称验证、路径解析和展开逻辑
2. 修改 `src/specs/discover.ts` 添加 `inputIsDirectory` 字段
3. 修改 `src/cli/commands/run.ts` 集成 include 展开功能
4. 导出 `classifyStepKind` 函数用于步骤分类
5. 创建单元测试 `tests/unit/markdown-include.test.ts`

### Debug Log

- 初始测试发现 `resolveIncludePath` 测试用例设计有误，修正为分离 `resolveIncludePath` 和 `getIncludeRoot` 的职责
- 集成到 run.ts 后发现模板变量验证逻辑需要调整，添加了统一的模板检查步骤
- Code review 修复：discover 返回值补齐 `inputIsDirectory`；include 错误信息不再泄露绝对路径（固定为 `steps/<name>.md`）；`includeRoot` 计算逻辑与 discover 类型对齐；恢复 rawContent 传递以支持导出场景

### Completion Notes

✅ 实现了完整的 include 可复用步骤库功能：
- **语法支持**：`include: <name>` 格式，大小写不敏感，支持首尾空白
- **名称验证**：仅允许 `[A-Za-z0-9_-]+`，禁止路径分隔符和 `..`
- **路径解析**：`${includeRoot}/steps/<name>.md`，目录输入用目录本身，文件输入用 dirname
- **展开逻辑**：保持 parseMarkdownSpec 纯函数，展开在 CLI 层完成，发生在模板渲染前
- **步骤提取**：支持 `## Steps` 标题下的有序列表，或文件中第一个有序列表
- **防循环**：MVP 阶段禁止嵌套 include
- **错误处理**：文件不存在或无有序列表时 exitCode=2，错误信息包含 include 名称和期望路径
- **模板变量**：steps library 中的 `{{VAR}}` 会在展开后被正确渲染

## File List

### New Files
- `src/markdown/include.ts` - include 模块实现
- `tests/unit/markdown-include.test.ts` - 21 个单元测试

### Modified Files
- `src/specs/discover.ts` - 添加 `inputIsDirectory` 字段到返回类型
- `src/cli/commands/run.ts` - 集成 include 展开逻辑
- `src/markdown/parse-markdown-spec.ts` - 导出 `classifyStepKind` 函数

## Change Log

- 2025-12-19: 实现 Story 2.10 - 支持 include 可复用步骤库功能
- 2025-12-19: Code review 修复（HIGH/MEDIUM）并复跑 `npx vitest run`（342 tests）全绿
