AC 3.2.3 - Value trade-off on pack size comparison
AC 3.2.3 - 规格比价卡上的价值取舍说明

[What this change does / 本次提交内容]

Backend
- Every pack option now carries its trade-off against the Best value
  option: upfrontDiffRm (total-price difference) and perUnitDiffRm
  (unit-price difference), computed in full-precision Decimal and
  rounded only for display. Because Best value is the cheapest unit
  price, perUnitDiffRm is never negative.
- The Best value card itself carries null for both fields; the client
  renders it as the comparison baseline.
- Fields are pure additions to PackSizeOption (isBestValue /
  upfrontDiffRm / perUnitDiffRm); no existing field name or semantics
  changed.

后端
- 每个规格选项现在带有相对 Best value 选项的取舍差异：
  upfrontDiffRm（总价差）与 perUnitDiffRm（单价差），以 Decimal
  全精度计算、仅显示时取整。由于 Best value 即最低单价，
  perUnitDiffRm 恒不为负。
- Best value 卡自身两字段为 null，客户端将其渲染为比价基准。
- 字段均为 PackSizeOption 纯新增（isBestValue / upfrontDiffRm /
  perUnitDiffRm），既有字段名与语义未动。

Frontend
- Each pack card shows both the immediate spending (total price) and
  the long-term value (price per unit), plus a trade-off line under
  them, e.g. "RM 0.41 more now · RM 0.14/kg more"; the Best value
  card shows "Lowest price per unit — the baseline" instead.
- The client only formats the signed amounts and picks direction words
  (more/less/same); all arithmetic stays server-side. New copy keys
  (bestValueBaseline, packTradeoff) live in i18n.ts with English and
  Malay versions; nothing is hard-coded in the component.

前端
- 每张规格卡同时显示即时支出（总价）与长期价值（单价），并在下方
  给出取舍行，如 "RM 0.41 more now · RM 0.14/kg more"；Best value
  卡改显示 "Lowest price per unit — the baseline"（基准说明）。
- 前端只格式化带符号金额并选择方向词（more/less/same），全部
  算术留在后端。新文案 key（bestValueBaseline、packTradeoff）
  集中在 i18n.ts，含英文与马来语版本，组件内无硬编码文案。

[How it was verified / 验证方式]

- Backend: pytest backend/tests - 51 passed, including a new case
  asserting the money identity (upfront diff reconciles with displayed
  totals to the sen, per-unit diff never negative, baseline card null).
- Frontend: pnpm vitest 54 passed (new cases: verbatim trade-off copy
  for more/less/same, litre unit, Malay translation, baseline note in
  both languages); pnpm lint clean; pnpm build ok.
- API check: GET alternatives for premise 3, item 107 returns 8 pack
  options; the Best value card (item 183, RM 13.78/kg) carries null
  diffs, the other 7 carry correct signed differences computed at full
  precision (e.g. item 450: upfront -12.56, per-unit +0.61).
- UI check: premise 109 PACIFIC HYPERMARKET (Kota Bharu), basket with
  MINYAK JAGUNG CAP MAZOLA 1kg - baseline note on the Best value card
  and trade-off lines on all other cards, alongside the cheaper
  alternative; screenshot saved under
  docs/evidence/epic3.2screenshot-Zhihao/.

- 后端：pytest backend/tests 共 51 项通过，含 1 个新用例验证金额
  恒等式（总价差与显示总价对账到分位、单价差恒非负、基准卡为
  null）。
- 前端：pnpm vitest 54 项通过（新用例：more/less/same 取舍文案
  逐字、升单位、马来语译文、基准说明双语存在）；pnpm lint 零
  告警；pnpm build 成功。
- API 实测：premise 3 + item 107 返回 8 个规格选项；Best value 卡
  （item 183，RM 13.78/kg）差异为 null，其余 7 卡带正确的带符号
  差异，按全精度计算（如 item 450：upfront -12.56、per-unit
  +0.61）。
- 界面实测：premise 109 PACIFIC HYPERMARKET（Kota Bharu），篮中
  MINYAK JAGUNG CAP MAZOLA 1kg——Best value 卡显示基准说明、其余
  卡显示取舍行，与更便宜替代品同屏；截图存于
  docs/evidence/epic3.2screenshot-Zhihao/。

[Files changed / 变更文件清单]
- backend/smartcart/pack_ratios.py        - trade-off diffs vs the Best value option
- backend/smartcart/models.py             - PackSizeOption.upfront_diff_rm / per_unit_diff_rm
- backend/tests/test_pack_ratios.py       - trade-off identity test case
- frontend/lib/contracts.ts               - PackSizeOption.upfrontDiffRm / perUnitDiffRm
- frontend/lib/i18n.ts                    - bestValueBaseline + packTradeoff copy (EN/BM)
- frontend/lib/i18n.test.ts               - trade-off copy tests
- frontend/components/smartcart-app.tsx   - trade-off line / baseline note on pack cards
- docs/evidence/epic3.2screenshot-Zhihao/ac323-value-tradeoff.png - UI evidence
