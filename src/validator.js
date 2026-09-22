const required = ["event_id", "event_type", "aggregate_type", "aggregate_id", "occurred_at", "version", "summary"];

const eventTypes = [
  "TOPIC_CONFERENCE_RECORDED",
  "SOURCE_REGISTERED",
  "DRAFT_SUBMITTED",
  "DRAFT_REVIEWED",
  "FACT_CHECK_COMPLETED",
  "TITLE_SUMMARY_CANDIDATE_PROPOSED",
  "TITLE_SUMMARY_CONFIRMED",
  "VARIANT_PREPARED",
  "VARIANT_APPROVED",
  "PUBLICATION_CONFIRMED",
  "CHANNEL_RECEIPT_RECORDED",
  "CORRECTION_ORDERED",
  "CORRECTION_EXECUTED",
  "CHANNEL_RECONCILED"
];

const aggregateTypes = ["editorial_item", "source_claim", "channel_variant", "correction_action"];

export function validateEvent(record) {
  const errors = required.filter((name) => !(name in record)).map((name) => `缺少字段：${name}`);
  if ("event_type" in record && !eventTypes.includes(record.event_type)) errors.push(`未知事件类型：${record.event_type}`);
  if ("aggregate_type" in record && !aggregateTypes.includes(record.aggregate_type)) errors.push(`未知聚合类型：${record.aggregate_type}`);
  if ("version" in record && (!Number.isInteger(record.version) || record.version < 1)) errors.push("version 必须是正整数");
  if ("occurred_at" in record && Number.isNaN(Date.parse(record.occurred_at))) errors.push("occurred_at 必须是可解析的时间");
  return errors;
}
