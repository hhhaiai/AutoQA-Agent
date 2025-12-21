# URL Scope 配置指南

URL Scope 功能允许你控制 `autoqa plan` 命令的探索和测试计划生成范围，避免在大型应用中浪费时间和成本在无关区域。

## 概述

URL Scope 通过以下配置项控制：

- **`exploreScope`**: 探索范围模式（`'site'` | `'focused'` | `'single_page'`）
- **`includePatterns`**: URL 白名单模式（数组）
- **`excludePatterns`**: URL 黑名单模式（数组）

## 探索范围模式

### 1. `site` 模式（默认）

全站探索，只限制域名和深度。

**适用场景**：
- 首次探索一个应用
- 需要全面了解应用结构
- 应用规模较小

**配置示例**：
```json
{
  "plan": {
    "baseUrl": "https://example.com",
    "exploreScope": "site",
    "maxDepth": 3
  }
}
```

**CLI 使用**：
```bash
autoqa plan -u https://example.com --explore-scope site
```

### 2. `focused` 模式

聚焦探索，只探索匹配 `includePatterns` 的页面。

**适用场景**：
- 针对特定模块或功能进行测试
- 大型控制台应用，只关心某个子系统
- 需要排除无关区域（如管理后台、统计页面）

**配置示例**：
```json
{
  "plan": {
    "baseUrl": "https://console.polyv.net/live/index.html#/channel",
    "exploreScope": "focused",
    "includePatterns": ["/live/index.html#/channel*"],
    "excludePatterns": ["/live/index.html#/statistics*", "/live/index.html#/settings*"]
  }
}
```

**CLI 使用**：
```bash
autoqa plan-explore \
  -u https://console.polyv.net/live/index.html#/channel \
  --explore-scope focused
```

### 3. `single_page` 模式

单页探索，专注当前页面的交互，最小化导航。

**适用场景**：
- 单页应用（SPA）的某个视图
- 只测试页面内的交互（搜索、过滤、排序、分页等）
- 避免跳转到其他模块

**配置示例**：
```json
{
  "plan": {
    "baseUrl": "https://example.com/app#/dashboard",
    "exploreScope": "single_page",
    "includePatterns": ["/app#/dashboard*"]
  }
}
```

**CLI 使用**：
```bash
autoqa plan -u https://example.com/app#/dashboard --explore-scope single_page
```

## URL 匹配规则

### 相对 URL 匹配

所有模式匹配基于**相对 URL**（pathname + hash），而非完整 URL。

**示例**：
- 完整 URL: `https://console.polyv.net/live/index.html#/channel`
- 相对 URL: `/live/index.html#/channel`

### 前缀通配符

使用 `*` 作为后缀进行前缀匹配：

```json
{
  "includePatterns": [
    "/api/public*"     // 匹配 /api/public, /api/public/users, /api/public/posts 等
  ],
  "excludePatterns": [
    "/api/internal*"   // 排除 /api/internal, /api/internal/admin 等
  ]
}
```

### 精确匹配

不使用 `*` 时为精确匹配：

```json
{
  "includePatterns": [
    "/exact/path"      // 只匹配 /exact/path，不匹配 /exact/path/sub
  ]
}
```

## 典型配置示例

### 示例 1: Polyv 直播控制台 - 频道管理模块

只测试频道列表和频道详情，排除统计、设置、回放等模块：

```json
{
  "plan": {
    "baseUrl": "https://console.polyv.net/live/index.html#/channel",
    "exploreScope": "focused",
    "maxDepth": 2,
    "includePatterns": [
      "/live/index.html#/channel*"
    ],
    "excludePatterns": [
      "/live/index.html#/statistics*",
      "/live/index.html#/settings*",
      "/live/index.html#/playback*"
    ]
  }
}
```

### 示例 2: SauceDemo - 购物流程

只测试商品浏览和购物车，排除结账流程：

```json
{
  "plan": {
    "baseUrl": "https://www.saucedemo.com/inventory.html",
    "exploreScope": "focused",
    "includePatterns": [
      "/inventory.html",
      "/cart.html"
    ],
    "excludePatterns": [
      "/checkout*"
    ]
  }
}
```

### 示例 3: API 文档站点 - 公开 API 部分

只测试公开 API 文档，排除内部 API：

```json
{
  "plan": {
    "baseUrl": "https://api.example.com/docs",
    "exploreScope": "focused",
    "includePatterns": [
      "/docs/api/public*"
    ],
    "excludePatterns": [
      "/docs/api/internal*",
      "/docs/api/admin*"
    ]
  }
}
```

### 示例 4: 单页应用 - Dashboard 视图

只测试 Dashboard 页面的交互，不跳转到其他视图：

```json
{
  "plan": {
    "baseUrl": "https://app.example.com/#/dashboard",
    "exploreScope": "single_page",
    "maxDepth": 1
  }
}
```

## 自动推导

当 `focused` 或 `single_page` 模式下未指定 `includePatterns` 时，会自动从 `baseUrl` 推导：

```json
{
  "plan": {
    "baseUrl": "https://console.polyv.net/live/index.html#/channel",
    "exploreScope": "focused"
    // 自动推导: includePatterns = ["/live/index.html#/channel*"]
  }
}
```

## 域名过滤

所有模式都会自动过滤跨域 URL，只保留与 `baseUrl` 相同域名的页面。

## 工作流程

1. **探索阶段** (`autoqa plan-explore`)：
   - Explore Agent 根据 `exploreScope` 优先探索 in-scope 页面
   - 生成完整的 `explore-graph.json`（包含所有访问过的页面）

2. **生成阶段** (`autoqa plan-generate` 或 `autoqa plan`)：
   - 根据 URL Scope 过滤 `explore-graph.json`
   - 只为 in-scope 页面生成测试用例
   - 输出过滤后的 `test-plan.json` 和 Markdown specs

## 日志事件

当 URL Scope 过滤生效时，会记录日志事件：

```json
{
  "event": "autoqa.plan.generate.url_scope_filtered",
  "originalPageCount": 10,
  "filteredPageCount": 5,
  "exploreScope": "focused"
}
```

## 最佳实践

1. **首次探索使用 `site` 模式**：了解应用全貌
2. **针对性测试使用 `focused` 模式**：聚焦关键功能
3. **单页交互使用 `single_page` 模式**：避免不必要的导航
4. **合理使用 `excludePatterns`**：排除管理后台、统计页面等无关区域
5. **测试配置**：先用 `plan-explore` 验证 URL Scope 效果，再运行完整 `plan`

## 故障排查

### 问题：所有页面都被过滤了

**原因**：`includePatterns` 太严格或 `excludePatterns` 太宽泛

**解决**：
1. 检查相对 URL 格式是否正确（包含 pathname + hash）
2. 使用通配符 `*` 放宽匹配范围
3. 查看 `explore-graph.json` 确认实际访问的 URL

### 问题：无关页面仍然被包含

**原因**：`exploreScope` 为 `site` 且未配置 `excludePatterns`

**解决**：
1. 切换到 `focused` 模式
2. 添加 `excludePatterns` 排除无关页面

### 问题：CLI 参数不生效

**原因**：配置文件中的值覆盖了 CLI 参数

**解决**：
- CLI 参数优先级高于配置文件，检查是否正确传递参数
- 使用 `--explore-scope` 而非 `--scope`
