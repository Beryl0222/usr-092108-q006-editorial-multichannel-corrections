import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateEvent } from "../src/validator.js";

const load = (name) => readFile(new URL(`../data/${name}`, import.meta.url), "utf8").then(JSON.parse);

test("样例符合领域约定", async () => {
  const sample = await load("sample.json");
  assert.deepEqual(validateEvent(sample), []);
});

test("谱系走查样例每条事件都符合约定", async () => {
  const events = await load("lineage-walkthrough.json");
  for (const event of events) {
    assert.deepEqual(validateEvent(event), [], `${event.event_id} 应通过校验`);
  }
});

test("谱系走查样例中同一聚合的版本单调递增", async () => {
  const events = await load("lineage-walkthrough.json");
  const seen = new Map();
  for (const event of events) {
    const key = `${event.aggregate_type}:${event.aggregate_id}`;
    const previous = seen.get(key) ?? 0;
    assert.ok(event.version > previous, `${event.event_id} 的版本应大于同一聚合前一事件`);
    seen.set(key, event.version);
  }
});

function event(overrides) {
  return {
    event_id: "evt-test-001",
    event_type: "DRAFT_REVIEWED",
    aggregate_type: "editorial_item",
    aggregate_id: "ed-test",
    occurred_at: "2026-09-20T08:00:00+08:00",
    version: 1,
    summary: "结构校验测试",
    actor: { id: "u-editor-01", role: "editor" },
    ...overrides,
  };
}

const coverage = { audience: ["已读用户"], propagation_copies: ["客户端缓存"] };

const invalidCases = [
  {
    name: "正式发布缺少责任编辑确认",
    event: event({ event_type: "PUBLICATION_CONFIRMED", aggregate_type: "channel_variant", channel: "client_app", published_version: 1 }),
    expect: "confirmed_by",
  },
  {
    name: "AI 生成的标题被直接标为正式",
    event: event({ event_type: "AI_CANDIDATE_PROPOSED", aggregate_type: "ai_candidate", candidate_kind: "title", status: "final" }),
    expect: "候选",
  },
  {
    name: "纸版更正说明缺少可定位信息",
    event: event({ event_type: "DISPOSITION_EXECUTED", aggregate_type: "correction_action", channel: "print", disposition: "correction_notice", coverage }),
    expect: "locator",
  },
  {
    name: "短视频使用本渠道不允许的处置",
    event: event({ event_type: "DISPOSITION_EXECUTED", aggregate_type: "correction_action", channel: "short_video", disposition: "replace_body", revision_ref: "rev-x", coverage }),
    expect: "不允许处置方式",
  },
  {
    name: "处置缺少覆盖的受众与传播副本",
    event: event({ event_type: "DISPOSITION_EXECUTED", aggregate_type: "correction_action", channel: "client_app", disposition: "replace_body", revision_ref: "rev-x" }),
    expect: "coverage",
  },
  {
    name: "客户端替换正文但未保留修订记录",
    event: event({ event_type: "DISPOSITION_EXECUTED", aggregate_type: "correction_action", channel: "client_app", disposition: "replace_body", coverage }),
    expect: "revision_ref",
  },
  {
    name: "敏感线索对非核查角色可见",
    event: event({ event_type: "SOURCE_REGISTERED", aggregate_type: "source_claim", source_kind: "tip_off", sensitivity: "restricted", visibility: ["editor"] }),
    expect: "核查角色",
  },
  {
    name: "对账生效但缺少生效版本",
    event: event({ event_type: "CHANNEL_RECONCILED", aggregate_type: "channel_variant", channel: "partner_feed", decision: "applied", effective_version: 2 }),
    expect: "applied_version",
  },
  {
    name: "忽略乱序回执但未说明原因",
    event: event({ event_type: "CHANNEL_RECONCILED", aggregate_type: "channel_variant", channel: "partner_feed", decision: "ignored_stale", effective_version: 2 }),
    expect: "reason",
  },
  {
    name: "未知事件类型",
    event: event({ event_type: "SOMETHING_ELSE" }),
    expect: "未知事件类型",
  },
  {
    name: "版本号不是正整数",
    event: event({ version: 0 }),
    expect: "version 必须是正整数",
  },
  {
    name: "事件记录在错误的聚合上",
    event: event({ event_type: "DISPOSITION_EXECUTED", aggregate_type: "editorial_item", channel: "client_app", disposition: "replace_body", revision_ref: "rev-x", coverage }),
    expect: "应记录在聚合",
  },
  {
    name: "未知渠道",
    event: event({ event_type: "PUBLISH_WINDOW_SET", aggregate_type: "channel_variant", channel: "paper", window: { not_before: "2026-09-20T00:00:00+08:00", not_after: "2026-09-20T06:00:00+08:00" } }),
    expect: "未知渠道",
  },
];

for (const { name, event: record, expect } of invalidCases) {
  test(`结构校验拦截：${name}`, () => {
    const errors = validateEvent(record);
    assert.ok(
      errors.some((message) => message.includes(expect)),
      `应报告包含「${expect}」的错误，实际：${errors.join("；") || "（无错误）"}`,
    );
  });
}
