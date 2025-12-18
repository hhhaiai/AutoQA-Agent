# SauceDemo - 商品列表排序（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）

## Steps

1. Navigate to /
2. Fill the "Username" field with {{USERNAME}}
3. Fill the "Password" field with {{PASSWORD}}
4. Click the "Login" button
5. Verify the user is logged in and sees the inventory/products page (e.g. header shows "Products")

6. Verify the inventory page shows a list of products, each with name/price and an "Add to cart" button
7. Verify the sort dropdown is present (e.g. allows sorting by Name / Price)
8. Click the sort dropdown and select "Price (low to high)"
9. Verify the product list is sorted by ascending price
10. Click the sort dropdown and select "Name (Z to A)"
11. Verify the product list is sorted by name descending
