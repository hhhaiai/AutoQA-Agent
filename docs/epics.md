---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
---

# AutoQA-Agent - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AutoQA-Agent, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 提供项目初始化命令 `autoqa init`，生成 `autoqa.config.json` 配置文件，并创建 `specs/` 示例目录与 `specs/login-example.md` 示例文档，同时检查并提示用户完成鉴权（优先使用 Claude Code 已授权的 Agent SDK；若不可用则提示配置 `ANTHROPIC_API_KEY` 环境变量）。
FR2: 提供测试执行命令 `autoqa run`，支持运行单个 Markdown 文件或整个目录；支持 `--headless`（默认无头）与 `--debug`（有头便于观察）参数；支持 `--url` 参数指定 Base URL（MVP：暂不从 Markdown 文档读取 Base URL）。
FR3: 支持 Markdown 语义解析：解析 Markdown 中的 `## Preconditions`（前置条件）与有序列表步骤（含“预期结果/断言”），并将 Markdown 内容转化为 Claude Agent SDK 可理解的 System Prompt 或 Task Context。
FR4: 实现视觉感知循环（Visual Perception Loop）：在 Agent 调用任何浏览器操作工具（如 click/fill 等）之前，系统必须自动截取当前页面截图（Screenshot），并作为 image block 注入到 Agent SDK 的当前 turn 中。
FR5: 实现原生自愈机制（Native Self-Healing）：当底层 Playwright 工具抛出错误（如 TimeoutError、ElementNotFound）时，禁止直接中断程序；必须捕获错误并封装为 ToolResult（包含 `is_error: true`）返回给 Agent SDK，以触发下一轮推理并结合截图重试。
FR6: 提供最小浏览器操作工具集（Playwright adapters）：`navigate(url)`、`click(target_description)`、`fill(target_description, text)`、`scroll(direction, amount)`、`wait(seconds)`；其中 `click/fill` 必须支持“语义描述”定位（例如“蓝色登录按钮”）。
FR7: 提供断言工具：`assertTextPresent(text)`、`assertElementVisible(description)`；断言失败应同样触发自愈重试，多次失败后才标记测试不通过。
FR8: 记录通过的动作轨迹（IR）：当 Agent 成功完成 `navigate/click/fill/scroll/wait` 等动作后，应记录动作与上下文到结构化 IR 产物中，以支持后续导出与复现。
FR9: 稳定定位器沉淀：当 Agent 成功点击/填表某个元素时，系统应在运行时生成多种稳定 locator 候选，并通过无副作用验证筛选；只允许将验证通过的候选用于后续导出。
FR10: 提供结构化页面表示：系统应支持获取页面的可访问性结构化快照（AX/ARIA snapshot），作为比截图更高效的页面理解输入，用于元素定位、自愈与调试。
FR11: 提供可回放调试产物：系统应支持按 spec 录制 Playwright trace（含网络/DOM/操作时间线），并将 trace 作为运行产物落盘，便于失败复现与调试。
FR12: 环境与测试数据配置：支持按环境加载（如 `.env.test`/`.env.prod`）并为 spec 提供可替换变量（例如 `BASE_URL`/`LOGIN_BASE_URL`），同时提供不在 Markdown 用例中硬编码敏感信息（如账号/密码）的机制。
FR13: Playwright Test 导出用例支持"登录态复用/会话持久化"：仅当 Markdown spec 的 `## Preconditions` 包含严格声明 `Auth: required|none` 且值为 `required` 时，导出的用例才启用 `storageState`；专门验证登录流程的用例必须在**未预置登录态**下运行。
FR14: Markdown spec 支持"可复用步骤库 / include"：步骤列表中允许通过 `include: <name>` 引用外部步骤文件（例如 `include: login`），以避免 02-05 这类用例重复维护相同的登录步骤。
FR15: 智能测试规划器：自动探索 Web 应用并生成测试计划，包括页面发现、表单分析、工作流识别和全面的测试用例生成。
FR16: 测试用例自动生成：基于应用结构智能生成功能测试、表单验证、导航测试、响应式测试、边界条件和安全性测试等多种类型的测试用例。
FR17: 配置化探索策略：支持自定义探索深度、排除模式、认证信息等，灵活控制测试计划生成过程。

### NonFunctional Requirements

NFR1: 启动速度：CLI 启动到浏览器打开的时间应 < 3 秒。
NFR2: 稳定性：在标准 TodoMVC 演示应用中，连续运行 10 次应 100% 通过。
NFR3: Token 成本控制：截图应进行适当压缩（例如压缩至 1024px 宽，JPEG 格式/quality），避免消耗过多 token。
NFR4: 可观测性：CLI 需实时打印 Agent 的“思考过程”（Thinking Process）、工具调用与关键上下文，便于 CI/CD 场景定位失败原因。

### Additional Requirements

- **Starter Template（IMPORTANT）**：使用 TypeScript CLI Skeleton（`commander@14` + `tsup`），统一 ESM（`package.json` `type=module`），产物输出到 `dist/`，并通过 `bin.autoqa=dist/cli.js` 暴露 CLI。
- 运行时与依赖版本约束：Node.js `>= 20`；并固定关键依赖版本（Claude Agent SDK、Playwright、Commander、Zod、Pino、remark-parse、TypeScript、Vitest 等）。
- 分层与边界强约束：`src/cli` 只做参数解析与路由；`src/runner` 管生命周期；`src/agent` 集成 SDK/护栏；`src/tools` 封装 Playwright；`src/browser` 截图/创建对象；`src/reporting` 输出。禁止在 CLI/Runner 直接调用 Playwright API。
- 工具错误模型强约束：工具失败不得 `throw` 终止；必须返回统一的 `ToolResult` 结构（`ok/data/error/screenshot`），并映射为 SDK 的 `ToolResult(is_error: true)` 语义。
- 自愈护栏（必须实现）：对 `maxToolCallsPerSpec`、`maxConsecutiveErrors`、`maxRetriesPerStep` 等设置硬上限，触发后应将 spec 标记为失败并给出清晰日志。
- 截图策略强约束：任何“可能改变页面状态”的工具调用前必须截屏；工具/断言失败时必须附带失败截图；截图应压缩以控制 token 成本。
- 执行模型：MVP 单进程按 spec 顺序执行（不做并发）；每个 Markdown 用例文件创建新的 Browser Context；同一次 `autoqa run` 可复用 Browser 实例以降低启动开销。
- 配置文件契约：配置文件固定为 `autoqa.config.json`；字段使用 `camelCase`；必须包含 `schemaVersion`；用 `zod` 进行严格校验与默认值补齐。
- 工具命名规范（注册到 SDK 的 toolName）：动作工具 `navigate/click/fill/scroll/wait`；断言工具 `assertTextPresent/assertElementVisible`；错误 `error.code` 必须可机器处理。
- 交付与 CI 约定：作为 npm 包发布（支持全局安装或 `npx autoqa`）；退出码约定 `0=全部通过`、`1=存在失败`、`2=用户输入/配置错误`。
- 安全与隐私：仅从环境变量读取 `ANTHROPIC_API_KEY` 且不落盘；日志需要脱敏（env/headers/token 相关字段）；截图默认仅在失败/调试模式持久化；输入路径需规范化防止目录穿越。
- 产物与可观测性：建议输出结构化日志（pino）与统一事件流（如 `autoqa.run.started`/`autoqa.tool.called`/`autoqa.spec.finished`）；可选将运行产物落到 `.autoqa/<runId>/`（log、screenshots、transcript）。

### FR Coverage Map

FR1: Epic 1 - 项目初始化 `autoqa init`
FR2: Epic 2 - 执行入口 `autoqa run`（含参数与 URL 指定）
FR3: Epic 2 - Markdown 解析与 Task Context 构建
FR4: Epic 2 - 动作前截图并注入 turn
FR5: Epic 3 - 工具失败/错误回流触发自愈重试（含护栏）
FR6: Epic 2 - 浏览器操作工具集 `navigate/click/fill/scroll/wait`
FR7: Epic 3 - 断言工具 + 断言失败自愈重试
FR8: Epic 4 - 动作 IR 记录与导出
FR9: Epic 4 - 运行时 locator 候选验证与沉淀
FR10: Epic 2 - 结构化快照（AX/ARIA snapshot）
FR11: Epic 2 - Playwright trace 录制与落盘
FR12: Epic 5 - 环境与测试数据配置（多环境 + 账号/密码等）
FR13: Epic 6 - Playwright Test 导出用例的登录态复用/会话持久化
FR14: Epic 2 - Markdown include 可复用步骤库
FR15: Epic 7 - 智能测试规划器核心功能
FR16: Epic 7 - 测试用例智能生成
FR17: Epic 7 - 配置化探索策略

## Epic List

### Epic 1: 零配置上手（项目初始化）
用户完成该 Epic 后可以运行 `autoqa init` 一键生成可运行的项目骨架与示例材料，并清楚如何完成鉴权（若本机已通过 Claude Code 授权则可直接使用 Agent SDK；否则配置 `ANTHROPIC_API_KEY`）。
**FRs covered:** FR1

### Epic 2: 执行闭环（从 Markdown 驱动浏览器完成流程）
用户完成该 Epic 后可以用 `autoqa run` 执行单个 spec 或目录（含 `--headless` / `--debug` / `--url`），Agent 能通过浏览器工具把流程跑起来；每次动作前优先提供结构化快照（AX/ARIA snapshot）作为感知输入、必要时截图兜底；同时录制 trace 作为可回放产物；CLI 输出清晰的过程日志，便于本地与 CI 排障。
**FRs covered:** FR2, FR3, FR4, FR6, FR10, FR11

### Epic 3: 验收判定与自愈闭环（断言 + 失败重试 + 护栏）
用户完成该 Epic 后可以用断言工具自动判定通过/失败；当工具/断言失败时把错误 + 截图回流触发自愈重试；通过护栏避免无限循环与成本失控，保证 CI 结果稳定可控。
**FRs covered:** FR5, FR7

### Epic 4: 沉淀与导出（从自然语言执行到 Playwright Test）
用户完成该 Epic 后可以在 `autoqa run` 跑通自然语言用例后，自动记录可复现的动作 IR（含稳定 locator 候选），并自动导出可在 CI 执行的 `@playwright/test` 用例文件到 `tests/autoqa/`。
**FRs covered:** FR8, FR9

### Epic 5: 环境与测试数据配置（多环境 + 登录凭据等敏感配置）
用户完成该 Epic 后可以用 `.env.<env>`（例如 `.env.test`/`.env.prod`）切换不同环境的 `baseUrl/loginBaseUrl`，并在 Markdown spec 中使用变量占位（例如 `{{BASE_URL}}`/`{{LOGIN_BASE_URL}}`/`{{ENV}}`）而不是写死域名；同时支持将账号/密码等敏感信息放在环境配置中，并避免在 Markdown 用例与日志中直接暴露。
**FRs covered:** FR12

### Story 5.1: 支持通过 `.env.<env>` 配置 `BASE_URL`（登录后站点）
  
  As a QA 工程师,
  I want 在不同环境（test/prod）下通过 `.env.<env>` 提供运行目标站点的 Base URL，
  So that Markdown 用例不需要为每个环境复制一份。
  
  **FRs covered:** FR12

  Tech Spec: `docs/sprint-artifacts/5-1-env-base-url.md`
  
  **Acceptance Criteria:**
  
  **Given** 存在 `.env.test` 且包含 `AUTOQA_BASE_URL`
  **When** 运行 `autoqa run ... --env test`
 **Then** `autoqa run` 应使用该 `AUTOQA_BASE_URL` 作为 `baseUrl`

### Story 5.2: 支持配置 `LOGIN_BASE_URL` 并在 spec 中引用
  
  As a QA 工程师,
  I want 在不同环境下通过 `.env.<env>` 提供 `AUTOQA_LOGIN_BASE_URL` 并在 spec 中通过 `{{LOGIN_BASE_URL}}` 引用，
  So that 登录页跨域/跨环境时也不需要在用例里写死域名。
  
  **FRs covered:** FR12

  Tech Spec: `docs/sprint-artifacts/5-2-env-login-base-url.md`
  
  **Acceptance Criteria:**
  
  **Given** `.env.<env>` 中配置了 `AUTOQA_LOGIN_BASE_URL`
  **When** spec 包含 `Navigate to {{LOGIN_BASE_URL}}/login`
 **Then** 执行时应在解析 spec 前完成模板替换，且 `navigate` 使用替换后的绝对 URL

### Story 5.3: 支持 spec 模板变量（`{{BASE_URL}}`/`{{LOGIN_BASE_URL}}`/`{{ENV}}`）
  
  As a QA 工程师,
  I want 在 Markdown spec 中使用少量受控的模板变量，
  So that 用例可以在多环境下复用并保持可读性。
  
  **FRs covered:** FR12
  
  Tech Spec: `docs/sprint-artifacts/5-3-markdown-template-vars.md`

  **Acceptance Criteria:**
  
  **Given** spec 中包含 `{{BASE_URL}}`、`{{LOGIN_BASE_URL}}`、`{{ENV}}`
  **When** 运行 `autoqa run`
 **Then** 系统应在解析 spec 前将这些变量替换为运行时值
 **And** 当出现未知变量或必需变量缺失时，应以退出码 `2` 失败并给出可理解提示

### Story 5.4: 支持敏感测试数据（账号/密码）从配置注入，避免写入 Markdown
  
  As a QA 工程师,
  I want 将账号/密码等敏感测试数据放在环境配置中，并在 spec 中以占位符引用，
  So that 用例可以提交到仓库而不泄漏敏感信息。
  
  **FRs covered:** FR12

  Tech Spec: `docs/sprint-artifacts/5-4-sensitive-testdata-injection.md`
  
  **Acceptance Criteria:**
  
  **Given** `.env.<env>` 中配置了例如 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD`
  **When** spec 中包含 `Fill the "Username" field with {{USERNAME}}` / `Fill the "Password" field with {{PASSWORD}}`
 **Then** 系统应在执行前完成替换
 **And** 日志脱敏逻辑应避免在结构化日志中明文记录敏感字段（例如 password）

### Story 1.1: Set up initial project from starter template
  
  As a 开源贡献者,
  I want 在仓库中建立可构建/可运行的 TypeScript CLI 骨架（ESM + commander + tsup），
  So that 我可以本地运行 `autoqa` 命令并继续实现后续功能。
  
  **FRs covered:** FR1
  
  **Acceptance Criteria:**
  
  **Given** 开发环境已安装 Node.js `>= 20`
  **When** 运行 `npm run build`
 **Then** 应生成可执行产物 `dist/cli.js`（符合 `bin.autoqa=dist/cli.js` 约定）
 **And** 运行 `node dist/cli.js --help` 可看到帮助信息且进程以退出码 `0` 结束
 ### Story 1.2: 实现 `autoqa init` 生成 `autoqa.config.json`
  
  As a QA 工程师,
  I want 通过 `autoqa init` 自动生成默认的 `autoqa.config.json` 配置文件，
  So that 我无需手写配置即可开始尝试运行 AutoQA。
  
  **FRs covered:** FR1
  
  **Acceptance Criteria:**
  
  **Given** 当前目录不存在 `autoqa.config.json`
  **When** 运行 `autoqa init`
 **Then** 应生成 `autoqa.config.json` 且包含 `schemaVersion` 字段
 **And** 生成的配置文件应可被后续 `autoqa run` 的配置校验逻辑成功读取（格式合法）
 ### Story 1.3: `autoqa init` 创建示例 specs 目录与示例用例
  
  As a QA 工程师,
  I want `autoqa init` 自动创建 `specs/` 目录并生成一个可参考的示例 Markdown 用例，
  So that 我能快速理解“文档即测试”的最低输入规范。
  
  **FRs covered:** FR1
  
  **Acceptance Criteria:**
  
  **Given** 当前目录不存在 `specs/`
  **When** 运行 `autoqa init`
 **Then** 应创建 `specs/` 目录
 **And** 应生成一个示例 spec 文件（例如 `specs/login-example.md`），至少包含 `## Preconditions` 与按序步骤（1. 2. 3.）结构
 ### Story 1.4: `autoqa init` 检查并提示鉴权方式（Claude Code 授权 / `ANTHROPIC_API_KEY`）
  
  As a QA 工程师,
  I want 在运行 `autoqa init` 时得到清晰的鉴权提示（优先使用 Claude Code 已授权的 Agent SDK，否则提示配置 `ANTHROPIC_API_KEY`），
  So that 我不会在后续运行时才发现缺少关键鉴权配置。
  
  **FRs covered:** FR1
  
  **Acceptance Criteria:**
  
  **Given** 本机已通过 Claude Code 授权且 Agent SDK 可直接使用该授权
  **When** 运行 `autoqa init`
 **Then** CLI 应打印清晰提示说明无需配置 `ANTHROPIC_API_KEY` 也可继续使用
 **And** `autoqa init` 仍应完成文件生成（配置与示例）并以退出码 `0` 结束

  **Given** 本机未通过 Claude Code 授权（或 Agent SDK 无法使用该授权）
  **And** 环境变量 `ANTHROPIC_API_KEY` 未设置
  **When** 运行 `autoqa init`
 **Then** CLI 应打印清晰提示说明需要设置 `ANTHROPIC_API_KEY`
 **And** `autoqa init` 仍应完成文件生成（配置与示例）并以退出码 `0` 结束

## Epic 2: 执行闭环（从 Markdown 驱动浏览器完成流程）
 
 用户完成该 Epic 后可以用 `autoqa run` 执行单个 spec 或目录（含 `--headless` / `--debug` / `--url`），Agent 能通过浏览器工具把流程跑起来；每次动作前自动截图并注入 turn；CLI 输出清晰的过程日志，便于本地与 CI 排障。
**FRs covered:** FR2, FR3, FR4, FR6

 
### Story 2.1: 实现 `autoqa run` 的输入参数与 spec 发现
 
 As a 开发者,
 I want 使用 `autoqa run <file-or-dir>` 运行单文件或目录下的 specs，
 So that 我可以把 AutoQA 接入本地与 CI 流程中。
 
 **FRs covered:** FR2
 
 **Acceptance Criteria:**
 
 **Given** 用户传入的路径为一个 Markdown 文件或包含 Markdown 文件的目录
 **When** 运行 `autoqa run <path>`
 **Then** CLI 应识别并以确定性顺序收集要执行的 spec 列表（目录模式）
 **And** 当路径不存在/无可执行 spec 时应以退出码 `2` 失败并给出可理解的错误信息
 
### Story 2.2: 支持 `--headless` / `--debug` / `--url` 参数与运行前校验
 
 As a 开发者,
 I want 在 `autoqa run` 时通过参数控制运行模式与 Base URL，
 So that 我能在 CI 使用无头模式，在本地使用 debug 模式观察执行。
 
 **FRs covered:** FR2
 
 **Acceptance Criteria:**
 
 **Given** 用户运行 `autoqa run`
 **When** 指定 `--headless`
 **Then** Playwright 应以无头模式启动
 **And** 当指定 `--debug` 时应以有头模式启动并输出更详细日志
 
 **Given** 用户运行 `autoqa run` 且未指定 `--debug`
 **When** CLI 解析参数并启动 Playwright
 **Then** Playwright 应默认以无头模式启动（无需显式 `--headless`）
 
 **Given** MVP 不从 Markdown 读取 Base URL
 **When** 用户未提供 `--url`
 **Then** `autoqa run` 应以退出码 `2` 失败并提示必须提供 Base URL
 
### Story 2.3: 解析 Markdown spec（Preconditions + 步骤 + 断言语句）
 
 As a QA 工程师,
 I want 用自然的 Markdown（前置条件 + 有序步骤 + 预期结果）描述验收流程，
 So that 我无需编写指令式脚本也能驱动自动化验收。
 
 **FRs covered:** FR3
 
 **Acceptance Criteria:**
 
 **Given** 一个符合最低结构的 Markdown spec（包含 `## Preconditions` 与有序列表步骤）
 **When** `autoqa run` 读取并解析该 spec
 **Then** 系统应抽取前置条件与步骤列表，生成结构化的 Task Context（可用于 Agent 推理）
 **And** 当 Markdown 不满足最低结构时，应以退出码 `2` 失败并指出缺失的结构元素
 
### Story 2.10: 支持 include 可复用步骤库（例如 `include: login`）

**FRs covered:** FR14

Tech Spec: `docs/sprint-artifacts/2-10-markdown-include-reusable-step-library.md`

### Story 2.4: 实现 Runner（按 spec 生命周期创建 Browser/Context/Page）
 
 As a 开发者,
 I want Runner 按 spec 隔离浏览器上下文并稳定执行，
 So that 多个 spec 的运行结果可重复且互不污染（cookie/session 隔离）。
 
 **FRs covered:** FR2
 
 **Acceptance Criteria:**
 
 **Given** `autoqa run` 需要执行多个 specs
 **When** Runner 逐个执行 specs
 **Then** 每个 spec 都应创建新的 Browser Context 并在结束后正确释放资源
 **And** 同一次 `autoqa run` 应可复用同一个 Browser 实例以降低启动开销（满足启动性能目标的实现方向）
 
### Story 2.5: 实现 Playwright 动作工具（`navigate/click/fill/scroll/wait`）并返回 ToolResult
 
 As a QA 工程师,
 I want Agent 能通过标准工具调用驱动浏览器完成操作，
 So that 流程可以由模型“观察-思考-行动”循环自动推进。
 
 **FRs covered:** FR5, FR6
 
 **Acceptance Criteria:**
 
 **Given** Agent 调用 `navigate/click/fill/scroll/wait` 任一工具
 **When** 底层 Playwright 操作成功
 **Then** 工具应返回 `{ ok: true, data: ... }` 的 ToolResult
 **And** 当 Playwright 抛出错误时工具不得 `throw` 终止进程，而应返回 `{ ok: false, error: { code, message, retriable } }` 的 ToolResult
 
 **Given** Agent 调用 `click(target_description)` 或 `fill(target_description, text)` 且 `target_description` 为语义描述（例如“蓝色登录按钮”）
 **When** 工具执行元素定位并尝试完成点击/填表
 **Then** 工具应支持基于语义描述定位目标元素并完成对应操作
 **And** 当无法定位目标元素时应返回 `{ ok: false, error: { code, message, retriable } }` 且 `error.code` 可机器处理
 
### Story 2.6: 动作前自动截图并注入 Agent turn（含压缩）
 
 As a QA 工程师,
 I want 在每次浏览器动作前自动截图并作为视觉上下文提供给模型，
 So that 模型可以“看着页面”做更稳健的点击/填表决策。
 
 **FRs covered:** FR4
 
 **Acceptance Criteria:**
 
 **Given** Agent 即将调用任一可能改变页面状态的动作工具（如 `click`/`fill`/`navigate`）
 **When** 工具被执行
 **Then** 系统应在工具执行前捕获当前页面截图并注入到当前 turn
 **And** 截图应经过压缩/降采样以控制 token 成本（例如固定宽度近似 1024px 或等效策略）
 
### Story 2.7: 运行日志与可观测性（控制台输出 + 结构化字段）
 
 As a 开发者,
 I want `autoqa run` 输出清晰且可追踪的运行日志（包含 spec/步骤/工具/错误上下文），
 So that 我能在本地与 CI 中快速定位失败原因。
 
 **FRs covered:** FR2
 
 **Acceptance Criteria:**
 
 **Given** 正在执行一个 spec
 **When** 发生工具调用或错误
 **Then** CLI 应输出包含 `runId/specPath/stepIndex/toolName` 等关键字段的日志
 **And** 日志应能区分用户输入/配置错误（退出码 `2`）与测试失败（退出码 `1`）

### Story 2.8: 生成并落盘结构化页面快照（AX/ARIA snapshot）

As a QA 工程师,
I want 在 spec 执行过程中按需生成结构化页面快照（AX/ARIA snapshot）并落盘归档，
so that 我可以用更低成本的结构化信息辅助定位/自愈与排障。

**FRs covered:** FR10

 Tech Spec: `docs/sprint-artifacts/ts-2-8-2-9-ax-aria-snapshot-playwright-trace.md`

**Acceptance Criteria:**

**Given** 正在执行某个 spec
**When** 系统采集结构化快照
**Then** 应产出可读的文本表示（例如 YAML/等价格式）并与本次 run 绑定落盘（例如归档到 `.autoqa/<runId>/snapshots/`）

**Given** 工具执行失败或发生多次重试
**When** `autoqa run` 输出失败上下文
**Then** CLI 应输出结构化快照产物路径，便于快速定位页面结构变化

### Story 2.9: Runner 按 spec 生命周期录制 Playwright trace 并保留

As a 开发者,
I want Runner 在 spec 生命周期内录制 Playwright trace 并将其作为运行产物保留，
so that 我可以回放整个执行过程来复现与定位问题，并提升导出与自愈阶段的可调试性。

**FRs covered:** FR11

 Tech Spec: `docs/sprint-artifacts/ts-2-8-2-9-ax-aria-snapshot-playwright-trace.md`

**Acceptance Criteria:**

**Given** Runner 开始执行一个 spec
**When** 启用 trace 录制
**Then** 应在 spec 生命周期内开始/停止 trace，并生成 trace 产物文件与本次 run 绑定落盘（例如 `.autoqa/<runId>/traces/<specName>.zip`）

**Given** spec 执行结束
**When** `autoqa run` 输出汇总
**Then** CLI 应输出 trace 产物路径（若生成成功）
**And** trace 产物应可用 Playwright Trace Viewer 打开进行回放
 
## Epic 3: 验收判定与自愈闭环（断言 + 失败重试 + 护栏）
 
 用户完成该 Epic 后可以用断言工具自动判定通过/失败；当工具/断言失败时把错误 + 截图回流触发自愈重试；通过护栏避免无限循环与成本失控，保证 CI 结果稳定可控。
 
### Story 3.1: 实现断言工具（`assertTextPresent` / `assertElementVisible`）
 
 As a QA 工程师,
 I want 用断言描述“预期结果”，
 So that 系统可以自动判断验收是否通过。
 
 **FRs covered:** FR7
 
 **Acceptance Criteria:**
 
 **Given** Agent 调用 `assertTextPresent(text)`
 **When** 页面包含目标文本
 **Then** 断言应返回 `ok: true`
 **And** 当页面不包含目标文本时应返回 `ok: false` 且带有可机器处理的 `error.code`
 
 **Given** Agent 调用 `assertElementVisible(description)`
 **When** 页面存在并可见目标元素
 **Then** 断言应返回 `ok: true`
 **And** 当元素不存在/不可见时应返回 `ok: false` 且可被自愈机制识别为可重试（若适用）
 
### Story 3.2: 工具/断言失败回流到 Agent SDK 触发自愈重试
 
 As a QA 工程师,
 I want 当工具或断言失败时系统不要立刻中断，而是把错误与截图回流给模型继续推理，
 So that 模型可以尝试替代方案完成同一目标步骤。
 
 **FRs covered:** FR5, FR7
 
 **Acceptance Criteria:**
 
 **Given** 任一动作工具或断言返回 `ok: false`
 **When** Runner 将结果反馈给 Claude Agent SDK
 **Then** 反馈必须以 `is_error: true` 的语义让 SDK 进入下一轮推理
 **And** 反馈中应包含错误信息与（若可用）失败截图，供模型定位与修正
 
### Story 3.3: 自愈护栏（maxToolCalls/maxConsecutiveErrors/maxRetriesPerStep）
 
 As a 开发者,
 I want 为自愈与重试设置硬上限，
 So that CI 不会因为无限重试而卡死或成本失控。
 
 **FRs covered:** FR5
 
 **Acceptance Criteria:**
 
 **Given** 单个 spec 正在运行
 **When** 工具调用次数超过 `maxToolCallsPerSpec`（或等效配置）
 **Then** 该 spec 应被标记为失败并停止继续调用工具
 **And** 当连续错误次数或单步骤重试次数超过上限时也应触发同样的失败终止逻辑，并输出清晰日志说明触发了哪个护栏
 
### Story 3.4: 失败产物与退出码（CI 友好）
 
 As a 开发者,
 I want 在失败时得到可定位问题的最小产物与稳定退出码，
 So that AutoQA 可以可靠地作为 CI 的质量门禁。
 
 **FRs covered:** FR2
 
 **Acceptance Criteria:**
 
 **Given** 运行结果全部通过
 **When** `autoqa run` 结束
 **Then** 进程应以退出码 `0` 结束并输出通过汇总
 
 **Given** 存在断言失败或护栏触发导致的失败
 **When** `autoqa run` 结束
 **Then** 进程应以退出码 `1` 结束并输出失败汇总
 **And** 至少保留与失败相关的截图/日志信息（持久化策略可默认仅失败/调试模式）

## Epic 4: 沉淀与导出（从自然语言执行到 Playwright Test）

用户完成该 Epic 后可以在 `autoqa run` 跑通自然语言用例后，自动记录可复现的动作 IR（含稳定 locator 候选），并自动导出可在 CI 执行的 `@playwright/test` 用例文件到 `tests/autoqa/`。

### Story 4.1: 运行时生成并验证 locator 候选，并写入动作 IR

As a QA 工程师,
I want 在 Agent 成功完成 click/fill 等动作后自动生成并验证稳定 locator 候选，并把结果记录到结构化动作 IR 中，
so that 后续可以稳定导出可维护的 Playwright 测试代码，而不是依赖一次性会话内的 `ref`。

**FRs covered:** FR8, FR9

 Tech Spec: `docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md`

**Acceptance Criteria:**

**Given** Agent 通过工具成功执行一次 `click(target_description)` 或 `fill(target_description, text)`
**When** 工具返回 `ok: true`
**Then** 系统必须为“实际命中的元素”生成多种 locator 候选（优先稳定定位方式，如 testId/role/label/placeholder/id 等）
**And** 对每个候选进行无副作用验证（至少包含唯一性与可用性校验）
**And** 仅将验证通过的候选写入动作 IR（按优先级排序）

**Given** 某个 locator 候选验证失败
**When** 系统筛选候选池
**Then** 该候选不得被写入 IR
**And** 不得因此中断 spec 执行（只记录验证失败摘要用于调试）

**Given** 任一动作被记录到 IR
**When** spec 执行结束
**Then** IR 产物应与本次 run 绑定（例如按 `runId` 归档），并可用于后续导出与回放

### Story 4.2: `autoqa run` 结束后自动导出 `@playwright/test` 用例到 `tests/autoqa/`

As a QA 工程师,
I want 在 `autoqa run` 成功跑通用例后自动导出可运行的 `@playwright/test` `.spec.ts` 文件到 `tests/autoqa/`，
so that 我可以把通过的用例沉淀为稳定的回归测试并接入 CI。

**FRs covered:** FR8

 Tech Spec: `docs/sprint-artifacts/ts-4-1-4-2-runtime-locator-validation-ir-auto-export-playwright-test.md`

**Acceptance Criteria:**

**Given** `autoqa run` 完成执行且至少产生一条动作 IR（包含通过验证的 locator 候选）
**When** Runner 结束本次 spec
**Then** 系统应自动在 `tests/autoqa/` 生成对应的 `@playwright/test` 文件（按 spec 文件名或等效规则命名）

**Given** spec 中包含断言步骤
**When** 生成 `@playwright/test` 代码
**Then** 生成的 `expect(...)` 断言必须仅来源于 spec 的断言步骤
**And** 禁止从运行时观察/页面内容“自动发明”断言

**Given** 导出的测试文件被执行
**When** 使用 Playwright Test 运行该文件
**Then** 测试应不依赖 Agent、不依赖会话内 `ref`，仅依赖导出的稳定 locator 与显式断言

### Story 4.3: 在 IR 中记录 `navigate` 的占位符语义（`urlValue`/`navigateValue`），导出时优先使用

As a QA 工程师,
I want `navigate` 动作在写入 IR 时保留“占位符语义”（例如 `{{LOGIN_BASE_URL}}/v3/login/`）而不仅是最终的绝对 URL，
So that 导出 `@playwright/test` 时可以统一使用 `getEnvVar('AUTOQA_...')` 读取环境变量，而不是依赖 raw spec 解析或额外透传多个 baseUrl 参数。

**FRs covered:** FR8, FR12

**Design Notes:**

- 新增结构化字段（示例命名）：`toolInput.urlValue`（或 `navigateValue`），用于表达 URL 的来源
- 支持最小可用格式（覆盖当前主要用例）：
  - `template_var`: `{ kind: 'template_var', name: 'LOGIN_BASE_URL', suffix: '/v3/login/' }`
  - `literal`: `{ kind: 'literal', value: 'https://example.com/path' }`
- 可选扩展（后续迭代）：支持多个变量拼接（template string）或更复杂的 URL 组合
- 保持向后兼容：旧 IR 只有 `toolInput.url` 的情况下，导出仍可 fallback（例如继续使用 rawSpecContent 或 absolute url）

**Acceptance Criteria:**

**Given** spec 中存在步骤 `Navigate to {{LOGIN_BASE_URL}}/v3/login/`
**When** `autoqa run` 执行该步骤并写入 IR
**Then** `navigate` 的 IR 记录必须包含结构化 `urlValue={ kind: 'template_var', name: 'LOGIN_BASE_URL', suffix: '/v3/login/' }`
**And** 仍可保留 `toolInput.url`（最终绝对 URL）用于调试与回放

**Given** 运行结束后导出 `@playwright/test`
**When** exporter 处理该 `navigate` 记录
**Then** 生成的代码必须使用 `const loginBaseUrl = getEnvVar('AUTOQA_LOGIN_BASE_URL')`
**And** 使用 `await page.goto(new URL('/v3/login/', loginBaseUrl).toString())`，而不是写死域名

**Given** spec 中存在步骤 `Navigate to {{SOME_BASE_URL}}/path`
**When** 执行并导出
**Then** 导出的代码必须声明 `const some_base_url = getEnvVar('AUTOQA_SOME_BASE_URL')`
**And** 使用 `new URL('/path', some_base_url)` 拼接导航

**Given** 用户使用旧版本产生的 IR（没有 `urlValue`）
**When** exporter 读取该 IR
**Then** 导出流程必须保持可用（不因缺少 `urlValue` 而失败），并采用既有 fallback 策略生成可执行代码


## Epic 6: 导出用例的登录态复用与执行加速（Playwright Test Suite Optimization）

用户完成该 Epic 后，运行 `@playwright/test` 导出的用例时可在**同一次 run** 内复用登录态（避免每个用例重复登录），同时保留默认的隔离性（每用例独立 context）。是否启用登录态复用由 Markdown spec 的 `## Preconditions` 声明驱动；登录用例本身不使用预置登录态。

**FRs covered:** FR13

## Epic 7: Agent 驱动智能测试规划器（基于 snapshot 的自动化测试计划生成）

用户完成该 Epic 后，可以使用 `autoqa plan` 命令，让 Claude Agent 在浏览器中主动探索应用（基于 screenshot + AX/ARIA snapshot 等统一感知输入），自动理解页面结构与典型业务流，并直接生成符合 AutoQA 规范的 Markdown 测试用例。探索逻辑、测试类型选择、页面理解等“业务智能”主要由 Agent 负责，而不是写死在 TypeScript 代码中，从而减少针对特定页面/应用写补丁的需求。

**FRs covered:** FR15, FR16, FR17

### Story 7.1: Agent 驱动的应用探索 Session（`autoqa plan explore`）

As a QA 工程师,
I want 使用 `autoqa plan explore` 触发一个由 Agent 驱动的探索 Session,
So that Agent 可以基于页面 snapshot 主动决定去哪儿看、看什么，并沉淀成可复用的应用结构视图。

**FRs covered:** FR15

Tech Spec: `docs/sprint-artifacts/7-1-app-exploration-engine.md`

**Acceptance Criteria:**

**Given** 提供了应用 URL
**When** 运行 `autoqa plan explore -u https://example.com -d 3`
**Then** 探索过程中的导航/点击/等待等具体动作均由 Agent 通过浏览器工具调用驱动
**And** TypeScript 代码仅提供 `navigate/click/fill/scroll/wait/snapshot` 等基础工具，不再硬编码页面特定的探索逻辑
**And** 每次 Agent 请求观察页面时，系统都会生成与 `autoqa run` 一致格式的 snapshot（至少包含 screenshot + AX/ARIA snapshot + URL + 标题）

**Given** 探索结束
**When** 查看 `.autoqa/runs/<runId>/plan-explore/`
**Then** 至少包含：
  - `explore-graph.json`：页面节点 + 导航关系
  - `explore-elements.json`：每个页面的交互元素清单
  - `explore-transcript.jsonl`：Agent 探索过程的工具调用与思考摘要
**And** 这些产物可作为 Story 7.2 用例生成器的直接输入

**Given** 应用需要登录
**When** 通过配置或参数提供登录入口与凭据占位符
**Then** Agent 应能在探索早期完成登录步骤，并在同一 Browser Context 中继续后续页面探索
**And** 登录失败时应以退出码 `1` 结束，并在日志与探索产物中附带 snapshot 与错误说明

### Story 7.2: Agent 驱动的智能测试用例生成器

As a QA 工程师,
I want 基于探索结果和关键页面 snapshot，让 Agent 自动生成覆盖主要业务流和边界场景的 Markdown 测试用例,
So that 我可以快速获得高质量的测试计划，而不需要为每种页面类型写规则引擎。

**FRs covered:** FR16

Tech Spec: `docs/sprint-artifacts/7-2-intelligent-test-case-generator.md`

**Acceptance Criteria:**

**Given** 已完成一次 `autoqa plan explore` 并生成探索产物
**When** 触发用例生成流程（例如 `autoqa plan generate` 或 `autoqa plan --generate`）
**Then** TypeScript 代码仅负责将 `explore-graph`、关键页面 snapshot 及 `PlanConfig` 作为上下文传递给 Agent
**And** 具体哪些页面需要哪些测试类型（功能/表单/导航/响应式/边界/安全性）由 Agent 决策，而不是在 TypeScript 中硬编码规则

**Given** 用例生成完成
**When** 查看 `.autoqa/runs/<runId>/plan/specs/`
**Then** 每个生成的用例文件必须：
  - 符合 AutoQA Markdown 结构（包含 `## Preconditions` 与有序步骤列表）
  - 使用自然语言步骤 + 明确的“预期结果/断言”描述
  - 不直接写死敏感数据，而是通过占位符（如 `{{USERNAME}}`）引用

**Given** 探索结果中包含表单页面/导航菜单/响应式布局线索
**When** 生成测试计划
**Then** 生成的用例至少覆盖：
  - 基础功能测试（页面访问、元素交互）
  - 表单测试（成功提交、验证失败、必填字段）
  - 导航测试（内部链接、菜单流转）
  - 响应式测试（通过 Agent 推理给出 viewport 建议）
  - 边界条件测试（长文本、快速操作、网络延迟）
  - 基础安全性测试（至少包含 XSS 输入场景）

### Story 7.3: `autoqa plan` 命令编排（探索 + 规划 + 用例生成）

As a QA 工程师,
I want 使用 `autoqa plan` 命令一键完成“探索 + 规划 + 用例生成”,
So that 我可以在不同项目上快速得到可直接执行的测试计划。

**FRs covered:** FR15, FR16, FR17

Tech Spec: `docs/sprint-artifacts/7-3-plan-command-implementation.md`

**Acceptance Criteria:**

**Given** 需要为应用生成测试计划
**When** 运行 `autoqa plan -u https://example.com`
**Then** CLI 应按顺序触发：
  - Story 7.1 定义的 Agent 探索 Session
  - Story 7.2 定义的用例生成流程
**And** 运行结束后在 `.autoqa/runs/<runId>/plan/` 下产生探索产物、规划产物与生成的 Markdown specs

**Given** 存在 `autoqa.config.json` 中的 `plan` 配置段
**When** 运行 `autoqa plan`
**Then** CLI 应从配置中读取基础参数（如 `baseUrl`、`maxDepth`、test types）并传递给 orchestrator 与 Agent
**And** 日志中有清晰的阶段划分（explore/generate），便于排障与性能分析

**Given** 探索或生成过程中触发 guardrail（如 `maxAgentTurnsPerRun` 或 `maxSnapshotsPerRun`）
**When** 本次 `autoqa plan` 结束
**Then** 应以退出码 `1` 结束（表示规划不完整），并在总结产物中标记被 guardrail 截断的原因

### Story 7.4: 配置化探索与生成策略

As a QA 工程师,
I want 通过配置文件与命令行参数自定义探索和测试生成规则,
So that 我可以根据不同项目的需求调整规划器的行为与覆盖范围。

**FRs covered:** FR17

Tech Spec: `docs/sprint-artifacts/7-4-configurable-exploration-strategy.md`

**Acceptance Criteria:**

**Given** 需要定制探索行为
**When** 创建 `autoqa.planner.config.json` 或在 `autoqa.config.json` 中新增 `plan` 段
**Then** 至少支持配置：
  - 探索深度 `maxDepth` 与最大页面数 `maxPages`
  - URL 包含/排除模式（如 `/admin/*`、`/api/*`）
  - 需要启用的测试类型集合（功能/表单/导航/响应式/边界/安全性）
  - 登录/认证相关配置（登录 URL、凭据占位符等）

**Given** 同时提供配置文件和命令行参数
**When** 运行 `autoqa plan ...`
**Then** 命令行参数应优先于配置文件中的对应设置
**And** 最终生效的合并配置应被记录到本次 run 的总结产物中（例如 `plan-summary.json`）

### Story 7.5: 与现有执行/导出工具链的集成

As a 开发者,
I want 生成的测试计划可以直接作为 `autoqa run` 与 Epic 4 导出流水线的上游输入,
So that 规划、执行与导出 Playwright Test 可以无缝衔接。

**FRs covered:** FR15, FR16

Tech Spec: `docs/sprint-artifacts/7-5-integration-with-existing-toolchain.md`

**Acceptance Criteria:**

**Given** 使用 `autoqa plan` 生成了测试计划（若干 Markdown specs）
**When** 运行 `autoqa run <生成的目录或文件>`
**Then** 应无需修改即可执行，且执行模型与手写 spec 完全一致（同样支持截图、自愈、IR 记录与 Playwright Test 导出）

**Given** 生成的 spec 中使用了模板变量与环境变量（例如 `{{BASE_URL}}`、`{{LOGIN_BASE_URL}}`、`{{USERNAME}}`）
**When** 通过 Epic 5 配置的环境变量运行 `autoqa run`
**Then** 变量替换与登录态复用等行为应与手写 spec 保持一致
**And** Epic 6 中关于登录态复用的约束同样适用于规划生成的用例

### Story 6.1: 生成并复用 storageState（登录一次）

As a QA 工程师,
I want 在运行 Playwright 测试前自动完成一次登录并生成 `storageState` 文件，
So that 后续需要登录态的用例可以直接复用该状态而不是每条用例都重新登录。

**Acceptance Criteria:**

**Given** 已配置 `AUTOQA_BASE_URL`、`AUTOQA_USERNAME`、`AUTOQA_PASSWORD`
**When** 运行 `npx playwright test`
**Then** 测试框架应在 run 开始前生成可复用的 `storageState` 文件（例如存放于 `tests/autoqa/.auth/storageState.json` 或等效路径）
**And** 生成过程应包含一次真实登录流程，并在失败时给出可定位的错误信息（包含失败步骤与建议）

### Story 6.2: 用例可声明是否需要登录态（默认可控）

As a QA 工程师,
I want 在 Markdown spec 的 `## Preconditions` 通过严格格式声明是否需要登录态（`Auth: required|none`），
So that Preconditions 不再只是文案，而是会影响导出用例的执行策略（是否启用 `storageState`）。

**Acceptance Criteria:**

**Given** 某个 spec 的 Preconditions 包含一条列表项 `Auth: required`
**When** 该 spec 被导出为 `@playwright/test`
**Then** 导出的 `.spec.ts` 应启用预置 `storageState`

**Given** 某个 spec 的 Preconditions 包含一条列表项 `Auth: none`
**When** 该 spec 被导出为 `@playwright/test`
**Then** 导出的 `.spec.ts` 不应加载 `storageState`，并以未登录状态启动

**Given** 某个 spec 的 Preconditions 中存在 `Auth:` 但值不是 `required` 或 `none`
**When** 该 spec 被导出为 `@playwright/test`
**Then** 导出应失败并给出可理解的错误信息（指出非法值与允许值）

### Story 6.3: 登录用例例外（必须在未预置登录态下运行）

As a QA 工程师,
I want 专门验证“登录流程”的用例不使用预置登录态，
So that 登录功能本身能被真实验证（而不是被缓存状态绕过）。

**Acceptance Criteria:**

**Given** 用例为“登录流程验证”类型（例如 spec 名称/标签/元数据声明为 login）
**When** 运行该用例
**Then** 测试必须在未登录状态开始，并显式执行登录步骤
**And** 用例完成后应验证登录成功的可观察结果（例如跳转/页面元素/文案）

## Epic 8: Planner 输出质量与 URL Scope 控制

用户完成该 Epic 后，可以在保留 Epic 7 智能规划能力的基础上，进一步获得：
- 聚焦指定起始 URL（页面/模块）的探索与用例规划能力；
- 与手写示例一致、可直接由 `autoqa run` 执行的 Markdown 测试用例；
- 更系统的用例质量标准（包含 Happy path、边界/负例、起始状态与成功标准），并在合适场景复用 `include:` 步骤库。

**FRs covered:** FR15, FR16, FR17

Tech Spec: `docs/sprint-artifacts/ts-8-1-8-3-plan-scope-and-executable-specs.md`

### Story 8.1: 规划生成的 Markdown 用例可直接执行

As a QA 工程师,
I want `autoqa plan` / `autoqa plan-explore` + `autoqa plan-generate` 生成的 Markdown 用例在结构和风格上与手写示例保持一致,
So that 我可以直接用 `autoqa run` 执行这些用例而无需手工重写。

**FRs covered:** FR16

Tech Spec: `docs/sprint-artifacts/ts-8-1-8-3-plan-scope-and-executable-specs.md`

### Story 8.2: 探索与测试计划围绕指定 URL Scope 聚焦

As a QA 工程师,
I want 通过配置 URL Scope（包含/排除模式与探索范围模式）控制 Planner 只围绕我关心的页面或模块生成测试计划,
So that 在大型控制台或多模块应用中，`autoqa plan` 不会把时间和成本浪费在与当前目标无关的区域。

**FRs covered:** FR15, FR17

Tech Spec: `docs/sprint-artifacts/ts-8-1-8-3-plan-scope-and-executable-specs.md`

### Story 8.3: Planner 提示词与用例质量标准增强

As a QA 工程师,
I want Planner 在生成测试计划时自动考虑 Happy path、边界/负例场景、起始状态与成功标准，并在适当场景复用 `include:` 步骤库,
So that 产生的用例既具备自动化可执行性，又符合资深测试工程师的用例质量标准。

**FRs covered:** FR15, FR16

Tech Spec: `docs/sprint-artifacts/ts-8-1-8-3-plan-scope-and-executable-specs.md`

## Epic 9: 交互式修复模式（Interactive Repair Mode）

用户完成该 Epic 后，当 `autoqa run` 导出失败（由于缺少 `chosenLocator`）时，系统可以自动启动交互式修复模式：通过 Playwright 重放 IR 到失败步骤，允许用户在真实页面上选择元素生成新的 locator，或继续手动操作完成测试，最终保存修复结果并重新导出。

**FRs covered:** 延续 FR8, FR9（增强 IR 导出的健壮性）

### Story 9.1: 导出失败时自动启动交互式修复模式

As a QA 工程师,
I want 当 `autoqa run` 导出失败时，系统自动启动交互式修复模式而不是直接报错退出,
So that 我可以在不重启的情况下直接修复失败的 locator，而不是手动修改代码或重新运行整个测试。

**FRs covered:** FR8, FR9

Tech Spec: `docs/sprint-artifacts/epic-9-interactive-repair-mode.md`

**Acceptance Criteria:**

**Given** `autoqa run` 执行完成但导出失败（由于某些步骤缺少 `chosenLocator`）
**When** 系统检测到导出失败
**Then** 应自动启动交互式修复模式（而非直接报错退出）
**And** 应输出清晰的提示说明进入修复模式

**Given** 进入交互式修复模式
**When** 用户确认启动修复
**Then** 系统应启动一个有头浏览器（`headless: false`）
**And** 应读取 IR 文件中失败的步骤信息

### Story 9.2: 自动重放 IR 到失败步骤

As a QA 工程师,
I want 修复模式自动重放 IR 中成功的步骤到失败点,
So that 我可以在正确的页面状态下进行修复，而不需要手动登录或导航到目标页面。

**FRs covered:** FR8

Tech Spec: `docs/sprint-artifacts/epic-9-interactive-repair-mode.md`

**Acceptance Criteria:**

**Given** IR 中有步骤 1-5 成功（有 `chosenLocator`），步骤 6 失败（缺少 `chosenLocator`）
**When** 启动修复模式
**Then** 系统应自动执行步骤 1-5 到达步骤 6 的前置状态
**And** 执行应使用 IR 中记录的 `chosenLocator` 或 `toolInput`

**Given** 某个步骤在重放时失败（例如页面结构变化导致 locator 失效）
**When** 重放无法继续
**Then** 系统应暂停并提示用户手动操作到目标状态
**And** 应显示失败的步骤信息和建议

**Given** IR 中从第一个步骤就缺少 `chosenLocator`
**When** 启动修复模式
**Then** 系统应尝试使用 IR 中记录的 `pageUrl` 直接导航到失败页面
**And** 应提示用户可能需要手动登录或准备状态

### Story 9.3: 页面元素选择器（Element Picker）

As a QA 工程师,
I want 在修复模式下通过点击页面上的元素来生成 Playwright locator,
So that 我不需要手动编写 selector 就能获得准确的定位器。

**FRs covered:** FR9

Tech Spec: `docs/sprint-artifacts/epic-9-interactive-repair-mode.md`

**Acceptance Criteria:**

**Given** 修复模式已启动且页面处于正确状态
**When** 用户启用元素选择模式
**Then** 鼠标悬停在元素上时应显示红色高亮边框
**And** 应显示元素的简短信息（tagName、text、role 等）

**Given** 用户点击页面上的某个元素
**When** 元素被选中
**Then** 系统应生成多个 Playwright locator 候选（按优先级排序）
**And** 应实时验证每个候选的唯一性（`count === 1`）
**And** 应在终端/控制台显示候选列表和验证结果

**Given** 生成的 locator 候选
**When** 显示候选列表
**Then** 应按优先级排序（data-testid > role+name > id > text > class > tag）
**And** 应标记每个候选是否唯一（✅ 唯一 / ⚠️ N 个匹配）

### Story 9.4: 保存修复结果并重新导出

As a QA 工程师,
I want 在修复完成后保存修复结果并自动重新导出测试代码,
So that 修复可以被持久化，且不需要手动重新运行整个测试。

**FRs covered:** FR8, FR9

Tech Spec: `docs/sprint-artifacts/epic-9-interactive-repair-mode.md`

**Acceptance Criteria:**

**Given** 用户通过元素选择器选择了目标元素
**When** 用户确认使用某个 locator 候选
**Then** 系统应将修复保存到 `repairs.json` 文件（与 IR 同目录）
**And** 修复记录应包含：`runId`、`specPath`、`stepIndex`、`chosenLocator`

**Given** 修复已保存
**When** 重新执行导出流程
**Then** 导出器应优先使用 `repairs.json` 中的 `chosenLocator`
**And** 应生成完整的 `@playwright/test` 文件

**Given** 导出成功
**When** 修复模式结束
**Then** 应输出导出成功的提示和文件路径
**And** 应以退出码 `0` 结束（表示修复成功）

### Story 9.5: 支持用户手动继续操作（Manual Continuation）

As a QA 工程师,
I want 在修复模式下除了选择元素外，也可以继续手动执行剩余步骤,
So that 当自动重放失败或页面状态复杂时，我仍可以完成测试并生成导出代码。

**FRs covered:** FR8

Tech Spec: `docs/sprint-artifacts/epic-9-interactive-repair-mode.md`

**Acceptance Criteria:**

**Given** 重放无法自动继续（例如步骤 6 缺少 locator 且无法恢复）
**When** 用户选择手动模式
**Then** 系统应允许用户在浏览器中手动完成剩余操作
**And** 应监听用户的页面操作并记录到 IR

**Given** 用户手动完成了测试流程
**When** 用户触发"完成修复"
**Then** 系统应将手动操作的步骤追加到 IR
**And** 应生成包含手动步骤的完整导出代码

**Given** 用户在手动模式下填写了表单字段（如用户名、密码）
**When** 记录到 IR
**Then** 敏感字段应使用模板变量占位符（如 `{{USERNAME}}`）而非明文
**And** 导出的代码应引用环境变量

### Story 9.6: CLI 命令入口（`autoqa repair`）

As a QA 工程师,
I want 可以通过单独的 `autoqa repair` 命令启动修复模式,
So that 我不需要重新运行整个测试就可以修复之前失败的导出。

**FRs covered:** FR8, FR9

Tech Spec: `docs/sprint-artifacts/epic-9-interactive-repair-mode.md`

**Acceptance Criteria:**

**Given** 之前有一次运行（runId）导出失败
**When** 运行 `autoqa repair --runId <runId>`
**Then** 系统应读取该 run 的 IR 文件
**And** 应启动修复模式（与 Story 9.1-9.5 相同的流程）

**Given** 多个 spec 需要修复
**When** 运行 `autoqa repair --runId <runId> --spec <specPath>`
**Then** 系统应仅修复指定的 spec
**And** 其他 spec 不受影响

**Given** 某个步骤有修复记录（`repairs.json` 中已存在）
**When** 启动修复模式
**Then** 系统应显示已有的修复记录
**And** 应允许用户覆盖或保留原有修复
