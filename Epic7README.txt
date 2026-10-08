============================================================
Epic 7 README — Healthier alternatives and nutrition insights
               更健康替代与营养洞察
============================================================

1. What this commit does / 本次提交内容
------------------------------------------------------------
[zh]
- 目录物品详情新增 "Healthier alternatives" 区，给出经审核的更健康替代项
  （名称、包装规格、一句基于营养差异的理由）。
- 替代项可打开查看详情并加入购物篮；"Back to [previous item]" 可逐层退回原物品，
  未提交的数量会被保留；加入只影响当前显示的物品。
- "Why this alternative?" 内联展开营养对比：同一比较基准与单位、两侧营养数据集与
  映射条目、必要的 trade-off；缺失/不可比分别标为 Unavailable / Non-comparable
  （绝不当作 0）；通用食物条目明确披露。
- 替代项来自版本库内的静态营养参考数据（MyFCD / USDA FoodData Central），运行时
  不联网取数；替代项按"有价优先（至少 5 家店报价）→ 中位价最低的两个"挑选，
  产品族无有价候选时保留兜底项。
- 新增后端接口 GET /api/items/{item_code}/healthier-alternatives。

[en]
- Adds a "Healthier alternatives" section to catalogue item details (name,
  package size and a short nutrition-based reason).
- An alternative can be opened and added to the basket; "Back to [previous
  item]" steps back one level and keeps the unsubmitted quantity; adding only
  affects the item currently shown.
- "Why this alternative?" expands an inline nutrition comparison: one shared
  basis with units, the nutrition dataset and mapped entry for both sides, and
  any trade-off. Missing or incompatible values are labelled Unavailable /
  Non-comparable (never zero) and a generic food mapping is disclosed.
- Alternatives come from static reference data kept in the repository (MyFCD /
  USDA FoodData Central); nothing is fetched at runtime. They are chosen
  priced-first (at least 5 price observations) by lowest median price, with a
  fallback when a product family has no priced candidate.
- Adds the backend endpoint GET /api/items/{item_code}/healthier-alternatives.

2. How to verify / 验证方式
------------------------------------------------------------
[zh]
1) Shop 页搜索 "SEBATIAN" → 打开 "BLENDED COOKING OIL BRAND HELANG"。
   预期：两张替代卡片；分别点两处 "Why this alternative?"，对比面板在原物品与
   VECORN / DAISY 之间切换。
2) 搜索 "krimer" → 打开 "SWEETENED CREAMER BERVITAMIN BRAND F&N" → 点
   "Why this alternative?"。预期：显示 "Comparison basis: per 100 g"、带单位的
   营养表、两侧 "Nutrition source"，以及 "Saturated fat: Unavailable"（不是 0）。
3) 点 "Close insights" 收起面板。预期：原物品、数量与购物篮均不变。
4) 测试：cd backend && .venv/Scripts/python -m pytest
        cd frontend && npx pnpm test

[en]
1) Shop → search "SEBATIAN" → open "BLENDED COOKING OIL BRAND HELANG".
   Expected: two alternative cards; select "Why this alternative?" on each and
   the comparison switches between VECORN and DAISY.
2) Search "krimer" → open "SWEETENED CREAMER BERVITAMIN BRAND F&N" → select
   "Why this alternative?". Expected: "Comparison basis: per 100 g", a nutrient
   table with units, "Nutrition source" for both sides, and
   "Saturated fat: Unavailable" (not 0).
3) Select "Close insights". Expected: the item, quantity and basket are
   unchanged.
4) Tests: cd backend && .venv/Scripts/python -m pytest
          cd frontend && npx pnpm test

3. Files changed / 变更文件清单
------------------------------------------------------------
后端 Backend
  backend/smartcart/nutrition.py            (new)
  backend/smartcart/api.py                  (modified)
  backend/smartcart/models.py               (modified)
  backend/tests/test_nutrition.py           (new)
  backend/tests/test_healthier_alternatives.py (new)
数据 Data
  data/nutrition/foods.json                 (new)
  data/nutrition/mappings.json              (new)
  data/nutrition/README.md                  (new)
前端 Frontend
  frontend/lib/nutrition.ts                 (new)
  frontend/lib/nutrition.test.ts            (new)
  frontend/lib/item-stack.ts                (new)
  frontend/lib/item-stack.test.ts           (new)
  frontend/components/healthier-alternatives.tsx (new)
  frontend/components/catalogue-item-dialog.tsx  (modified)
  frontend/components/smartcart-app.tsx     (modified)
  frontend/lib/api.ts                       (modified)
  frontend/lib/i18n.ts                      (modified)
  frontend/app/ui-layout.css                (modified)
证据 Evidence
  docs/evidence/epic7.1screenshot-Zhihao/   (3 files)
  docs/evidence/epic7.2screenshot-Zhihao/   (3 files)
  docs/evidence/epic7.3screenshot-Zhihao/   (4 files)
