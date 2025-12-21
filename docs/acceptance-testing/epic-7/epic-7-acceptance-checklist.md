# Epic 7: Agent 驱动智能测试规划器（基于 snapshot 的自动化测试计划生成）

## 手工验收清单

**测试日期：** _______________
**测试人员：** _______________
**应用环境：** _______________（URL: ___________）

---

## 前置条件

### 环境准备
- [ ] Node.js 版本 >= 20（建议 v24.12.0）
- [ ] 已安装项目依赖：`npm install`
- [ ] 已构建项目：`npm run build`
- [ ] Anthropic API 密钥已配置（环境变量或 Claude Code）
- [ ] 测试目标应用可访问（TodoMVC 或其他示例应用）
- [ ] 已准备登录凭据（如测试需要）：用户名/密码

### 配置文件准备
- [ ] `autoqa.config.json` 已创建并配置了必要的 plan 配置
- [ ] 环境变量配置（如需要）：
  - [ ] `AUTOQA_BASE_URL`
  - [ ] `AUTOQA_USERNAME`
  - [ ] `AUTOQA_PASSWORD`
  - [ ] `AUTOQA_LOGIN_BASE_URL`

---

## Story 7.1: App 探索引擎

### AC1: 单次探索会话完整执行
**目标：** 验证探索引擎能完整运行，生成三个核心产物

**测试步骤：**
1. 运行命令：`autoqa plan -u <BASE_URL> -d 2 --max-pages 5`
2. 观察实时输出的探索日志
3. 等待命令完成，检查退出码

**验收结果：**
- [ ] 命令退出码为 0（成功）
- [ ] 输出目录 `.autoqa/runs/<runId>/plan-explore/` 已创建
- [ ] 包含以下三个文件：
  - [ ] `explore-graph.json`（页面节点 + 导航关系）
  - [ ] `explore-elements.json`（交互元素清单）
  - [ ] `explore-transcript.jsonl`（探索过程记录）

**附加检查：**
- [ ] `explore-graph.json` 包含至少 2 个页面节点（首页 + 1个子页面）
- [ ] `explore-elements.json` 每个页面都有 elementSummary 字段
- [ ] `explore-transcript.jsonl` 是有效的 JSONL 格式

### AC2: 登录场景支持
**目标：** 验证探索引擎能处理需要登录的应用

**测试步骤：**
1. 准备需要登录的应用
2. 运行命令：`autoqa plan -u <BASE_URL> --login-url <LOGIN_URL> --username <USER> --password <PASS>`
3. 观察探索过程是否包含登录步骤

**验收结果：**
- [ ] 探索过程中包含登录步骤
- [ ] 登录后继续探索其他页面
- [ ] 生成的探索产物包含登录后的页面

**错误场景测试（可选）：**
- [ ] 使用错误的登录凭据，验证退出码为 1
- [ ] 检查错误产物包含 snapshot 和错误说明

---

## Story 7.2: Agent 驱动的智能测试用例生成器

### AC1: 基于探索产物生成用例
**目标：** 验证能从探索产物生成测试用例

**测试步骤：**
1. 确保已有完整的探索产物（来自 7.1）
2. 运行生成命令（如果实现了独立命令）
3. 检查生成的测试用例

**验收结果：**
- [ ] 生成的用例位于 `.autoqa/runs/<runId>/plan/specs/`
- [ ] 每个用例都符合 Markdown 结构：
  ```
  # 用例名称
  Type: <类型> | Priority: <优先级>

  ## Preconditions
  - <前置条件>

  ## Steps
  1. <步骤描述>
     - Expected: <预期结果>
  ```

### AC2: 测试类型覆盖
**目标：** 验证生成的用例覆盖所有要求的测试类型

**检查生成的用例是否包含：**
- [ ] 基础功能测试（页面访问、元素交互）
- [ ] 表单测试（成功提交、验证失败、必填字段）
- [ ] 导航测试（内部链接、菜单流转）
- [ ] 边界条件测试（长文本、快速操作）
- [ ] 安全性测试（XSS 输入场景）

**附加检查：**
- [ ] 敏感数据使用占位符（如 `{{USERNAME}}`）
- [ ] 步骤描述使用自然语言
- [ ] 每个步骤都有明确的预期结果

---

## Story 7.3: `autoqa plan` 命令编排

### AC1: 一键执行完整流程
**目标：** 验证单个命令完成整个规划流程

**测试步骤：**
1. 运行命令：`autoqa plan -u <BASE_URL>`（这将执行完整的探索+生成流程）
   - 等同于之前的 `autoqa plan run` 命令
2. 观察输出中的阶段划分
3. 等待完成，检查退出码

**验收结果：**
- [ ] 日志中显示清晰的阶段：
  - [ ] "Exploration phase" 或类似标记
  - [ ] "Generation phase" 或类似标记
- [ ] 最终退出码为 0
- [ ] 输出目录包含完整产物：
  - [ ] 探索产物（3个 JSON 文件）
  - [ ] 生成的 Markdown specs

### AC2: 配置文件支持
**目标：** 验证能从配置文件读取参数

**测试步骤：**
1. 在 `autoqa.config.json` 中配置：
   ```json
   {
     "plan": {
       "baseUrl": "<BASE_URL>",
       "maxDepth": 3,
       "maxPages": 10,
       "testTypes": ["functional", "form", "navigation"]
     }
   }
   ```
2. 运行：`autoqa plan`
3. 检查是否使用了配置的参数

**验收结果：**
- [ ] 成功读取配置文件
- [ ] 实际使用的参数与配置一致
- [ ] 最终配置记录在 `plan-summary.json` 中

---

## Story 7.4: 配置化探索与生成策略

### AC1: 配置项支持
**目标：** 验证所有要求的配置项都可用

**创建配置文件：**
```json
{
  "plan": {
    "maxDepth": 3,
    "maxPages": 15,
    "includePatterns": ["/app/*", "/user/*"],
    "excludePatterns": ["/admin/*", "/api/*"],
    "testTypes": ["functional", "form", "navigation", "security"],
    "login": {
      "url": "/login",
      "usernameField": "#username",
      "passwordField": "#password",
      "submitSelector": "button[type='submit']"
    }
  }
}
```

**测试步骤：**
1. 使用上述配置运行 `autoqa plan`
2. 验证配置生效：
   - [ ] 探索深度不超过 maxDepth
   - [ ] 探索页面数不超过 maxPages
   - [ ] URL 包含/排除模式生效
   - [ ] 生成的测试类型与配置一致

### AC2: 命令行参数优先级
**目标：** 验证命令行参数能覆盖配置文件

**测试步骤：**
1. 配置文件设置 `maxDepth: 2`
2. 运行：`autoqa plan --max-depth 4`
3. 检查实际使用的值

**验收结果：**
- [ ] 实际使用的是命令行参数（4），不是配置文件（2）
- [ ] plan-summary.json 记录了最终生效的配置

---

## Story 7.5: 与现有执行/导出工具链的集成

### AC1: 生成的 specs 可执行
**目标：** 验证生成的 specs 能被 `autoqa run` 执行

**测试步骤：**
1. 确保 `autoqa plan` 已生成测试 specs
2. 选择一个生成的 spec 文件
3. 运行：`autoqa run <spec文件路径> --headless`
4. 观察执行过程

**验收结果：**
- [ ] spec 能被正确解析（无语法错误）
- [ ] 执行过程与手写 spec 一致
- [ ] 支持截图（如果配置了）
- [ ] 支持自愈机制

### AC2: 模板变量支持
**目标：** 验证模板变量能正确替换

**测试步骤：**
1. 检查生成的 spec 是否包含模板变量：
   - [ ] `{{BASE_URL}}`
   - [ ] `{{USERNAME}}`
   - [ ] `{{PASSWORD}}`
2. 设置环境变量
3. 运行：`autoqa run <spec文件路径> --headless`

**验收结果：**
- [ ] 模板变量被正确替换
- [ ] 登录凭据正常工作

### AC3: 导出流水线兼容性
**目标：** 验证生成的 specs 能被导出为 Playwright Test

**测试步骤：**
1. 运行：`autoqa export <specs目录>`
2. 检查生成的 `.spec.ts` 文件
3. 运行：`npx playwright test <导出的测试>`

**验收结果：**
- [ ] 导出成功，无错误
- [ ] 导出的测试能正常运行
- [ ] 测试断言合理

---

## 端到端验收测试

### 完整工作流测试
**目标：** 验证从零开始到可执行测试的完整流程

**测试步骤：**
1. 清理旧的运行结果：`rm -rf .autoqa`
2. 运行完整命令：
   ```bash
   autoqa plan -u <BASE_URL> \
     --max-depth 3 \
     --max-pages 10 \
     --test-types functional,form,navigation
   ```
3. 检查生成的 specs 数量和质量
4. 选择 3-5 个代表性的 specs 执行：
   ```bash
   autoqa run .autoqa/runs/<latest>/plan/specs/ --headless
   ```
5. 导出并运行 Playwright 测试：
   ```bash
   autoqa export .autoqa/runs/<latest>/plan/specs/
   npx playwright tests/exported/
   ```

**验收结果：**
- [ ] 所有步骤成功完成
- [ ] 生成的测试用例覆盖了应用的主要功能
- [ ] 测试执行通过率 > 90%
- [ ] 导出的 Playwright 测试也能通过

---

## 性能与稳定性验收

### 性能指标
- [ ] 探索阶段完成时间 < 2 分钟（小型应用）
- [ ] 生成阶段完成时间 < 1 分钟
- [ ] 内存使用 < 1GB
- [ ] CPU 使用率 < 80%

### 稳定性测试
- [ ] 连续运行 3 次，结果一致
- [ ] 处理包含 50+ 页面的应用不崩溃
- [ ] 网络中断后能优雅失败

---

## 验收结论

**通过率统计：**
- Story 7.1: ___/___ 通过
- Story 7.2: ___/___ 通过
- Story 7.3: ___/___ 通过
- Story 7.4: ___/___ 通过
- Story 7.5: ___/___ 通过

**总体评价：**
- [ ] 完全通过，可以发布
- [ ] 部分通过，需要修复某些问题
- [ ] 不通过，需要重新开发

**问题清单：**
1.
2.
3.

**建议：**

---

**测试负责人签名：** _______________
**日期：** _______________