# Story 5.2: 支持配置 `LOGIN_BASE_URL` 并在 spec 中引用

Status: done

## Story

As a QA 工程师,
I want 在不同环境下通过 `.env.<env>` 提供 `AUTOQA_LOGIN_BASE_URL` 并在 spec 中通过 `{{LOGIN_BASE_URL}}` 引用，
so that 登录页跨域/跨环境时也不需要在用例里写死域名。

## Acceptance Criteria

1. **Given** `.env.<env>` 中配置了 `AUTOQA_LOGIN_BASE_URL`
   **When** spec 包含 `Navigate to {{LOGIN_BASE_URL}}/login`
   **Then** 执行时应在解析 spec 前完成模板替换，且 `navigate` 使用替换后的绝对 URL

## Tasks / Subtasks

- [x] `autoqa run` 支持登录 baseUrl（AC: 1）
  - [x] 新增 CLI 参数 `--login-url <loginBaseUrl>`
  - [x] 从环境变量读取默认值：`AUTOQA_LOGIN_BASE_URL`
  - [x] 更新参数校验：`--login-url` 必须是合法 http(s) URL（可选项）

- [x] 将 `LOGIN_BASE_URL` 暴露给 spec 模板渲染（AC: 1）
  - [x] `autoqa run` 在解析 Markdown 前先执行模板替换
  - [x] 支持 `{{LOGIN_BASE_URL}}` → `AUTOQA_LOGIN_BASE_URL`（或 `--login-url`）

## Dev Notes

- 当前导航工具支持绝对 URL：当模板替换后的 `Navigate to https://...` 出现时，会直接 `page.goto(absoluteUrl)`，不依赖 `baseUrl`。
- 该 story 不处理账号/密码等敏感信息注入（留给 Story 5.4）。

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

- `npm test`

### Completion Notes List

- 新增 `--login-url` + `AUTOQA_LOGIN_BASE_URL`
- run args 校验支持可选 loginBaseUrl
- spec 支持 `{{LOGIN_BASE_URL}}` 模板替换

### File List

- `src/cli/commands/run.ts`
- `src/runner/validate-run-args.ts`
- `docs/sprint-artifacts/5-2-env-login-base-url.md`

### Change Log

- Add login baseUrl support (CLI + env) and allow spec to reference it via `{{LOGIN_BASE_URL}}`
