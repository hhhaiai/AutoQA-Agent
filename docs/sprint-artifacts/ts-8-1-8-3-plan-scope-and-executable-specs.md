# Epic 8: Planner 输出质量与 URL Scope 控制 - Tech Spec（Story 8.1–8.3）

Status: draft

## 1. 背景与目标

### 1.1 背景

在 Epic 7 与 `ts-7-agent-based-intelligent-planner.md` 中，我们已经实现：

- `autoqa plan-explore`：由 Agent 驱动的应用探索 Session，产出 `ExplorationGraph` 等探索产物。
- `autoqa plan-generate`：基于探索产物和 PlanConfig 生成结构化 `TestPlan` 与 Markdown specs。
- `autoqa plan`：顶层命令，按顺序完成“探索 + 用例生成”（内部通过 orchestrator 调用 explore + generate）。

当前 Planner 已经可以在多数站点上生成可读性较好的用例，但在真实项目（例如 Polyv 控制台）中暴露出两类问题：

- 探索范围过宽：即使用户在 CLI 中通过 `-u` 参数指定了频道列表页，Explore Agent 仍会根据全站导航结构访问大量不相关模块（例如回放、统计等）。
- Markdown spec 不可执行：Planner 输出的 Markdown 用例缺乏具体 URL 与可执行的步骤语义，`autoqa run` 无法直接消费，需要额外人工改写。

### 1.2 Goals

- **G1：可执行性**  
  确保 `autoqa plan` / `autoqa plan-explore` + `autoqa plan-generate` 生成的 Markdown specs 与手写用例（如 Polyv/SauceDemo 示例）保持一致的结构与风格，并可被 `autoqa run` 直接执行。

- **G2：Scope 聚焦**  
  在不破坏现有默认行为的前提下，引入 URL scope 概念与配置，让探索和计划可以“围绕指定起始 URL 页面及其相关模块”聚焦，而不是在整个站点任意游走。

- **G3：Planner 质量增强**  
  从 QA/UX 视角补强 Planner 提示词与输出约束：包含 Happy path、边界/负例场景、清晰的起始状态与成功标准，并在合适场景复用现有步骤库（`include:`）。

### 1.3 Non-goals

- 不重新设计 Markdown spec 语法；输出必须兼容现有 `autoqa run` 解析与执行逻辑。
- 不变更 `autoqa run` 的执行模型与 CLI 约定。
- 不引入新的外部依赖或复杂规则引擎；探索与测试类型分配仍主要由 Agent 决策。

---

## 2. 用户可见行为（CLI 视角）

### 2.1 命令一览（修正说明）

本 Tech Spec 在描述 Planner 行为时，仅使用以下 **三个顶层 CLI 命令**：

- **`autoqa plan-explore`**  
  - 功能：执行 Agent 驱动的探索 Session，产出 `.autoqa/runs/<runId>/plan-explore/*`。

- **`autoqa plan-generate`**  
  - 功能：基于指定 `--run-id` 的探索产物生成测试计划与 Markdown specs，产出 `.autoqa/runs/<runId>/plan/*`。

- **`autoqa plan`**  
  - 功能：按 Story 7.3 约定默认执行“探索 + 用例生成”完整流程，等价于依次执行 `autoqa plan-explore` 与 `autoqa plan-generate`（复用同一个 runId）。
  - 本 Tech Spec 中的所有改进，同样适用于 `autoqa plan-explore` + `autoqa plan-generate` 以及一键 `autoqa plan`。

> 说明：此前 `ts-7-agent-based-intelligent-planner.md` 文档中提到的 `autoqa plan run` 子命令在当前实现中已由 `autoqa plan` 默认行为取代。本 Tech Spec 统一采用 **`plan / plan-explore / plan-generate`** 的命令集合描述现状。

### 2.2 目标行为概要

- 用户在 Polyv 等场景下运行：
  - `autoqa plan-explore -u https://console.polyv.net/live/index.html#/channel ...`
  - 或 `autoqa plan -u https://console.polyv.net/live/index.html#/channel ...`
- 生成的测试计划：
  - 优先围绕频道列表页以及与之直接相关的子路由/子流程。
  - Markdown specs 结构与 `polyv-01-channel-search.md` / `saucedemo-03-cart.md` 一致，可直接 `autoqa run`。
  - 用例中包含基础路径正常流程、至少一个边界/负例场景，并在需要时使用 `include: login` 等步骤库。

---

## 3. 架构与数据模型扩展

本节在 Epic 7 的基础数据模型之上，增加 Planner 输出质量与 URL Scope 控制所需的补充语义。

### 3.1 PlanConfig 扩展

在 `src/plan/types.ts` 中，现有 `PlanConfig` 已包含：

- `baseUrl: string`
- `maxDepth: number`
- `maxPages?: number`
- `includePatterns?: string[]`
- `excludePatterns?: string[]`
- `testTypes?: ('functional' | 'form' | 'navigation' | 'responsive' | 'boundary' | 'security')[]`
- `guardrails?: GuardrailConfig`
- `auth?: AuthConfig`

本 Tech Spec 主要做两件事：

1. **严格约定 `includePatterns` / `excludePatterns` 的匹配语义**：
   - 匹配对象为 **相对 URL**：`relative = pathname + hash`，例如：
     - `https://console.polyv.net/live/index.html#/channel` → `/live/index.html#/channel`
   - 允许前缀通配：
     - 精确：`"/live/index.html#/channel"`
     - 前缀：`"/live/index.html#/channel*"`

2. **新增探索范围模式字段**：
   - `exploreScope?: 'site' | 'focused' | 'single_page'`
   - 语义：
     - `'site'`：现有默认行为，只限制域名和 `maxDepth`。
     - `'focused'`：只将匹配 `includePatterns` 且不在 `excludePatterns` 中的 URL 视为 **in-scope 页面**。
     - `'single_page'`：主要探索当前页面内行为（搜索、过滤、排序、分页、弹窗等），只允许 URL 做有限变化（hash 子路由或在 `includePatterns` 白名单内）。

> 配置加载与合并逻辑仍由现有 `loadPlanConfig` 负责（参考 `7-4-configurable-exploration-strategy.md`），本 Tech Spec 仅定义新增字段的语义。

### 3.2 ExplorationGraph 与 TestPlan

- `ExplorationGraph` / `PageNode` / `NavigationEdge` 保持现有结构，新增语义仅通过 URL 匹配函数解释。
- `TestPlan` / `TestCasePlan` 保持现有字段，但对字段含义作更严格约束：
  - `TestCasePlan.preconditions`：必须包含关键 URL 与登录/权限假设（以模板变量表示）。
  - `TestCasePlan.steps`：
    - `description` 采用可执行语义（Navigate/Click/Fill/Verify）。
    - `expectedResult` 为非空、具体的可验证结果。

---

## 4. 设计详细：W2 - Markdown spec 输出规范化（可执行性优先）

> **优先级：最高（Phase 1）**

### 4.1 目标

- 让 Planner 生成的 Markdown spec **无需人工改写即可由 `autoqa run` 执行**。
- 对标现有手写用例：
  - `polyv-specs/polyv-01-channel-search.md`
  - `specs/saucedemo-03-cart.md`

### 4.2 Markdown 结构规范

- 标题：`# <系统> - <功能描述>（自动生成）`
- 可选类型行：`Type: <type> | Priority: <P0/P1/P2>`（保持现有渲染逻辑）。
- Preconditions：
  - `## Preconditions`
  - 至少包含：
    - `Base URL 可访问：` `{{BASE_URL}}`
    - 对目标业务页：`频道列表页可访问：` `{{BASE_URL}}/live/index.html#/channel`
    - 如涉及登录：
      - `登录页可访问：` `{{LOGIN_BASE_URL}}/v3/login/`
      - `有可用测试账号（通过环境变量 AUTOQA_USERNAME / AUTOQA_PASSWORD 配置）`
- Steps：
  - `## Steps`
  - 步骤采用有序列表（1. 2. ...），每一步：
    - 行为：`Navigate / Click / Fill / Verify / Expect` 等动词开头。
    - URL 步骤：
      - 必须使用 `{{BASE_URL}}` / `{{LOGIN_BASE_URL}}` + 具体相对路径，例如：
        - `Navigate to {{LOGIN_BASE_URL}}/v3/login/`
        - `Navigate to {{BASE_URL}}/live/index.html#/channel`
    - 断言行：紧随其后以 `- Expected: ...` 描述。

### 4.3 Planner 输出约束（TestCasePlan 侧）

在 `plan-agent` 的 prompt 中增加以下硬性要求：

- 每个 `TestCasePlan`：
  - `preconditions`：
    - 必须列出关键 URL，且使用模板变量表示环境依赖（`{{BASE_URL}}` / `{{LOGIN_BASE_URL}}` 等）。
  - `steps[].description`：
    - 导航步骤必须包含具体 URL + 模板变量，不允许 `Navigate to channel page` 这类模糊描述。
    - 操作步骤应使用可执行语义（Click/Fill/Select/Verify）。
  - `steps[].expectedResult`：
    - 必须为非空字符串，描述具体可验证结果，而非“页面正常显示”之类泛化描述。

### 4.4 URL 模板映射策略

- Orchestrator 或 `plan-agent` prompt 中提供“URL 映射示例”：
  - 从 `ExplorationGraph.pages[*].url` 中选取典型 URL，生成示例：
    - 实际 URL：`https://console.polyv.net/live/index.html#/channel`
    - 在用例中写作：`{{BASE_URL}}/live/index.html#/channel`
- 要求 Planner：
  - 对所有属于 `config.baseUrl` 域的页面，均采用上述转换规则产出步骤文字。

### 4.5 与 `autoqa run` 的兼容

- 保证生成的 Markdown 满足现有 `parseMarkdownSpec` + `expandIncludes` + 模板变量渲染逻辑的最低要求：
  - 存在 `## Preconditions` 与 `## Steps`。
  - `## Steps` 下为有序列表，步文本中可包含 `include: <name>`。
- 这样，一旦 Planner 生成 specs，便可：
  - `autoqa run .autoqa/runs/<runId>/plan/specs` 直接执行。

---

## 5. 设计详细：W1 - 探索范围 & URL Scope 收紧

> **优先级：第二（Phase 2）**

### 5.1 CLI & 配置约定

- `PlanConfig.exploreScope?: 'site' | 'focused' | 'single_page'`：
  - `site`：保持当前行为。
  - `focused`：以 `includePatterns` / `excludePatterns` 为 URL 白/黑名单，仅对匹配 `includePatterns` 的页面进行重点探索与规划。
  - `single_page`：仅探索当前页面内交互行为，禁止明显跨模块导航。

- CLI 建议（语义层）：
  - 为 `autoqa plan-explore` 和 `autoqa plan` 增加 `--explore-scope <mode>` 参数（实现细节在后续 story 中落地）。
  - 对于 `focused` / `single_page`，如果用户未显式提供 `includePatterns`：
    - 自动从 `baseUrl` 推导：
      - `relativeBase = pathname + hash`
      - 默认 `includePatterns = [relativeBase + '*']`

### 5.2 Explore Agent Prompt 中的 Scope 约束

在 `buildExplorePrompt(config: PlanConfig)` 中，根据 `exploreScope` 追加 URL Scope 段落：

- `site`：
  - 维持“Stay within the same domain”规则。

- `focused`：
  - 说明 **in-scope URL** 的判定：
    - 仅当 `relative` 匹配任一 `includePatterns` 且不匹配任何 `excludePatterns` 时，将页面视为规划目标。
  - 建议 Agent：避免点击明显指向其他模块的全局导航（如统计/设置/回放等）。

- `single_page`：
  - 强调：
    - 起点为 `config.auth?.loginUrl ?? config.baseUrl`。
    - 以当前页面内行为为主：搜索、分页、过滤、展开/折叠、弹窗等。
    - 仅允许 URL 在 `relativeBase` 的子前缀范围内变化，或显式允许的 `includePatterns` 路径。

### 5.3 Plan 阶段 Graph 过滤

在 `generateTestPlan` 中，在调用 `runPlanAgent` 前，对 `ExplorationGraph` 做 URL Scope 过滤：

- 定义：
  - `isUrlInScope(url: string, config: PlanConfig): boolean`
    - 提取 `relative = pathname + hash`。
    - 若 `includePatterns` 存在：必须匹配至少一个 include。
    - 若 `excludePatterns` 存在：不得匹配任何 exclude。
    - 若 `exploreScope === 'single_page'`：进一步约束 `relative` 需与 `relativeBase`（由 `config.baseUrl` 计算）前缀匹配。

- 过滤逻辑：
  - `graph.pages = graph.pages.filter(p => isUrlInScope(p.url, config))`
  - `graph.edges = graph.edges.filter(e => from/to 页面都仍在过滤后的 pages 集合中)`

- 效果：
  - 即使 Explore Agent 在会话中访问了不相关模块，这些页面不会进入 `TestPlan` 规划视野，从而不会生成对应 specs。

---

## 6. 设计详细：W3 - Planner Prompt & 质量增强

> **优先级：第三（Phase 3，增强阶段）**

### 6.1 借鉴 Playwright Test Planner 的结构

对 `explore-agent` 与 `plan-agent` 的 system prompt 进行结构化改造，借鉴 `docs/prompts/playwright-test-planner.md`：

- 明确分节：
  - Navigate and Explore
  - Analyze User Flows
  - Design Comprehensive Scenarios
  - Structure Test Plans
  - Quality Standards

- 在 Quality Standards 中增加：
  - 步骤应足够细致，任何测试人员都能依照执行。
  - 每个关键功能应至少有 1 条 Happy path + 1–2 条边界/负例路径。
  - 每个用例必须描述起始状态（登录/未登录、购物车为空等）。
  - 用例尽可能相互独立，避免依赖前一用例副作用。

### 6.2 负例与边界用例生成

在 `plan-agent` prompt 中约束：

- 对于探索结果中识别出的关键操作：
  - 表单提交 / 搜索 / 登录 / 创建/删除等：
    - 至少生成：
      - 一条正常流程用例；
      - 一条或多条边界/异常用例（例如空输入、超长输入、非法字符、不存在的搜索关键字）。

### 6.3 步骤库 `include:` 的自动复用（可选）

中长期增强方向：

- 探索 `specs/steps/*.md`，构建可用步骤库清单：
  - 例如：`login`、`reset-app-state` 等。
- 在 Planner prompt 中明确告诉 Agent：
  - “存在步骤库 `include: login`，用于执行登录流程。”
- 要求 Planner：
  - 如需登录，尽量使用单步 `include: login` 代替展开重复步骤。

该增强不影响现有执行能力，仅提升生成用例的可维护性与与手写库的一致性。

---

## 7. 验收标准

### AC1：Markdown spec 可直接被 `autoqa run` 执行

- **Given** 使用 `autoqa plan` 或 `autoqa plan-explore + autoqa plan-generate` 为 Polyv 或 SauceDemo 场景生成测试计划
- **When** 使用 `autoqa run` 直接执行 `.autoqa/runs/<runId>/plan/specs/` 下的所有 Markdown spec
- **Then** `autoqa run` 不应因 Markdown 结构或模板变量错误而失败
- **And** 多数（> 80%）生成用例能在实际页面上执行到预期断言（考虑站点动态变化与不可控因素）

### AC2：探索与计划范围围绕指定 URL 聚焦

- **Given** 用户在 Polyv 场景下运行：
  - `autoqa plan-explore -u https://console.polyv.net/live/index.html#/channel --explore-scope focused`
- **When** 检查 `explore-graph.json` 与 `test-plan.json`
- **Then** 大部分页面与用例应集中在 `#/channel` 模块及其子路由，不包含明显不相关模块（如回放/统计等）

### AC3：Planner 输出包含负例与质量约束

- **Given** 探索结果中包含搜索/表单等关键行为
- **When** 检查生成的 `test-plan.json` 与对应 Markdown specs
- **Then** 至少存在：
  - 一条正常路径用例
  - 一条或多条边界/负例用例
- **And** 每个用例在 Preconditions 中清晰描述起始状态
- **And** 步骤与预期结果满足本 Tech Spec 第 4 节的风格约束

---

## 8. 风险与缓解措施

- **R1：Scope 收紧导致漏测**  
  - 风险：过于激进的 `includePatterns` / `exploreScope` 配置可能忽略重要页面。  
  - 缓解：
    - 默认仍为 `'site'` 模式，保证向后兼容。
    - 在 CLI 与文档中明确提示 scope 配置的影响。

- **R2：Prompt 调整引起 Planner 回归**  
  - 风险：大幅修改 `plan-agent` prompt 可能影响已有站点行为。  
  - 缓解：
    - 分阶段灰度：先只收紧 URL 写法与 Markdown 结构，不立刻启用复杂负例生成规则。
    - 利用现有单元测试与端到端用例扩展回归覆盖。

---

## 9. References

- `docs/sprint-artifacts/ts-7-agent-based-intelligent-planner.md`
- `docs/sprint-artifacts/7-3-plan-command-implementation.md`
- `docs/sprint-artifacts/7-4-configurable-exploration-strategy.md`
- `docs/prompts/playwright-test-planner.md`
- `docs/epics.md#Epic-7-Agent-驱动智能测试规划器（基于-snapshot-的自动化测试计划生成）`
- `docs/epics.md#Story-7.3-autoqa-plan-命令编排（探索-规划-用例生成）`
- `docs/epics.md#Story-7.4-配置化探索与生成策略`

---

## 10. Dev Agent Record

### Agent Model Used

- Cascade

### Implementation Sketch（供后续 story 拆解）

1. **Phase 1：Markdown spec 可执行化（W2）**
   - 调整 `plan-agent` prompt，明确 URL 写法、Preconditions 与 Steps 风格。
   - 在 `buildPlanPrompt` 中插入自动生成的 URL 映射示例。
   - 增加适量单元测试，验证生成的 Markdown 至少满足 `parseMarkdownSpec` 的最低结构要求（可通过 mock planner 输出）。

2. **Phase 2：URL Scope 收紧（W1）**
   - 在 `PlanConfig` 中引入 `exploreScope` 字段，保持向后兼容。
   - 在 `explore-agent` prompt 中增加 URL Scope 段。
   - 在 `generateTestPlan` 中加入 Graph 过滤逻辑，基于 `includePatterns` / `excludePatterns` 与 `exploreScope` 裁剪 pages/edges。

3. **Phase 3：Prompt 质量与负例增强（W3）**
   - 按本 Tech Spec 6.1–6.3 节改造 `explore-agent` / `plan-agent` prompt 结构。
   - 引入边界/负例用例生成规则，并逐步在关键场景（登录、搜索、CRUD 等）启用。
   - 试验性地加入 `include:` 步骤库提示，并评估 Agent 复用程度。
