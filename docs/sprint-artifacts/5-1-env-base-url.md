# Story 5.1: 支持通过 `.env.<env>` 配置 `BASE_URL`（登录后站点）

Status: done

## Story

As a QA 工程师,
I want 在不同环境（test/prod）下通过 `.env.<env>` 提供运行目标站点的 Base URL，
so that Markdown 用例不需要为每个环境复制一份。

## Acceptance Criteria

1. **Given** 存在 `.env.test` 且包含 `AUTOQA_BASE_URL`
   **When** 运行 `autoqa run ... --env test`
   **Then** `autoqa run` 应使用该 `AUTOQA_BASE_URL` 作为 `baseUrl`

## Tasks / Subtasks

- [x] 提供环境文件加载能力（AC: 1）
  - [x] 新增 `src/env/load-env.ts`：支持加载 `.env` 与 `.env.<env>`
  - [x] 规则：不覆盖进程启动前已有的 `process.env` 键
  - [x] 支持 `.env.<env>` 覆盖 `.env` 中加载出来的默认值

- [x] 集成到 `autoqa run`（AC: 1）
  - [x] `autoqa run` 增加 `--env <name>` 参数并在解析参数后加载 env 文件
  - [x] `baseUrl` 参数解析优先级：CLI `--url` > `AUTOQA_BASE_URL`

- [x] 单元测试（AC: 1）
  - [x] 新增 `tests/unit/env-load-env.test.ts`：验证 `.env` + `.env.test` 合并与覆盖规则

## Dev Notes

- `--env` 仅影响 env 文件加载，并不会改变 spec 解析规则；真正的运行目标站点由 `AUTOQA_BASE_URL`/`--url` 决定。
- 目前 `.env` 文件解析为最小实现：支持 `KEY=VALUE`、忽略空行/注释行、支持 `export KEY=VALUE`。

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

- `npm test`

### Completion Notes List

- 支持 `.env` 与 `.env.<env>` 的加载与覆盖规则
- `autoqa run` 支持 `--env`，并可从 `AUTOQA_BASE_URL` 读取默认 baseUrl

### File List

- `src/env/load-env.ts`
- `src/cli/commands/run.ts`
- `tests/unit/env-load-env.test.ts`
- `docs/sprint-artifacts/5-1-env-base-url.md`

### Change Log

- Add env file loader and wire it into `autoqa run` for environment-based baseUrl configuration
