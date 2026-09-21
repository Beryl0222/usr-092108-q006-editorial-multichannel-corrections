const REQUIRED_FIELDS = ["event_id", "event_type", "aggregate_type", "aggregate_id", "occurred_at", "version", "summary", "actor"];

const EVENT_TYPES = [
  "TOPIC_MEETING_LOGGED",
  "SOURCE_REGISTERED",
  "SOURCE_UPDATED",
  "DRAFT_SUBMITTED",
  "DRAFT_REVIEWED",
  "CHECK_RECORDED",
  "AI_CANDIDATE_PROPOSED",
  "AI_CANDIDATE_CONFIRMED",
  "VARIANT_PREPARED",
  "VARIANT_APPROVED",
  "PUBLISH_WINDOW_SET",
  "PUBLICATION_CONFIRMED",
  "CORRECTION_ORDERED",
  "DISPOSITION_EXECUTED",
  "RECEIPT_RECORDED",
  "CHANNEL_RECONCILED",
  "IMPACT_ASSESSED",
];

const AGGREGATE_TYPES = ["editorial_item", "source_claim", "channel_variant", "correction_action", "ai_candidate", "platform_receipt"];
const CHANNELS = ["print", "client_app", "short_video", "social_card", "partner_feed"];
const ROLES = ["author", "editor", "responsible_editor", "duty_editor", "legal_reviewer", "business_reviewer", "system", "partner_platform"];
const VERIFICATION_ROLES = ["legal_reviewer", "business_reviewer"];
const SOURCE_KINDS = ["document", "interview", "dataset", "external_article", "official_release", "tip_off"];
const CHECK_TYPES = ["legal", "business"];
const CHECK_RESULTS = ["passed", "conditional", "failed"];
const CANDIDATE_KINDS = ["title", "summary"];
const VARIANT_KINDS = ["print_layout", "article_body", "voiceover_script", "social_card", "feed_payload"];
const DECISIONS = ["applied", "ignored_duplicate", "ignored_stale"];
const ASSESSMENT_STATUSES = ["still_valid", "must_correct"];

const DISPOSITIONS = {
  print: ["correction_notice"],
  client_app: ["replace_body"],
  short_video: ["annotate", "recut", "takedown"],
  social_card: ["replace_card", "annotate"],
  partner_feed: ["update_request", "takedown_request"],
};

const EVENT_AGGREGATE = {
  TOPIC_MEETING_LOGGED: "editorial_item",
  SOURCE_REGISTERED: "source_claim",
  SOURCE_UPDATED: "source_claim",
  DRAFT_SUBMITTED: "editorial_item",
  DRAFT_REVIEWED: "editorial_item",
  CHECK_RECORDED: "editorial_item",
  AI_CANDIDATE_PROPOSED: "ai_candidate",
  AI_CANDIDATE_CONFIRMED: "ai_candidate",
  VARIANT_PREPARED: "channel_variant",
  VARIANT_APPROVED: "channel_variant",
  PUBLISH_WINDOW_SET: "channel_variant",
  PUBLICATION_CONFIRMED: "channel_variant",
  CORRECTION_ORDERED: "correction_action",
  DISPOSITION_EXECUTED: "correction_action",
  RECEIPT_RECORDED: "platform_receipt",
  CHANNEL_RECONCILED: "channel_variant",
  IMPACT_ASSESSED: "editorial_item",
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
const isPositiveInt = (value) => Number.isInteger(value) && value >= 1;
const isDateTime = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

function requireFields(record, fields, errors) {
  for (const field of fields) {
    if (!(field in record)) errors.push(`缺少字段：${field}`);
  }
}

function checkEnum(record, field, allowed, errors) {
  if (field in record && !allowed.includes(record[field])) {
    errors.push(`${field} 必须是以下之一：${allowed.join("、")}`);
  }
}

function checkActor(record, errors) {
  if (!("actor" in record)) return;
  if (!isObject(record.actor)) {
    errors.push("actor 必须是对象");
    return;
  }
  if (!isNonEmptyString(record.actor.id)) errors.push("actor.id 必须是非空字符串");
  if (!ROLES.includes(record.actor.role)) errors.push(`未知角色：${record.actor.role}`);
}

function checkRefs(record, errors) {
  if (!("refs" in record)) return;
  if (!Array.isArray(record.refs)) {
    errors.push("refs 必须是数组");
    return;
  }
  record.refs.forEach((ref, index) => {
    if (!isObject(ref)) {
      errors.push(`refs[${index}] 必须是对象`);
      return;
    }
    if (!AGGREGATE_TYPES.includes(ref.aggregate_type)) errors.push(`refs[${index}] 包含未知聚合类型：${ref.aggregate_type}`);
    if (!isNonEmptyString(ref.aggregate_id)) errors.push(`refs[${index}].aggregate_id 必须是非空字符串`);
    if (!isNonEmptyString(ref.role)) errors.push(`refs[${index}].role 必须是非空字符串`);
  });
}

function checkSensitivity(record, errors) {
  if (!("sensitivity" in record)) return;
  if (!["normal", "restricted"].includes(record.sensitivity)) {
    errors.push(`未知密级：${record.sensitivity}`);
    return;
  }
  if (record.sensitivity === "restricted") {
    const visibility = Array.isArray(record.visibility) ? record.visibility : [];
    if (visibility.length === 0 || visibility.some((role) => !VERIFICATION_ROLES.includes(role))) {
      errors.push("敏感线索只能在核查角色间流转：visibility 需仅包含 legal_reviewer、business_reviewer");
    }
  }
}

const EVENT_CHECKS = {
  SOURCE_REGISTERED(record, errors) {
    requireFields(record, ["source_kind"], errors);
    checkEnum(record, "source_kind", SOURCE_KINDS, errors);
  },
  SOURCE_UPDATED(record, errors) {
    requireFields(record, ["change_summary"], errors);
  },
  CHECK_RECORDED(record, errors) {
    requireFields(record, ["check_type", "result"], errors);
    checkEnum(record, "check_type", CHECK_TYPES, errors);
    checkEnum(record, "result", CHECK_RESULTS, errors);
  },
  AI_CANDIDATE_PROPOSED(record, errors) {
    requireFields(record, ["candidate_kind", "status"], errors);
    checkEnum(record, "candidate_kind", CANDIDATE_KINDS, errors);
    if ("status" in record && record.status !== "candidate") {
      errors.push("自动生成的标题/摘要只能是候选：status 必须为 candidate");
    }
  },
  AI_CANDIDATE_CONFIRMED(record, errors) {
    requireFields(record, ["confirmed_by"], errors);
  },
  VARIANT_PREPARED(record, errors) {
    requireFields(record, ["channel", "variant_kind"], errors);
    checkEnum(record, "variant_kind", VARIANT_KINDS, errors);
  },
  VARIANT_APPROVED(record, errors) {
    requireFields(record, ["channel", "approved_by"], errors);
  },
  PUBLISH_WINDOW_SET(record, errors) {
    requireFields(record, ["channel", "window"], errors);
    if (isObject(record.window)) {
      if (!isDateTime(record.window.not_before) || !isDateTime(record.window.not_after)) {
        errors.push("发布窗口 window 需包含 not_before 与 not_after 日期时间");
      } else if (Date.parse(record.window.not_before) >= Date.parse(record.window.not_after)) {
        errors.push("发布窗口起点必须早于终点");
      }
    }
  },
  PUBLICATION_CONFIRMED(record, errors) {
    requireFields(record, ["channel", "confirmed_by", "published_version"], errors);
    if ("published_version" in record && !isPositiveInt(record.published_version)) errors.push("published_version 必须是正整数");
  },
  CORRECTION_ORDERED(record, errors) {
    requireFields(record, ["reason", "ordered_by", "scope"], errors);
    if (isObject(record.scope)) {
      const channels = record.scope.channels;
      if (!Array.isArray(channels) || channels.length === 0) {
        errors.push("scope.channels 至少包含一个渠道");
      } else {
        for (const channel of channels) {
          if (!CHANNELS.includes(channel)) errors.push(`未知渠道：${channel}`);
        }
      }
    }
  },
  DISPOSITION_EXECUTED(record, errors) {
    requireFields(record, ["channel", "disposition", "coverage"], errors);
    const allowed = DISPOSITIONS[record.channel];
    if (allowed && "disposition" in record && !allowed.includes(record.disposition)) {
      errors.push(`渠道 ${record.channel} 不允许处置方式 ${record.disposition}`);
    }
    if (record.disposition === "correction_notice" && !isNonEmptyString(record.locator)) {
      errors.push("纸版更正说明必须提供可定位的 locator");
    }
    if (record.disposition === "replace_body" && !isNonEmptyString(record.revision_ref)) {
      errors.push("replace_body 必须提供 revision_ref 以保留修订记录");
    }
    if (isObject(record.coverage)) {
      for (const key of ["audience", "propagation_copies"]) {
        const value = record.coverage[key];
        if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
          errors.push(`coverage.${key} 至少包含一项非空说明`);
        }
      }
    }
  },
  RECEIPT_RECORDED(record, errors) {
    requireFields(record, ["receipt_id", "channel", "reported_version"], errors);
    if ("reported_version" in record && !isPositiveInt(record.reported_version)) errors.push("reported_version 必须是正整数");
  },
  CHANNEL_RECONCILED(record, errors) {
    requireFields(record, ["channel", "decision", "effective_version"], errors);
    checkEnum(record, "decision", DECISIONS, errors);
    if ("effective_version" in record && !isPositiveInt(record.effective_version)) errors.push("effective_version 必须是正整数");
    if (record.decision === "applied") {
      if (!isPositiveInt(record.applied_version)) errors.push("applied 对账必须提供正整数 applied_version");
      if (isPositiveInt(record.applied_version) && isPositiveInt(record.effective_version) && record.effective_version < record.applied_version) {
        errors.push("effective_version 不得早于 applied_version");
      }
    }
    if ((record.decision === "ignored_duplicate" || record.decision === "ignored_stale") && !isNonEmptyString(record.reason)) {
      errors.push("忽略重复或乱序回执必须说明 reason");
    }
  },
  IMPACT_ASSESSED(record, errors) {
    requireFields(record, ["assessments"], errors);
    if (!Array.isArray(record.assessments)) return;
    if (record.assessments.length === 0) errors.push("assessments 至少包含一条评估");
    record.assessments.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`assessments[${index}] 必须是对象`);
        return;
      }
      if (!isNonEmptyString(item.subject)) errors.push(`assessments[${index}].subject 必须是非空字符串`);
      if (!ASSESSMENT_STATUSES.includes(item.status)) errors.push(`assessments[${index}].status 必须是 still_valid 或 must_correct`);
    });
  },
};

export function validateEvent(record) {
  if (!isObject(record)) return ["记录必须是对象"];
  const errors = [];
  requireFields(record, REQUIRED_FIELDS, errors);
  if ("event_type" in record && !EVENT_TYPES.includes(record.event_type)) errors.push(`未知事件类型：${record.event_type}`);
  if ("aggregate_type" in record && !AGGREGATE_TYPES.includes(record.aggregate_type)) errors.push(`未知聚合类型：${record.aggregate_type}`);
  if ("version" in record && !isPositiveInt(record.version)) errors.push("version 必须是正整数");
  if ("occurred_at" in record && !isDateTime(record.occurred_at)) errors.push("occurred_at 必须是日期时间字符串");
  if ("channel" in record && !CHANNELS.includes(record.channel)) errors.push(`未知渠道：${record.channel}`);
  checkActor(record, errors);
  checkRefs(record, errors);
  checkSensitivity(record, errors);
  const expectedAggregate = EVENT_AGGREGATE[record.event_type];
  if (expectedAggregate && "aggregate_type" in record && record.aggregate_type !== expectedAggregate) {
    errors.push(`${record.event_type} 应记录在聚合 ${expectedAggregate} 上`);
  }
  const check = EVENT_CHECKS[record.event_type];
  if (check) check(record, errors);
  return errors;
}
