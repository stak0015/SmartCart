# Probing Questions Prep — US 1.1 / US 2.4 / US 3.4
# 答辩准备 — US 1.1 / US 2.4 / US 3.4（中英对照）

How to use: read each answer aloud once in English, once in Chinese. Keep every answer tied to a real file/function name — the teacher will point at your code while you talk.
用法：每题用英文、中文各读一遍。每个回答都绑定真实的文件/函数名——老师会一边指着代码一边听你讲。

---

## US 1.1 — Search for items in the official catalogue / 搜索官方商品目录

### Q1. Walk me through the search flow, from the search box to the database.
### 请从搜索框到数据库，完整走一遍搜索流程。

**EN:** When the shopper types, the `SearchScreen` in `frontend/components/smartcart-app.tsx` waits 250 ms (a debounce), then calls `searchItems()` in `frontend/lib/api.ts`, which sends `GET /api/items/search?q=...&page=...&category=...` to the FastAPI backend. The route in `backend/smartcart/api.py` delegates to `search_catalogue()` in `catalogue.py`, which runs a parameterised `ILIKE '%q%'` query against `item.item_name`, plus an exact-match category filter, does a `COUNT(*)` for the total, and returns one page of 25 items with `total` and `total_pages`. The frontend then renders that page.

**CN:** 用户输入后，`smartcart-app.tsx` 的 `SearchScreen` 先等 250 毫秒（防抖），再调用 `api.ts` 的 `searchItems()` 发 `GET /api/items/search?q=...&page=...&category=...` 到 FastAPI 后端。`api.py` 的路由转交给 `catalogue.py` 的 `search_catalogue()`：对 `item.item_name` 做参数化 `ILIKE '%q%'` 匹配、分类精确过滤、`COUNT(*)` 求总数，然后返回 25 条一页的结果和 `total`、`total_pages`，前端渲染这一页。

### Q2. Why is pagination server-side instead of loading all 757 items at once?
### 为什么分页放在后端，而不是一次性加载全部 757 条商品？

**EN:** The catalogue has ~757 rows; shipping all of them on every keystroke would waste bandwidth and memory and make the UI janky. The AC requires 25 per page, so `CATALOGUE_PAGE_SIZE = 25` lives in the backend, `offset = (page - 1) * page_size` slices in SQL, and the `COUNT(*)` query gives `total_pages` so the frontend can render "Page X of Y" and disable out-of-range pages.

**CN:** 目录约 757 行，每次按键都全量传输会浪费带宽和内存、界面卡顿。AC 要求每页 25 条，所以后端定义 `CATALOGUE_PAGE_SIZE = 25`，用 `offset = (page - 1) * page_size` 在 SQL 里切片，再用 `COUNT(*)` 算 `total_pages`，前端据此渲染"第 X / Y 页"并禁用越界页码。

### Q3. The user types fast. How do you avoid flooding the backend and stale responses overwriting new ones?
### 用户输入很快时，怎么避免请求轰炸和旧响应覆盖新结果？

**EN:** Two mechanisms. First, a 250 ms `setTimeout` debounce — the timer is cleared on every keystroke, so only a pause triggers a request. Second, an `AbortController`: each effect run creates a controller, passes its signal to `fetch`, and the cleanup function aborts it. If a slow old request finally resolves after a new one started, its promise rejects with `AbortError`, which I explicitly ignore — so it can never overwrite the newer state.

**CN:** 两个机制。一是 250 毫秒防抖：每次按键清掉定时器，只有停顿才发请求。二是 `AbortController`：每次 effect 创建控制器并把 signal 传给 `fetch`，清理函数里中止它。慢的旧请求即使后返回，也会以 `AbortError` 被拒绝，而我显式忽略这个错误——旧响应永远覆盖不了新状态。

### Q4. Why does a single character not trigger a search?
### 为什么只输入一个字符时不搜索？

**EN:** Guard at the top of the effect: `if (query.length === 1) { reset state; return; }`. One character matches almost everything and nothing useful — it would just burn a request and show a wall of noise. The AC's "no items" copy only makes sense for a real query, so I require at least two characters.

**CN:** effect 开头有守卫：`query.length === 1` 时直接重置状态并返回。一个字符几乎匹配所有商品，没有意义，只会浪费请求、刷出一屏噪音。AC 的"无结果"文案只对真实查询有意义，所以至少要两个字符才搜索。

### Q5. What do you show when there are no results, and when the backend is down?
### 无结果和后端宕机时分别显示什么？

**EN:** They are separate states. "Searched, zero rows" shows the exact AC copy (`copy.noItems`). A network/server failure sets `apiError`, which renders a `role="alert"` message in red so screen readers announce it. Loading, empty and error are mutually exclusive in the JSX, so the user is never shown a misleading state.

**CN:** 这是两个独立状态。"搜了但 0 条"显示 AC 原文文案；网络/服务端失败置 `apiError`，渲染带 `role="alert"` 的红色提示，读屏会朗读。加载、空态、错误在 JSX 里互斥，用户永远不会看到误导性状态。

### Q6. Is the keyword query safe from SQL injection? How exactly is it matched?
### 关键词查询防 SQL 注入吗？具体怎么匹配？

**EN:** Yes. The keyword is only embedded into a *pattern string* (`%q%`) that is then passed as a bound parameter to psycopg — it is never concatenated into the SQL text. Matching is `ILIKE` (case-insensitive) on `item_name` only, per the AC ("strictly matches official item name"); categories are a separate exact `= ANY(array)` filter, never keyword-matched.

**CN:** 防。关键词只拼进*模式串*（`%q%`），再作为绑定参数交给 psycopg，从不拼接进 SQL 文本。按 AC 要求只对 `item_name` 做大小写不敏感的 `ILIKE`；分类是独立的精确 `= ANY(array)` 过滤，不参与关键词匹配。

---

## US 2.4 — Recommendation overview / 推荐概览页

### Q1. What happens when the shopper presses "Select store"?
### 用户点 "Select store" 后发生了什么？

**EN:** The card's button calls `onSelectStore`, which does `setSelectedStore(store)` in `CompareScreen` — storing the whole store object as a snapshot. The render then hits an early return: while `selectedStore` is non-null, `RecommendationOverview` replaces the list, receiving the snapshot plus the current `basket`, `preferences` and response metadata. "Back to recommendations" sets it to `null` and the list reappears without refetching.

**CN:** 卡片按钮调 `onSelectStore`，即 `CompareScreen` 里的 `setSelectedStore(store)`——把整个门店对象存成快照。渲染走提前返回：`selectedStore` 非空时 `RecommendationOverview` 替换列表，接收快照加当前 `basket`、`preferences` 和响应元数据。点返回置 `null`，列表原样出现、不重新请求。

### Q2. Why store the whole store object instead of just the premise id?
### 为什么存整个门店对象，而不是只存 premiseId？

**EN:** The AC says the overview must not silently switch to another premise. If I stored only the id and looked the store up in the live list, a background refresh could swap or drop that object and the overview would quietly show different data. A frozen snapshot makes that impossible by construction.

**CN:** AC 要求概览页不得静默切换门店。如果只存 id、再回实时列表里查，后台刷新可能替换或丢失该对象，概览页就会悄悄显示别的数据。存冻结快照从结构上杜绝了这种可能。

### Q3. How did you make "Select store" keyboard- and screen-reader-accessible?
### "Select store" 的键盘和读屏可达性是怎么做的？

**EN:** It is a native `<button type="button">`, so Tab focuses it and Enter/Space activate it for free. Each one gets `aria-label={"Select store " + store.name}` so a screen-reader user with several cards hears which store each button belongs to, and it has a 44 px min touch target.

**CN:** 用原生 `<button type="button">`，Tab 聚焦、回车/空格触发都是免费的。每个按钮带 `aria-label={"Select store " + 店名}`，读屏用户在多张卡片间能听出按钮属于哪家店；触摸目标不小于 44px。

### Q4. How is "Basket + transport total" calculated, especially for an incomplete basket?
### "Basket + transport total" 怎么算？不完整购物篮呢？

**EN:** For a complete basket the backend returns `combinedTotalRm`. For an incomplete one it is null, so I recompute `subtotal + estimatedRoundTripCostRm` on the client and label the banner "Priced items only — missing prices excluded". Missing items are listed, and the notes section states the subtotal excludes them — no silent omission.

**CN:** 完整购物篮时后端直接给 `combinedTotalRm`；不完整时为 null，我在前端用"定价小计 + 预估返程费"重算，并在总条上标注"只含有价商品"。缺失商品会被列出来，说明区写明小计不含它们——绝不静默省略。

### Q5. How do you guarantee the item-level prices reconcile with the totals?
### 怎么保证逐行价格和总额对账一致？

**EN:** Two pure functions in `overview-totals.ts`: `sumPricedLineTotals()` adds only lines that have a price; `overviewTotalRm()` adds subtotal + return travel. Unpriced lines render "No price available at this store" with *no* line total — never RM0.00 — and the reconciliation row shows the three numbers side by side so they visibly agree. Both functions have unit tests.

**CN:** `overview-totals.ts` 里两个纯函数：`sumPricedLineTotals()` 只加有价格的行；`overviewTotalRm()` = 小计 + 返程费。无价格的行显示 "No price available at this store" 且**不显示**行合计——绝不显示 RM0.00；对账行把三个数并排展示，肉眼可见一致。两个函数都有单元测试。

### Q6. Why does the page avoid words like "cheapest" or "in stock"?
### 为什么页面上不写 "cheapest"、"in stock" 这类词？

**EN:** The AC explicitly forbids unsupported affordability or verified-stock claims. Prices come from periodic PriceCatcher observations and routes are Google estimates, so the honest statement is "ranking = priced subtotal + estimated return transport; route values are estimates". I display exactly that, plus `routeWarning` when the route fell back to straight-line estimates.

**CN:** AC 明确禁止无依据的可负担性或库存断言。价格来自 PriceCatcher 的定期观测、路线是谷歌估算，所以诚实的说法是"排名 = 定价小计 + 预估返程费；路线值为估算"。我就展示这句话，并在路线退化为直线估算时显示 `routeWarning`。

---

## US 3.4 — Show potential savings / 展示潜在节省

### Q1. Where does the savings data come from?
### 省钱数据从哪来？

**EN:** Teammates' US 3.1–3.3 produce it: applying "Swap & save" calls `applyBasketSwap()` (`basket-state.ts`), which replaces the basket line and stamps it with a `swap` record holding the original item and both unit prices. My US 3.4 code only *reads* that record — `basketSavingsSummary()` in `savings-summary.ts` walks the basket, and per swapped line uses `currentSwapSavingRm()` = (source − alternative) × qty.

**CN:** 数据来自队友的 3.1–3.3：点 "Swap & save" 调 `applyBasketSwap()`（`basket-state.ts`），替换购物篮行并打上 `swap` 记录，里面保存原商品和前后单价。我的 3.4 代码只*读*这个记录——`savings-summary.ts` 的 `basketSavingsSummary()` 遍历购物篮，对每个被替换行用 `currentSwapSavingRm()` =（原价 − 替代价）× 数量。

### Q2. AC 3.4.2 requires the per-item savings to sum to the total. How do you guarantee that?
### AC 3.4.2 要求逐行省额之和等于总省额，你怎么保证？

**EN:** By construction, not by assertion. `totalSavedRm` is the rounded sum of the per-line `savedRm`; `originalRm` is the sum of per-line original amounts; and `newRm` is *derived* as `originalRm − totalSavedRm` (same per line). Because the new totals are computed from the differences, "sum of parts = total = original − new" can never disagree. A unit test with two swaps (integer and decimal prices) asserts the reconciliation anyway.

**CN:** 靠结构保证，而不是靠断言。`totalSavedRm` 是逐行 `savedRm` 的舍入和；`originalRm` 是逐行原金额之和；`newRm` 由 `originalRm − totalSavedRm` *推导*（逐行同理）。新金额都从差值算出，"逐行之和 = 总额 = 原 − 新" 永远不可能不一致。另有含整数和小数价格的双替换单元测试做对账断言。

### Q3. What does the summary show before any swap is applied?
### 还没应用任何替换时摘要显示什么？

**EN:** `hasSavings` is false, so the component renders the AC 3.4.3 empty state: "No savings applied yet" plus a prompt to review the "Smart Budget Alternatives" section — both strings come from `i18n.ts` in English and Malay, and the prompt interpolates the section title so the proper noun always matches.

**CN:** `hasSavings` 为 false 时组件渲染 AC 3.4.3 的空态："No savings applied yet" 加一句引导查看 "Smart Budget Alternatives"——两句文案都在 `i18n.ts` 里有英文和马来文，引导句通过插值引用区块标题，专名永远一致。

### Q4. You render the summary in two places. Why, and how do the totals differ there?
### 摘要渲染了两处，为什么？两处的总额口径有何不同？

**EN:** On the basket screen there is no store context, so the component falls back to the swap lines' own original/new totals — enough to show "You save RM X". In the overview I pass store-level figures: `storeOriginalTotalRm = store.basketSubtotalRm` (the store's priced subtotal before swaps) and `storeNewTotalRm = adjustedSubtotal` (the existing variable the overview computes as subtotal − applied savings). In both places the "You save" amount always comes from the per-line sum, so 3.4.2 holds in either view.

**CN:** 购物篮页没有门店上下文，组件回退用替换行自身的原/新总额——足够显示 "You save RM X"。概览页我传门店口径：`storeOriginalTotalRm = store.basketSubtotalRm`（替换前该店定价小计），`storeNewTotalRm = adjustedSubtotal`（概览页现成的"小计 − 已应用节省"变量）。两处的 "You save" 都来自逐行之和，所以 3.4.2 在哪个视图都成立。

### Q5. Why does the summary update automatically after Swap / Undo?
### 为什么 Swap / Undo 之后摘要会自动更新？

**EN:** No extra wiring. `SavingsSummary` derives everything from the `basket` prop. `applyAlternative` and `undoAlternative` already call `onSetBasket(...)`, and `undoBasketSwap` restores the original from `swap.original` — the basket reference changes, React re-renders the overview and basket screens, and the summary recomputes. Undo brings it back to the empty state.

**CN:** 不需要额外接线。`SavingsSummary` 的一切都由 `basket` prop 推导。`applyAlternative` / `undoAlternative` 本来就调 `onSetBasket(...)`，`undoBasketSwap` 从 `swap.original` 恢复原商品——购物篮引用变化，React 重渲染两个页面，摘要自动重算。Undo 后回到空态。

### Q6. Why a pure function plus unit tests instead of computing inline in the component?
### 为什么抽成纯函数加单元测试，而不是在组件里内联计算？

**EN:** Money math is exactly where rounding bugs hide, and a React component is the worst place to test it. A pure `basketSavingsSummary(basket)` is deterministic, reused by both screens, and covered by four vitest cases (no swap / one / two / undo). It also matches the project's existing pattern, like `overview-totals.ts`.

**CN:** 金额计算最容易藏舍入 bug，而 React 组件是最不适合测试它的地方。纯函数 `basketSavingsSummary(basket)` 确定性强、两个页面复用，并有 4 个 vitest 用例（无替换/单个/两个/撤销）。这也符合项目既有模式，比如 `overview-totals.ts`。

---

## General / 通用问题

### G1. Which parts of Epic 3 are yours and which are your teammates'?
### Epic 3 哪些是你的、哪些是队友的？

**EN:** My branch `randy/us3.4` is built on their merged 3.1–3.3. They own the alternatives endpoint and the swap/undo UI; I own everything US 3.4: `savings-summary.ts` + tests, the i18n keys, the `SavingsSummary` component and its two render sites. I can explain their interfaces because my code consumes `AppliedSwap`, `currentSwapSavingRm` and `adjustedSubtotal` — and I'd say so honestly if asked beyond that.

**CN:** 我的分支 `randy/us3.4` 建在他们已合并的 3.1–3.3 之上。替代商品接口和 swap/undo 界面是他们的；US 3.4 全部是我的：`savings-summary.ts` + 测试、i18n 键、`SavingsSummary` 组件和两处渲染。我能解释他们的接口，因为我的代码消费 `AppliedSwap`、`currentSwapSavingRm`、`adjustedSubtotal`——超出部分我会如实说明边界。

### G2. Something broke during development. Tell me about it.
### 开发中出过什么问题？讲讲。

**EN:** Two good stories. One: recommendations returned 500 — I reproduced the backend call directly and found the `premise` table was missing `latitude/longitude` columns; the new `schema.sql` had an idempotent `ADD COLUMN IF NOT EXISTS` migration that had never been re-applied, so I applied it. Two: location search returned 502 — calling Google directly revealed "API key expired", a configuration issue, not a code bug. Both show my method: reproduce, read the real error, fix the root cause.

**CN:** 两个例子。一是推荐接口 500——我直接复现后端调用，发现 `premise` 表缺 `latitude/longitude` 列；新版 `schema.sql` 里有幂等补列迁移但从未重跑，我应用后修复。二是地点搜索 502——直接调谷歌发现 "API key expired"，是配置问题不是代码 bug。两个例子都体现我的方法：先复现、读真实错误、修根因。

### G3. How did you verify your work?
### 你怎么验证你的工作？

**EN:** Three layers: unit tests for every pure money/summary function (`pnpm test`, all green including mine), `pnpm lint` and `pnpm build` clean, and a manual end-to-end pass in the browser for each AC — including the negative cases (incomplete basket, no price at store, no savings applied). Screenshots are kept under `docs/evidence`.

**CN:** 三层：每个纯金额/汇总函数都有单元测试（`pnpm test` 全绿含我的）；`pnpm lint`、`pnpm build` 干净；每条 AC 在浏览器手工走一遍端到端，包括负面用例（不完整购物篮、门店无价格、未应用节省）。截图存于 `docs/evidence`。
