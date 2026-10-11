US iteration1 feedback Build Notes / 构建说明
Iteration 1 Feedback Updates
迭代1 反馈修改

------------------------------------------------------------
1. 中文

购物篮计数：修改前，篮子面板标题与比价屏只显示单一计数（如 "3 items"），含义不清（总件数或商品种类数）。修改后，购物篮面板标题与比价屏 "Basket:" 处同时显示总件数与不同商品种类数，如 "3 items · 2 products"（items=总件数、products=不同商品行数）。

English:
Basket counts: previously the basket panel heading and the compare screen showed a single count (e.g. "3 items") whose meaning (total units vs product kinds) was unclear. After this change they show both the total number of units and the number of different products, e.g. "3 items · 2 products" (items = total units, products = distinct product rows).

------------------------------------------------------------
2. 中文

无匹配扩距：修改前，当所选出行范围内无可达门店时，比价结果为空，只提示用户调整范围。修改后，后端自动扩大搜索范围并返回最近门店，响应标记 expandedSearch 与每店 exceedsLimit；前端在比价屏顶部显示提示条（所选范围内无门店，显示最近门店，已超出设定距离/时间），门店卡显示"超出出行范围"标签。

English:
Expanded search: previously, when no reachable store was inside the chosen travel limit, the comparison returned nothing and only asked the user to widen the range. After this change the backend automatically widens the search and returns the nearest stores, marking the response with expandedSearch and each store with exceedsLimit; the frontend shows a notice at the top of the compare screen and a "Beyond travel limit" label on each store card.

------------------------------------------------------------
3. 中文

公交步行图标：修改前，出行方式页的"公共交通"选项只显示公交图标。修改后，该选项同时显示步行图标与公交图标（贴合 Google Maps 的 transit 呈现），比价/概览视图的行程信息顶部也按所选出行方式显示对应交通图标，让"公共交通含步行"始终可见。

English:
Public transport walking indicator: previously the "Public transport" option on the travel screen showed only a transit icon. After this change it shows both a walking icon and a transit icon, matching Google Maps' transit presentation; the travel-details block in the compare and overview views also shows the matching transport icon, so the walking leg is always visible.

------------------------------------------------------------
4. 中文

总价构成：修改前，"Combined total" 块只显示单一总价（如 "RM101.16"），用户看不出构成。修改后，该块价格显示为方程"购物小计 + 往返交通费 = 总价"（如 "RM14.00 + RM87.16 = RM101.16"），保留后缀"Basket subtotal + Return travel"（部分缺价时"Partial total + Return travel"）；英文与马来语均正确显示。

English:
Total cost composition: previously the "Combined total" block showed only a single total (e.g. "RM101.16") with no breakdown. After this change the block shows the price as the equation "basket subtotal + return travel = total" (e.g. "RM14.00 + RM87.16 = RM101.16"), keeping the suffix "Basket subtotal + Return travel" (or "Partial total + Return travel" when prices are missing); both English and Malay display correctly.
