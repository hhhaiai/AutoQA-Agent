# SauceDemo - 结算流程（手工验收）

## Preconditions

- Base URL 可访问：`{{BASE_URL}}`
- 有可用测试账号（通过环境变量 `AUTOQA_USERNAME` / `AUTOQA_PASSWORD` 配置）

## Steps

1. include: login

2. Click "Add to cart" for any product
3. Verify the cart icon badge count becomes 1

4. Click the cart icon
5. Verify the cart page shows "Your Cart" and contains at least 1 item
6. Click the "Checkout" button

7. Verify the checkout information page is shown (e.g. title contains "Checkout: Your Information")
8. Fill in First Name with `Test`
9. Fill in Last Name with `User`
10. Fill in Postal Code/Zip with `100000`
11. Click the "Continue" button

12. Verify the checkout overview page is shown (e.g. title contains "Checkout: Overview")
13. Verify the overview shows:
    - item(s) to purchase
    - item total, tax, and total

14. Click the "Finish" button
15. Verify the checkout complete page is shown (e.g. title contains "Checkout: Complete!")
16. Verify the page shows an order confirmation (e.g. "Thank you for your order!")

17. Click the "Back Home" button
18. Verify the user returns to the inventory/products page
