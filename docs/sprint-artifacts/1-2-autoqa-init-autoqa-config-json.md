# Story 1.2: 实现 `autoqa init` 生成 `autoqa.config.json`

Status: done

## Story

As a QA 工程师,
I want 通过 `autoqa init` 自动生成默认的 `autoqa.config.json` 配置文件，
so that 我无需手写配置即可开始尝试运行 AutoQA。

## Acceptance Criteria

1. **Given** 当前目录不存在 `autoqa.config.json`
   **When** 运行 `autoqa init`
   **Then** 应生成 `autoqa.config.json` 且包含 `schemaVersion` 字段
   **And** 生成的配置文件应可被后续 `autoqa run` 的配置校验逻辑成功读取（格式合法）

2. **Given** 当前目录已存在 `autoqa.config.json`
   **When** 运行 `autoqa init`
   **Then** CLI 不应覆盖已有文件，并应以退出码 `2` 结束并给出可理解的提示

## Tasks / Subtasks

- [x] 增加 `autoqa init` 命令入口（AC: 1, 2）
  - [x] 新增 `src/cli/commands/init.ts`（init 命令入口与路由）
  - [x] 在 `src/cli/program.ts` 注册 `init` 子命令并绑定 action
  - [x] 确保 `node dist/cli.js init --help` 可用（符合 commander 行为）

- [x] 定义配置文件契约与默认值（AC: 1）
  - [x] 新增 `src/config/schema.ts`：用 `zod` 定义配置 schema（至少包含 `schemaVersion`）
  - [x] 新增 `src/config/defaults.ts`：导出默认配置对象（与 schema 对齐）
  - [x] 明确 `schemaVersion` 的类型与初始值（建议：整数 `1`）

- [x] 实现生成 `autoqa.config.json`（AC: 1, 2）
  - [x] 将默认配置序列化为 JSON（建议 2-space pretty print + 末尾换行）
  - [x] 写入到 `process.cwd()` 下的固定文件名 `autoqa.config.json`
  - [x] 使用“禁止覆盖”的写入方式（例如 `flag: 'wx'`）避免误覆盖
  - [x] 对“文件已存在”等错误转换为用户可理解的信息，并设置退出码 `2`

- [x] 单元测试（AC: 1, 2）
  - [x] 在 `tests/unit/**` 添加测试：在临时目录执行 init 逻辑后应生成文件且包含 `schemaVersion`
  - [x] 添加测试：当文件已存在时不应被覆盖，并能返回退出码/错误信号
  - [x] 测试不要依赖真实仓库根目录（使用 `mkdtemp` / `tmpdir`）

## Dev Notes

- **范围边界**
  - 本 story 只实现“生成 `autoqa.config.json`”。
  - 不要在本 story 内实现：
    - `specs/` 示例目录与示例 spec（属于 Story 1.3）
    - `ANTHROPIC_API_KEY` 检查提示（属于 Story 1.4）
    - `autoqa run` 或任何 Playwright/Agent 逻辑（Epic 2/3）

- **架构/一致性硬约束（务必遵守）**
  - 运行时：Node.js `>= 20`
  - 模块系统：ESM only（本仓库已设置 `package.json.type=module`）
  - CLI：`commander@14.0.2`
  - 配置文件：
    - 文件名固定：`autoqa.config.json`
    - 字段使用 `camelCase`
    - 必须包含 `schemaVersion`
    - 使用 `zod@3.24.1` 做严格校验与默认值补齐（schema 本 story 先建立，后续 `run` 复用）

- **实现落点建议（防止后续结构漂移）**
  - `src/cli/**`：只做命令注册与参数解析；具体文件写入/默认配置生成建议落到 `src/config/**`。
  - 注意本仓库 TypeScript/ESM 的 import 路径规则：跨文件导入时使用 `.js` 后缀（参考 `src/cli/cli.ts`）。

- **建议的最小默认配置（可调整，但必须与 schema 对齐）**

```json
{
  "schemaVersion": 1
}
```

- 若提前引入其它字段（例如 `artifactsDir`/`baseUrl`/guardrails），必须：
  - 在 `src/config/schema.ts` 中声明
  - 在 `src/config/defaults.ts` 提供默认值
  - 保持 `camelCase` 命名

### Project Structure Notes

- 参考架构文档的目标目录结构；本 story 预计新增的目录：
  - `src/config/**`
  - `src/cli/commands/**`

### References

- [Source: docs/epics.md#Story 1.2]
- [Source: docs/architecture.md#Naming Patterns（命名规范）]
- [Source: docs/architecture.md#Data Architecture（数据与状态）]
- [Source: docs/architecture.md#Project Structure & Boundaries（项目结构与边界）]
- [Source: docs/project_context.md#3. 命名与格式约定（必须统一）]
- [Source: docs/project_context.md#8. 配置与安全（最低要求）]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Cascade

### Debug Log References

- `npm test`
- `npm run build`
- `node dist/cli.js init --help`

### Completion Notes List

- 实现 `autoqa init`：在当前目录生成 `autoqa.config.json`（2-space pretty print + 末尾换行）
- 新增 `zod` 配置 schema 与默认值，并在写入前进行校验
- 当配置文件已存在时拒绝覆盖，并以退出码 `2` 退出
- 新增单元测试覆盖“首次生成/已存在不覆盖”两种场景

### File List

- `src/cli/program.ts`
- `src/cli/commands/init.ts`
- `src/config/schema.ts`
- `src/config/defaults.ts`
- `src/config/init.ts`
- `tests/unit/init.test.ts`
- `.gitignore`
- `docs/sprint-artifacts/1-2-autoqa-init-autoqa-config-json.md`
- `docs/sprint-artifacts/sprint-status.yaml`

### Change Log

- Implement `autoqa init` to generate `autoqa.config.json` (schema + defaults + non-overwrite) and add unit tests
- Code review fixes: ignore `autoqa.config.json`, improve init error mapping (exitCode=2), and strengthen unit test assertions

## Senior Developer Review (AI)

### Findings

- **MEDIUM** `.gitignore` 未忽略 `autoqa.config.json`，容易误提交生成产物。
- **MEDIUM** `autoqa init` 对文件系统错误的退出码映射不完整：仅 `EEXIST` 会返回 `exitCode: 2`，其他常见错误会落到默认退出码，和约定不一致。
- **LOW** `program.error(...)` 分支后缺少显式 `return`，可读性与分支终止语义不够明确。
- **LOW** 单测未断言错误提示文案，容易出现“退出码正确但提示不可理解”的回归。

### Fixes Applied

- 将 `autoqa.config.json` 加入 `.gitignore`。
- 在 `init` 命令中将 `EACCES`/`EPERM`/`EROFS`/`ENOTDIR`/`EISDIR`/`ENOENT` 等错误统一映射为 `exitCode: 2` 并输出失败原因。
- 在 `program.error(...)` 分支后补充 `return`。
- 增强 `tests/unit/init.test.ts`：断言 stderr 包含 `Refusing to overwrite`。

## Review Follow-ups (AI)

- [x] 运行 `git add -A`，确保本 Story 新增/修改文件都被纳入版本控制，避免遗漏未追踪文件。
- [ ] （可选）删除仓库根目录本地 `autoqa.config.json` 产物文件，保持 repo 干净（该文件已被 `.gitignore` 忽略，可随时通过 `autoqa init` 重新生成）。
