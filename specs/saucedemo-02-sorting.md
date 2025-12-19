# SauceDemo - 商品列表排序（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）

## Steps

1. include: login
2. Verify the inventory page shows a list of products, each with name/price and an "Add to cart" button
3. Verify the sort dropdown is present (e.g. allows sorting by Name / Price)
4. Click the sort dropdown and select "Price (low to high)"
5. Verify the product list is sorted by ascending price
6. Click the sort dropdown and select "Name (Z to A)"
7. Verify the product list is sorted by name descending
