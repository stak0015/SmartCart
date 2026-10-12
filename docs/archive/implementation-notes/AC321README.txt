================================================================
AC 3.2.1 README — Compare Pack Ratios (US 3.2)
================================================================

1. 本次提交内容 / What this commit does

中文：
- 商品目录在摄取时解析包装规格数值：item 表新增 quantity_value
  （基准单位数值，kg 或 litre）与 quantity_unit（KG / L）两列，
  摄取脚本按"单位列优先、名称兜底"的规则解析并幂等写入；无法解析
  的商品保持 NULL，不参与比较。
- 商店详情页的篮子商品行新增 "Pack size options" 区块：当某商品在
  当前选中商店存在同品类的多种包装规格时，并排展示全部规格卡片，
  每张卡片显示商品名、规格、总价与单价（RM per kg / per litre），
  按单价升序排列；篮中当前规格带 "Current pack" 标签。
- 价格来自当前选中商店的 PriceCatcher 最新观察价；无多规格或规格
  不可解析的商品不显示该区块，页面不出现错误。
- 接口：POST /api/premises/{premise_id}/basket-alternatives 响应
  每行新增 packOptions 字段，既有字段不变。

English:
- The catalogue ingest now parses pack quantities: the item table gains
  quantity_value (amount in the base unit, kg or litre) and
  quantity_unit (KG / L); the ingest script parses the unit column first
  with the item name as fallback and upserts idempotently. Items that
  cannot be parsed stay NULL and never join the comparison.
- The store detail view adds a "Pack size options" block on each basket
  line: when the item's product family has multiple pack sizes priced at
  the selected store, all sizes are listed side by side, each card
  showing the item name, pack size, total price and price per unit
  (RM per kg / per litre), sorted cheapest unit price first; the
  basket's own pack carries a "Current pack" tag.
- Prices come from the selected store's latest PriceCatcher
  observations; items with a single size or an unparseable quantity show
  no comparison block and never raise an error.
- API: each line of POST /api/premises/{premise_id}/basket-alternatives
  gains a packOptions field; all existing fields are unchanged.

2. 验证方式 / How to verify

中文：
- 后端：cd backend && .venv/Scripts/python -m pytest（49 个用例全绿）；
- 前端：cd frontend && pnpm test && pnpm lint && pnpm build；
- 手动：搜索 "minyak jagung" 添加 MINYAK JAGUNG CAP MAZOLA 1kg →
  起点选 "Kota Bharu, Kelantan"、Car / 15 km → 在 Complete baskets
  选择 PACIFIC HYPERMARKET → 展开 View item prices：玉米油行下方
  出现 7 张规格卡（自 DAISY 3 kg RM42.26 / RM14.09 per kg 起，按
  单价升序），篮中规格带 Current pack 标签；负例：TELUR AYAM
  GRED A（30 biji）不显示该区块。
- 验收截图：docs/evidence/epic3.2screenshot-Zhihao/（2 张）。

English:
- Backend: cd backend && .venv/Scripts/python -m pytest (49 tests
  green);
- Frontend: cd frontend && pnpm test && pnpm lint && pnpm build;
- Manual: search "minyak jagung" and add MINYAK JAGUNG CAP MAZOLA 1kg
  → set origin "Kota Bharu, Kelantan", Car / 15 km → select PACIFIC
  HYPERMARKET in Complete baskets → expand "View item prices": the
  corn-oil line shows 7 pack cards (from DAISY 3 kg RM42.26 / RM14.09
  per kg, cheapest unit price first) with a Current pack tag on the
  basket's own size; negative case: TELUR AYAM GRED A (30 biji) shows
  no comparison block.
- Acceptance screenshots: docs/evidence/epic3.2screenshot-Zhihao/ (2).

3. 变更文件清单 / Files changed

- database/schema.sql：item 表新增 quantity_value / quantity_unit
  （含幂等 ALTER 升级语句）。
- database/ingest_pricecatcher.py：摄取期规格解析 + upsert 新列。
- backend/smartcart/pack_ratios.py（新增）：同品类多规格查询与单价
  计算。
- backend/smartcart/models.py：PackSizeOption 契约 + pack_options
  字段。
- backend/smartcart/api.py：basket-alternatives 响应挂接
  packOptions。
- backend/tests/test_pack_ratios.py（新增）+
  backend/tests/test_alternatives.py：分组/单价/跨单位族/契约用例。
- frontend/lib/contracts.ts：PackSizeOption 类型。
- frontend/lib/i18n.ts：Pack size options 区块双语文案。
- frontend/components/smartcart-app.tsx：篮子行内规格卡片区。
- frontend/lib/i18n.test.ts：文案用例。
- docs/evidence/epic3.2screenshot-Zhihao/：2 张验收截图。
