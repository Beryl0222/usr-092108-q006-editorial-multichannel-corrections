# 评论稿多端更正链

本仓库保存该服务的领域资料与事件结构约定，供业务团队在统一语义上继续建设。

## 已有内容

- `contracts/domain.schema.json`：事件信封与各事件类型的结构约定（JSON Schema）。
- `data/sample.json`：首条领域记录。
- `data/lineage-walkthrough.json`：一次完整“选题 → 核查 → 候选确认 → 五端发布 → 撤改 → 分端处置 → 回执对账 → 引用更新 → 影响评估”的联调样例。
- `src/`：事件结构校验（信封、枚举与各事件类型的必备字段），不保存状态、不编排业务流程。
- `tests/`：验证样例与约定一致，并拦截关键结构错误。

## 领域模型

### 聚合

| aggregate_type | 含义 |
| --- | --- |
| `editorial_item` | 稿件本体：选题会意见、作者稿、编辑修订、核查与影响评估的主轴 |
| `source_claim` | 事实来源与外部引用（含敏感线索） |
| `ai_candidate` | 自动生成的标题/摘要候选 |
| `channel_variant` | 某一端的适配产物（版面、正文、口播脚本、卡片、推荐流素材）及其发布状态 |
| `correction_action` | 一次撤改决定及其分端处置 |
| `platform_receipt` | 合作平台回执的接收记录，`receipt_id` 为幂等键 |

### 事件

| event_type | 聚合 | 含义 |
| --- | --- | --- |
| `TOPIC_MEETING_LOGGED` | editorial_item | 选题会意见登记 |
| `SOURCE_REGISTERED` | source_claim | 事实来源登记（敏感线索标 `sensitivity: restricted`） |
| `DRAFT_SUBMITTED` / `DRAFT_REVIEWED` | editorial_item | 作者稿提交 / 编辑修订 |
| `CHECK_RECORDED` | editorial_item | 法务或业务核查（`check_type`: legal / business） |
| `AI_CANDIDATE_PROPOSED` | ai_candidate | 自动标题/摘要候选，`status` 恒为 `candidate` |
| `AI_CANDIDATE_CONFIRMED` | ai_candidate | 责任编辑确认候选（`confirmed_by`） |
| `VARIANT_PREPARED` / `VARIANT_APPROVED` | channel_variant | 平台适配就绪 / 责任编辑确认适配稿 |
| `PUBLISH_WINDOW_SET` | channel_variant | 设定该端发布时间窗 |
| `PUBLICATION_CONFIRMED` | channel_variant | 该端正式发布，必须带 `confirmed_by` |
| `CORRECTION_ORDERED` | correction_action | 撤改决定（原因、下令人与涉及渠道、事实） |
| `DISPOSITION_EXECUTED` | correction_action | 分端处置执行，必须声明 `coverage` |
| `RECEIPT_RECORDED` | platform_receipt | 合作平台回执接收（按事实追加，含重复与乱序） |
| `CHANNEL_RECONCILED` | channel_variant | 回执/处置对账，给出当前 `effective_version` |
| `SOURCE_UPDATED` | source_claim | 外部引用后续更新 |
| `IMPACT_ASSESSED` | editorial_item | 评估哪些观点仍成立、哪些事实必须修正 |

事件之间通过 `refs`（`parent` / `source` / `candidate` / `variant` / `receipt` / `target`）连成稿件谱系。

### 渠道与处置矩阵

| 渠道 | channel | 允许的处置 | 结构要求 |
| --- | --- | --- | --- |
| 纸版 | `print` | `correction_notice` | 不可撤回，必须提供可定位的 `locator`（日期、版面、栏目） |
| 客户端 | `client_app` | `replace_body` | 必须提供 `revision_ref` 保留修订记录 |
| 短视频 | `short_video` | `annotate` / `recut` / `takedown` | 单处错误可注释、重剪或下架 |
| 社交平台卡片 | `social_card` | `replace_card` / `annotate` | — |
| 合作平台推荐流 | `partner_feed` | `update_request` / `takedown_request` | 以回执对账确认实际结果 |

每种处置都必须声明 `coverage`：覆盖的受众（`audience`）与传播副本（`propagation_copies`，如缓存、剪辑副本、算法二次包装素材）。

## 关键不变量

1. **事件不可改写**：标识、发生时间、版本一经接收不得原地修改；业务更正产生后继记录，同一聚合的版本单调递增。
2. **自动内容只是候选**：AI 生成的标题/摘要 `status` 恒为 `candidate`；正式发布（`PUBLICATION_CONFIRMED`）必须携带 `confirmed_by`，即责任编辑确认。
3. **回执幂等与有序**：回执按接收事实追加，重复上报共享 `receipt_id`；对重复或乱序回执，`CHANNEL_RECONCILED` 只能记 `ignored_duplicate` / `ignored_stale` 并说明原因，不得把旧版重新置顶（`effective_version` 不得回退）。
4. **敏感线索受限流转**：`sensitivity: restricted` 的事件，`visibility` 只能包含核查角色（`legal_reviewer`、`business_reviewer`）；调用方只读取完成职责所必需的字段。
5. **读者侧单一有效版本**：任一端入口展示 `effective_version` 对应的当前内容与必要的更正提示。
6. **可审计**：从一次舆情争议出发，可沿 `refs` 还原依据、审批与各渠道实际执行结果。

## 本地检查

```bash
node --test
```
