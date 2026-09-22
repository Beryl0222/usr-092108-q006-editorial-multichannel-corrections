# 评论稿多端更正链

本仓库保存该服务的领域资料与最小事件约定，供业务团队在统一语义上继续建设。

## 已有内容

- `contracts/domain.schema.json`：领域事件的基础字段、聚合类型和事件名称。
- `data/sample.json`：单条样例记录。
- `data/lineage.sample.json`：一条完整谱系样例——从选题会到五端发布、回执对账、来源更新与多端更正。
- `src/`：只负责校验基础事件信封，不包含业务流程。
- `tests/`：验证样例与基础约定一致，并把关键领域规则固化为对样例的断言。

## 领域边界

当前资料围绕稿件谱系、多端适配和更正策略整理。事件一旦被接收，其标识、发生时间和版本不应被原地改写；业务更正应产生后继记录。涉及个人、机构或商业敏感信息时，调用方只读取完成职责所必需的字段。

## 事件词汇

稿件谱系按以下事件串联（聚合类型标注于后）：

| 事件 | 含义 | 聚合 |
| --- | --- | --- |
| `TOPIC_CONFERENCE_RECORDED` | 选题会意见 | editorial_item |
| `SOURCE_REGISTERED` | 事实来源登记或外部来源后续更新 | source_claim |
| `DRAFT_SUBMITTED` / `DRAFT_REVIEWED` | 作者稿、编辑修订 | editorial_item |
| `FACT_CHECK_COMPLETED` | 法务或业务核查 | source_claim |
| `TITLE_SUMMARY_CANDIDATE_PROPOSED` | 自动标题/摘要，仅候选 | editorial_item |
| `TITLE_SUMMARY_CONFIRMED` | 责任编辑确认后生效 | editorial_item |
| `VARIANT_PREPARED` / `VARIANT_APPROVED` | 平台适配（含口播脚本）与签发 | channel_variant |
| `PUBLICATION_CONFIRMED` | 按发布时间窗确认发布 | channel_variant |
| `CHANNEL_RECEIPT_RECORDED` | 合作平台回执 | channel_variant |
| `CORRECTION_ORDERED` / `CORRECTION_EXECUTED` | 撤改决定与单端处置 | correction_action |
| `CHANNEL_RECONCILED` | 多端对账完成 | editorial_item |

## 关键规则

- **自动内容只作候选**：`TITLE_SUMMARY_CANDIDATE_PROPOSED` 的 `status` 恒为 `candidate`，须经 `TITLE_SUMMARY_CONFIRMED` 署名确认后才允许任何 `VARIANT_APPROVED`。
- **回执幂等且不乱序生效**：`CHANNEL_RECEIPT_RECORDED` 按 `receipt_id` 去重；指向旧版本的回执记录为 `applied: false` 并给出 `ignored_reason`（如 `stale_version_no_repin`），不得把旧版重新置顶。
- **分渠道更正策略**：纸版不可撤回，发布带 `locator` 的更正说明（`correction_notice`）；客户端替换正文但保留修订记录（`replace_with_history`）；短视频只错一处时可在 `annotate` / `reedit` / `takedown` 中选择。每条 `CORRECTION_EXECUTED` 必须写明 `audience_covered` 与 `copies_covered`，不可控副本（截图、搬运）如实记录。
- **来源更新驱动影响评估**：外部来源更新产生 `SOURCE_REGISTERED` 后继版本；`CORRECTION_ORDERED` 的 `impact_assessment` 区分"仍成立的观点"与"必须修正的事实"。
- **敏感线索限角色流转**：`source_claim` 的 `visibility: review_only` 表示细节字段仅核查角色可读。
- **读者与内部两种视图**：对账完成后，任一入口展示当前有效版本与更正提示；内部可由更正单还原依据、审批与各渠道实际执行结果。

## 本地检查

```bash
node --test
```
