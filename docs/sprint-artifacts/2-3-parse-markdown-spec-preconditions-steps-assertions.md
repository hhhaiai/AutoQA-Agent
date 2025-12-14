# Story 2.3: 解析 Markdown spec（Preconditions + 步骤 + 断言语句）

Status: Ready for Review

## Story

As a QA 工程师,
I want 用自然的 Markdown（前置条件 + 有序步骤 + 预期结果）描述验收流程，
so that 我无需编写指令式脚本也能驱动自动化验收。

## Acceptance Criteria

1. **Given** 一个符合最低结构的 Markdown spec（包含 `## Preconditions` 与有序列表步骤）
   **When** `autoqa run` 读取并解析该 spec
   **Then** 系统应抽取前置条件与步骤列表，并生成结构化的 Task Context（可用于 Agent 推理）

2. **Given** 当 Markdown 不满足最低结构
   **When** `autoqa run` 尝试解析该 spec
   **Then** 应以退出码 `2` 失败并指出缺失的结构元素

## Tasks / Subtasks

- [x] 定义 Markdown spec 的最小语法与结构化类型（AC: 1, 2）
  - [x] 明确最低结构约束（MVP）：
    - [x] 必须包含二级标题 `## Preconditions`
    - [x] 必须包含至少 1 条“有序列表步骤”（`1.`/`2.`/`3.`…）
    - [x] `## Steps` 标题可选（示例 spec 已包含），但不能把它作为唯一可解析信号
  - [x] 在 `src/markdown/spec-types.ts`（或等价文件）定义结构化类型（建议至少包含）：
    - [x] `preconditions: string[]`
    - [x] `steps: Array<{ index: number; text: string; kind: 'action' | 'assertion' }>`
    - [x] `warnings?: string[]`（可选，用于提示非阻塞问题）
  - [x] 明确“断言语句”的 MVP 识别规则（仅用于结构化表达，不做执行）：
    - [x] 如果步骤文本以 `Verify` / `Assert` / `验证` / `断言` 开头，则 `kind='assertion'`
    - [x] 否则 `kind='action'`

- [x] 实现 Markdown 解析与结构校验（AC: 1, 2）
  - [x] 新建 `src/markdown/parse-markdown-spec.ts`（或等价文件）导出纯函数 `parseMarkdownSpec(markdown: string)`
  - [x] 使用 `remark-parse@11.0.0` 解析 Markdown AST（如需直接使用 `unified`，请将其补充为直接依赖，避免依赖 package-lock 的传递依赖）
  - [x] 从 AST 中提取：
    - [x] `## Preconditions` 标题后的列表项（允许无序列表 `-`/`*`）
    - [x] 步骤有序列表（优先匹配 `## Steps` 下的有序列表；若不存在则匹配全文中 `Preconditions` 之后的第一个有序列表）
  - [x] 校验失败时返回可机器处理的错误码与可理解错误信息（用于 CLI 映射退出码 `2`）：
    - [x] `MARKDOWN_MISSING_PRECONDITIONS`：缺少 `## Preconditions`
    - [x] `MARKDOWN_MISSING_STEPS`：缺少有序列表步骤
    - [x] `MARKDOWN_EMPTY_PRECONDITIONS`（可选）：存在标题但无任何条目
    - [x] `MARKDOWN_EMPTY_STEPS`（可选）：存在列表但无任何条目
  - [x] 错误信息建议包含：`specPath`（由调用方拼接）、缺失元素名称、以及最小示例（可截断，避免过长）

- [x] 在 `autoqa run` 中集成 spec 解析（AC: 1, 2）
  - [x] 在 `src/cli/commands/run.ts` 中，在 preflight 之前对 `discoverMarkdownSpecs()` 返回的 spec 列表逐个执行：读取文件 → `parseMarkdownSpec()` → 累积 Task Context
  - [x] 任何一个 spec 解析/校验失败，都应使用 `program.error(..., { exitCode: 2 })` 立即失败，并打印“缺失结构元素”的清晰提示
  - [x] 保持当前 stdout 行为稳定（仍输出 specPath 列表），避免破坏既有脚本/测试；解析结果用于后续 runner/agent（或在 debug 时输出摘要到 stderr）

- [x] 单元测试（AC: 1, 2）
  - [x] 新增 `tests/unit/parse-markdown-spec.test.ts` 覆盖：
    - [x] 合法 spec：提取 preconditions 与 steps，且 steps kind 识别符合规则
    - [x] 缺少 `## Preconditions` → 返回错误码 `MARKDOWN_MISSING_PRECONDITIONS`
    - [x] 缺少有序列表步骤 → 返回错误码 `MARKDOWN_MISSING_STEPS`
  - [x] 更新 `tests/unit/run-args-spec-discovery.test.ts` 中构造的 `.md` 内容，使其符合“最低结构”（否则 `autoqa run` 将按新校验逻辑以退出码 `2` 失败）
  - [x] 增加 `autoqa run` 在遇到无效 spec 时退出码为 `2` 的覆盖（建议用 `program.exitOverride()` 捕获）

## Dev Notes

- 分层边界（强约束）：
  - `src/cli/**` 可以负责读取文件与错误映射，但 Markdown 解析逻辑必须下沉到独立模块（建议 `src/markdown/**`），避免 CLI 内部堆积业务逻辑。
  - Markdown 解析与 Task Context 构建 **不得** 依赖 Playwright/浏览器对象（纯文本解析，方便单测）。

- 最小输入规范（与 repo 示例对齐）：
  - `src/specs/init.ts` 与 `specs/login-example.md` 已提供一个可运行的最小 spec 结构：`## Preconditions` + `## Steps` + 有序列表。
  - 本 story 的解析器需要对“额外内容”宽容（例如用户在前后加段落/标题），但对“最低结构缺失”必须明确报错。

- 依赖与实现建议：
  - 依赖版本以 `package.json` 为准：`remark-parse@11.0.0` 已固定。
  - 如果实现选择 `unified().use(remarkParse)`：请将 `unified` 明确加入 `dependencies`，避免依赖传递依赖导致的安装差异。

- 退出码约定（与既有 stories 对齐）：
  - `2`：用户输入/配置错误（本 story：spec 结构不合法）
  - `1`：测试失败（断言失败/护栏触发，属于 Epic 3）
  - `0`：全部通过（本 story 不要求实现真正执行闭环，但不应引入错误退出码）

### Project Structure Notes

- 本 story 预计新增：
  - `src/markdown/parse-markdown-spec.ts`
  - `src/markdown/spec-types.ts`（或合并到同一文件，取决于团队偏好）
  - `tests/unit/parse-markdown-spec.test.ts`

- 现有代码中需要对齐/复用：
  - `src/cli/commands/run.ts`：当前执行顺序为 `validateRunArgs` → `discoverMarkdownSpecs` → `runPreflight` → 输出 specPath
  - `src/specs/discover.ts`：spec 发现与确定性排序逻辑已稳定且有单测覆盖，本 story 不应修改其算法

### References

- [Source: docs/epics.md#Story 2.3]
- [Source: docs/prd.md#Markdown 输入规范]
- [Source: docs/architecture.md#Core Architectural Decisions（核心架构决策）]
- [Source: docs/architecture.md#Structure Patterns（结构与边界规范）]
- [Source: docs/architecture.md#Requirements to Structure Mapping（需求到目录映射）]
- [Source: docs/project_context.md#2. 分层边界（强约束）]
- [Source: src/cli/commands/run.ts]
- [Source: src/specs/init.ts]
- [Source: specs/login-example.md]
- [Source: tests/unit/run-args-spec-discovery.test.ts]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Cascade

### Debug Log References

- `npm test`
- `npm run build`
- `node dist/cli.js run ./specs --url http://example.test`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 实现 Markdown spec 解析器（remark-parse + unified），并提供可机器处理的错误码（缺失 Preconditions / 缺失 steps 等）
- 在 `autoqa run` 中于 preflight 之前集成解析与校验；遇到无效 spec 使用 `exitCode: 2` 立即失败，stdout 行为保持不变
- 新增/更新单元测试覆盖解析成功/失败与 CLI 退出码行为；`npm test` 全量通过

### File List

- `package.json`
- `package-lock.json`
- `docs/sprint-artifacts/sprint-status.yaml`
- `docs/sprint-artifacts/2-3-parse-markdown-spec-preconditions-steps-assertions.md`
- `src/cli/commands/run.ts`
- `src/markdown/spec-types.ts`
- `src/markdown/parse-markdown-spec.ts`
- `tests/unit/parse-markdown-spec.test.ts`
- `tests/unit/run-args-spec-discovery.test.ts`

### Change Log

- Implement Story 2.3: parse Markdown spec Preconditions/Steps into structured context, validate minimum structure with exitCode=2, and add unit tests
