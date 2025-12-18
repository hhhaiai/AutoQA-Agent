# SauceDemo - 菜单登出（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）

## Steps

1. Navigate to /
2. Fill the "Username" field with {{USERNAME}}
3. Fill the "Password" field with {{PASSWORD}}
4. Click the "Login" button
5. Verify the user is logged in and sees the inventory/products page (e.g. header shows "Products")

6. Open the left menu (hamburger/menu button)
7. Verify the menu shows a "Logout" option
8. Click "Logout"
9. Verify the user is returned to the login page and is no longer authenticated
10. Verify the login form is visible again ("Username" and "Password" fields)
