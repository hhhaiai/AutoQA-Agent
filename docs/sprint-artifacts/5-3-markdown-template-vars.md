# Story 5.3: 支持 spec 模板变量（`{{BASE_URL}}`/`{{LOGIN_BASE_URL}}`/`{{ENV}}`）

Status: done

## Story

As a QA 工程师,
I want 在 Markdown spec 中使用少量受控的模板变量，
so that 用例可以在多环境下复用并保持可读性。

## Acceptance Criteria

1. **Given** spec 中包含 `{{BASE_URL}}`、`{{LOGIN_BASE_URL}}`、`{{ENV}}`
   **When** 运行 `autoqa run`
   **Then** 系统应在解析 spec 前将这些变量替换为运行时值
   **And** 当出现未知变量或必需变量缺失时，应以退出码 `2` 失败并给出可理解提示

## Tasks / Subtasks

- [x] 实现 Markdown 模板渲染模块（AC: 1）
  - [x] 新增 `src/markdown/template.ts`：支持 `{{VAR_NAME}}` 变量替换
  - [x] 未知变量：返回错误（unknown variables）
  - [x] 已声明但缺值：返回错误（missing variables）

- [x] 集成到 `autoqa run`（AC: 1）
  - [x] 在 `parseMarkdownSpec(...)` 前对 raw markdown 先执行 `renderMarkdownTemplate(...)`
  - [x] 渲染变量：
    - `BASE_URL` → validated baseUrl
    - `LOGIN_BASE_URL` → validated loginBaseUrl（可选）
    - `ENV` → `--env` 或 `AUTOQA_ENV`

- [x] 单元测试（AC: 1）
  - [x] 新增 `tests/unit/markdown-template.test.ts`：覆盖 replace/unknown/missing

## Dev Notes

- 模板语法为 `{{ VAR_NAME }}`，变量名限定为大写字母/数字/下划线。
- 模板渲染发生在 Markdown 解析之前，因此 `Steps`/`Preconditions` 内任意位置都可使用变量。

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

- `npm test`

### Completion Notes List

- 引入 `renderMarkdownTemplate` 并在 `autoqa run` 解析前执行
- 未知变量/缺失变量会阻止执行并以退出码 2 失败

### File List

- `src/markdown/template.ts`
- `src/cli/commands/run.ts`
- `tests/unit/markdown-template.test.ts`
- `docs/sprint-artifacts/5-3-markdown-template-vars.md`

### Change Log

- Add Markdown spec template variables and enforce strict unknown/missing validation
