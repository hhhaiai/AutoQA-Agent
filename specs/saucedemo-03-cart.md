# SauceDemo - 购物车增删与数量徽标（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）
- 建议先通过侧边菜单执行一次 "Reset App State"（保证购物车为空，便于重复执行）

## Steps

1. include: login

2. (Optional) Open the left menu (hamburger/menu button)
3. (Optional) Click "Reset App State"
4. Verify the cart badge is not shown (or shows 0)

5. Click "Add to cart" for any product
6. Verify the button for that product changes to "Remove"
7. Verify the cart icon badge count becomes 1

8. Click "Add to cart" for another product
9. Verify the cart icon badge count becomes 2

10. Click the cart icon
11. Verify the cart page shows "Your Cart" and lists the selected products

12. Click "Remove" for one of the items in the cart
13. Verify the removed item disappears from the cart list
14. Verify the cart icon badge count decreases by 1

15. Click "Continue Shopping"
16. Verify the user returns to the inventory/products page
