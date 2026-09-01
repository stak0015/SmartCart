AC 3.2.2 - Best value label on pack size comparison
AC 3.2.2 - 规格比价卡上的 "Best value" 标签

[What this change does / 本次提交内容]

Backend
- Each packOptions comparison now marks exactly one option with
  isBestValue: the option with the lowest price per unit, computed at
  full Decimal precision before any display rounding.
- Tie-break order when unit prices are equal: newest observed price,
  then item name, then item id. The ranking already runs in this order,
  so the head of each ranked list carries the label.
- New field: PackSizeOption.is_best_value (default false), serialised as
  isBestValue in the camelCase API response.

后端
- 每组 packOptions 比价现在为恰好一个规格标记 isBestValue：即单价
  最低者，比较在 Decimal 全精度上进行，不受显示四舍五入影响。
- 单价相同时的平局判定顺序：最新观察价 → 物品名称 → 物品 id。
  排序本身已按此顺序进行，因此每组排名第一者即为 Best value。
- 新增字段：PackSizeOption.is_best_value（默认 false），在
  camelCase API 响应中序列化为 isBestValue。

Frontend
- The pack size card for the Best value option shows a green "Best
  value" badge (the English wording is kept verbatim per the acceptance
  criterion; the Malay UI shows "Nilai terbaik") and a green ring, while
  other cards keep the neutral background.
- The badge sits next to the existing "Current pack" marker, and the
  pack size strip still appears alongside the cheaper alternative line,
  so the best-value pack is visible on the same screen.

前端
- Best value 规格的卡片显示绿色 "Best value" 徽章（按验收标准英文
  逐字保留；马来语界面显示 "Nilai terbaik"）并加绿色描边，其余
  卡片保持中性底色。
- 徽章与现有 "Current pack" 标记并列，规格条仍与更便宜替代品同屏
  显示，Best value 规格在同一屏幕可见。

[How it was verified / 验证方式]

- Backend: pytest backend/tests - 50 passed, including two new cases:
  exactly one Best value per comparison, and a full-precision tie broken
  by the newest observed price.
- Frontend: pnpm vitest 52 passed (new case: English label kept
  verbatim, Malay translation present); pnpm lint clean; pnpm build ok.
- API check: GET alternatives for premise 3, item 107 returns 8 pack
  options with exactly one isBestValue (VECORN 3 kg, RM 13.78/kg).
- UI check: premise 109 PACIFIC HYPERMARKET (Kota Bharu), DAISY 3 kg
  carries the only "Best value" badge in its comparison group;
  screenshot saved under docs/evidence/epic3.2screenshot-Zhihao/.

- 后端：pytest backend/tests 共 50 项通过，含 2 个新用例：每组恰有
  一个 Best value；全精度平局时取最新观察价。
- 前端：pnpm vitest 52 项通过（新用例：英文标签逐字保留、马来语
  译文存在）；pnpm lint 零告警；pnpm build 成功。
- API 实测：premise 3 + item 107 返回 8 个规格选项，恰有 1 个
  isBestValue（VECORN 3 kg，RM 13.78/kg）。
- 界面实测：premise 109 PACIFIC HYPERMARKET（Kota Bharu）中
  DAISY 3 kg 为其比价组内唯一 "Best value" 徽章；截图存于
  docs/evidence/epic3.2screenshot-Zhihao/。

[Files changed / 变更文件清单]
- backend/smartcart/pack_ratios.py        - best-value pick in get_pack_options
- backend/smartcart/models.py             - PackSizeOption.is_best_value field
- backend/tests/test_pack_ratios.py       - 2 new best-value test cases
- frontend/lib/contracts.ts               - PackSizeOption.isBestValue field
- frontend/lib/i18n.ts                    - bestValue copy (EN "Best value" / BM "Nilai terbaik")
- frontend/lib/i18n.test.ts               - best-value copy test
- frontend/components/smartcart-app.tsx   - badge + green ring on the Best value card
- docs/evidence/epic3.2screenshot-Zhihao/ac322-best-value-label.png - UI evidence
