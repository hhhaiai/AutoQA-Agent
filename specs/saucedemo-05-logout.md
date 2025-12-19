# SauceDemo - 菜单登出（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）

## Steps

1. include: login
2. Open the left menu (hamburger/menu button)
3. Verify the menu shows a "Logout" option
4. Click "Logout"
5. Verify the user is returned to the login page and is no longer authenticated
6. Verify the login form is visible again ("Username" and "Password" fields)
