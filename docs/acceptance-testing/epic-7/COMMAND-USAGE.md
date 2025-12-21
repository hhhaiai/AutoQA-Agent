# Epic 7 命令使用说明

## 重要提示

当前 `autoqa plan explore` 子命令存在 bug，无法正常使用。请使用 `autoqa plan` 命令来执行完整的探索和生成流程。

## 正确的命令格式

### 1. 完整规划流程（推荐）

执行探索和测试用例生成：

```bash
# 基础命令
autoqa plan -u <BASE_URL>

# 带深度限制
autoqa plan -u <BASE_URL> -d 2

# 带页面数限制
autoqa plan -u <BASE_URL> -d 2 --max-pages 5

# 带登录
autoqa plan -u <BASE_URL> --login-url <LOGIN_URL> --username <USER> --password <PASS>
```

### 2. 配置文件格式

创建 `autoqa.config.json` 文件：

```json
{
  "schemaVersion": 1,
  "plan": {
    "baseUrl": "https://example.com",
    "maxDepth": 2,
    "maxPages": 5,
    "testTypes": ["functional", "form", "navigation"],
    "login": {
      "url": "/login",
      "username": "testuser",
      "password": "testpass"
    }
  }
}
```

### 3. 命令行参数优先级

命令行参数会覆盖配置文件中的对应设置：

```bash
# 使用配置文件，但覆盖深度和页面数
autoqa plan -u https://example.com -d 3 --max-pages 10
```

### 4. 输出位置

所有输出文件保存在：
- 探索产物：`.autoqa/runs/<runId>/plan-explore/`
- 测试计划：`.autoqa/runs/<runId>/plan/test-plan.json`
- 生成的 specs：`.autoqa/runs/<runId>/plan/specs/`
- 总结报告：`.autoqa/runs/<runId>/plan/plan-summary.json`

### 5. 实际使用示例

```bash
# TodoMVC 示例
autoqa plan -u https://todomvc.com/examples/react/ -d 2 --max-pages 5

# 带登录的电商网站示例
autoqa plan -u https://www.saucedemo.com/inventory.html \
  --login-url https://www.saucedemo.com \
  --username standard_user \
  --password secret_sauce \
  -d 3 \
  --max-pages 10
```

## 已知问题

1. 必须在命令行指定 `-u` 参数，即使配置文件中有 `baseUrl`
2. 配置文件必须包含 `schemaVersion: 1`

## 解决方案

现在可以使用以下命令：

1. **仅探索（Story 7.1）**:
   ```bash
   autoqa plan explore -u <URL> -d 2 --max-pages 5
   ```

2. **完整流程（探索 + 生成）**:
   ```bash
   autoqa plan -u <URL> -d 2 --max-pages 5
   ```

3. **基于已有探索结果生成测试用例（Story 7.2）**:
   ```bash
   autoqa plan generate --run-id <run-id> -u <URL>
   ```

**注意**：`autoqa plan run` 子命令已被移除，其功能已合并到父命令 `autoqa plan` 中。