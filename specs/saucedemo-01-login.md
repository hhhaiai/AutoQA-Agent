# SauceDemo - 登录（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）
- 浏览器允许加载 JavaScript（该站点为 SPA）

## Steps

1. Navigate to /
2. Verify the page shows the login form with fields "Username" and "Password"
3. Fill the "Username" field with {{USERNAME}}
4. Fill the "Password" field with {{PASSWORD}}
5. Click the "Login" button
6. Verify the user is logged in and sees the inventory/products page (e.g. header shows "Products")
