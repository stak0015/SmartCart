Alignment of Historical Code with AC Requirements
历史代码与 AC 需求对齐说明
==================================================

Scope / 范围
This note records how the existing checklist and catalogue code was aligned
with the acceptance criteria: AC 5.1.1-5.1.5, AC 5.2.1-5.2.3, and AC 1.3.2.
本文档记录既有清单与目录代码与各验收标准的对齐情况：
AC 5.1.1-5.1.5、AC 5.2.1-5.2.3、AC 1.3.2。

--------------------------------------------------

AC 5.1.1 — Start a checklist / 开启购物清单

对齐内容 / Alignment target
- 清单快照须保存商店、购物日期、计划小计、估算往返交通（标注为估算值）
  与计划合计。
- The checklist snapshot must keep the store, shopping date, planned
  subtotal, estimated return transport (labelled as an estimate), and the
  planned combined total.

对齐所作的修改 / Changes made for alignment
- 快照新增并持久化三个字段：plannedSubtotalRm、estimatedRoundTripCostRm、
  plannedCombinedTotalRm（未知时为 null）。
- The snapshot now persists plannedSubtotalRm, estimatedRoundTripCostRm, and
  plannedCombinedTotalRm (null when unknown).
- 新增本地存储迁移机制：字段补齐前写入的旧版清单仍可正常读取，未知版本
  或损坏数据安全忽略。
- A storage migration path was added: older saved checklists still load, and
  unknown or corrupted data is ignored safely.
- 推荐概览页的清单入口按钮文案定为 "Start checklist"。
- The checklist entry on the recommendation overview now reads
  "Start checklist".

--------------------------------------------------

AC 5.1.2 — Checklist lines / 清单行

对齐内容 / Alignment target
- 每个篮子行在清单中恰出现一次，含名称（本地语言，回退原名）、规格、
  计划数量、参考价来源与购买状态；行按商品 ID 键控。
- Every basket line appears exactly once with its name (local language with
  original-name fallback), package size, planned quantity, reference price
  source, and purchase status; lines are keyed by item ID.

对齐所作的修改 / Changes made for alignment
- 既有实现已满足该验收标准，无代码修改。
- The existing implementation already met this criterion; no code change.
- 本文档补充说明行键格式：目录行键为 catalogue-<itemId>-<index>（键内含
  商品 ID 且全局唯一）；自定义行使用稳定的本地 ID，前缀为 manual-。
- This note documents the line-key format: catalogue lines are keyed as
  catalogue-<itemId>-<index> (the key contains the item ID and is unique);
  custom lines use a stable local ID with the manual- prefix.

--------------------------------------------------

AC 5.1.3 — Lines with no official price / 无官方店价的行

对齐内容 / Alignment target
- 无官方店价的行标注为 unavailable；跨店参考价单独标注，绝不冒充店价
  或在库证明。
- Lines without an official store price are labelled unavailable; a
  cross-store reference price is labelled separately and never presented as
  the store's price or proof of stock.

对齐所作的修改 / Changes made for alignment
- 既有实现已满足该验收标准，无代码修改。
- The existing implementation already met this criterion; no code change.

--------------------------------------------------

AC 5.1.4 — Accessible and saved / 可访问且已保存

对齐内容 / Alignment target
- 勾选与行操作可键盘与读屏使用；清单保存在本设备、刷新不丢失；后续编辑
  篮子不改写已保存的快照。
- Checking and line edits work with keyboard and screen reader; the
  checklist is stored on the device and survives refreshes; later basket
  edits never rewrite a saved snapshot.

对齐所作的修改 / Changes made for alignment
- 既有实现已满足该验收标准，无代码修改；本次新增的迁移机制进一步保证
  旧版已存清单在字段演进后仍能正常读取。
- The existing implementation already met this criterion; the new migration
  path additionally keeps older saved checklists readable after the field
  changes.

--------------------------------------------------

AC 5.1.5 — Add my own item / 添加自定义商品

对齐内容 / Alignment target
- 自定义行名称与数量必填，数量为任意正整数；价格可留空；填入价格须为
  正数 RM、最多两位小数。
- Custom items require name and quantity; quantity is any positive whole
  number; price may be left blank; an entered price must be a positive RM
  amount with at most two decimals.

对齐所作的修改 / Changes made for alignment
- 价格改为可留空：留空时该行小计留空，绝不显示 RM0.00。
- The price is now optional: a blank price leaves the line total empty and
  never shows RM0.00.
- 数量上限（99）已移除，接受任意正整数。
- The quantity cap (99) was removed; any positive whole number is accepted.
- 非法输入仍给出可读报错（名称为空、数量非正整数、价格非正数或超过
  两位小数）。
- Invalid input still produces readable errors (missing name, non-positive
  or non-whole quantity, non-positive or over-two-decimal price).

--------------------------------------------------

AC 5.2.1 — Check off what I bought / 勾选已购商品

对齐内容 / Alignment target
- 勾选行即标记 Purchased，完成计数即时更新，且不改变计划数量。
- Checking a line marks it Purchased, updates the completion count
  immediately, and never changes the planned quantity.

对齐所作的修改 / Changes made for alignment
- 既有实现已满足该验收标准，无代码修改。
- The existing implementation already met this criterion; no code change.

--------------------------------------------------

AC 5.2.2 — Not bought and out-of-stock states / 未购买与缺货状态

对齐内容 / Alignment target
- 行可保持 Not purchased 或标记 Out of stock；两种状态互斥，且都与
  Purchased 互斥；状态纯本地，不发送任何地方。
- A line can stay Not purchased or be marked Out of stock; the two states
  are distinct and both exclude Purchased; the record stays on the device.

对齐所作的修改 / Changes made for alignment
- 行状态模型新增 out_of_stock；每行新增 "Not bought" 与 "Out of stock"
  标记按钮，三者与勾选共用同一互斥状态字段，同一时刻只处于一种状态；
  再次点击已激活标记可清除。
- A new out_of_stock state was added; every line now offers "Not bought" and
  "Out of stock" markers sharing one mutually exclusive status field;
  pressing an active marker clears it.
- 进度计数单独统计缺货行；状态随清单一并本地持久化。
- Out-of-stock lines are counted separately in the progress data and persist
  locally with the checklist.
- 2026-09-14 修订：缺货登记因违反选题禁区"无论坛博客众包"废除，
  out_of_stock 状态已从前端回退移除，AC 5.2.2 原文同步改写为仅
  Not purchased 口径（EpicsUser StoriesAC_实际v4.txt）；旧本地数据
  读取时自动降级为 not_bought。本节上文为废除前的历史对齐记录，
  保留备查。
- 2026-09-14 revision: out-of-stock marking was abolished under the
  "no crowdsourcing" topic ban; the out_of_stock state was rolled back
  from the frontend and AC 5.2.2 was rewritten to the Not-purchased-only
  wording (EpicsUser StoriesAC_实际v4.txt). Legacy on-device data degrades
  to not_bought on read. The section above is the pre-abolition historical
  record, kept for reference.

--------------------------------------------------

AC 5.2.3 — Empty and unfinished checklists / 空清单与未完成清单

对齐内容 / Alignment target
- 空清单显示空态，绝不保存虚构零总额的记录。
- An empty checklist shows an empty state and never saves a record with a
  made-up zero total.

对齐所作的修改 / Changes made for alignment
- 既有实现已满足该验收标准，无代码修改。
- The existing implementation already met this criterion; no code change.

--------------------------------------------------

AC 1.3.2 — Show explicit SARA-eligibility flag / 显示明确的 SARA 资格标记

对齐内容 / Alignment target
- SARA 品类候选须显示 "Potential SARA item · verify label/barcode"。
- SARA category candidates must show "Potential SARA item · verify
  label/barcode".

对齐所作的修改 / Changes made for alignment
- 英文文案补全为 "Potential SARA item · verify label/barcode"，马来语为
  "Item SARA berpotensi · sahkan label/barkod"。
- The English copy was completed to "Potential SARA item · verify
  label/barcode", with the Malay copy "Item SARA berpotensi · sahkan
  label/barkod".
