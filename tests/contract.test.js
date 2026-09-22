import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateEvent } from "../src/validator.js";

const sample = JSON.parse(await readFile(new URL("../data/sample.json", import.meta.url), "utf8"));
const lineage = JSON.parse(await readFile(new URL("../data/lineage.sample.json", import.meta.url), "utf8"));

test("样例符合领域约定", () => {
  assert.deepEqual(validateEvent(sample), []);
});

test("谱系样例每条事件都符合信封约定", () => {
  for (const event of lineage) {
    assert.deepEqual(validateEvent(event), [], event.event_id);
  }
});

test("拒绝未知事件类型与非法字段", () => {
  const bad = { ...sample, event_type: "SOMETHING_ELSE" };
  assert.ok(validateEvent(bad).some((e) => e.includes("未知事件类型")));
  assert.ok(validateEvent({ ...sample, version: 0 }).some((e) => e.includes("version")));
  assert.ok(validateEvent({ ...sample, occurred_at: "不是时间" }).some((e) => e.includes("occurred_at")));
});

test("自动标题摘要只是候选，须经责任编辑确认后才可签发", () => {
  const candidate = lineage.find((e) => e.event_type === "TITLE_SUMMARY_CANDIDATE_PROPOSED");
  assert.equal(candidate.payload.status, "candidate");
  const confirmed = lineage.find((e) => e.event_type === "TITLE_SUMMARY_CONFIRMED");
  const firstApproval = lineage.find((e) => e.event_type === "VARIANT_APPROVED");
  assert.ok(candidate.occurred_at < confirmed.occurred_at);
  assert.ok(confirmed.occurred_at < firstApproval.occurred_at);
  assert.ok(confirmed.payload.confirmed_by, "确认必须署名责任编辑");
});

test("重复或乱序回执不得生效、不得重新置顶旧版", () => {
  const receipts = lineage.filter((e) => e.event_type === "CHANNEL_RECEIPT_RECORDED");
  const seen = new Set();
  let maxApplied = 0;
  for (const r of receipts) {
    const { receipt_id, applies_to_version, applied, ignored_reason } = r.payload;
    if (seen.has(receipt_id)) {
      assert.equal(applied, false, "重复回执必须幂等忽略");
      assert.equal(ignored_reason, "duplicate_receipt");
    } else if (applied) {
      assert.ok(applies_to_version >= maxApplied, "生效回执不得指向更旧版本");
      maxApplied = applies_to_version;
    } else {
      assert.ok(ignored_reason, "未生效回执必须给出原因");
    }
    seen.add(receipt_id);
  }
});

test("各端更正处置符合渠道策略并标明受众与副本范围", () => {
  const executions = lineage.filter((e) => e.event_type === "CORRECTION_EXECUTED");
  const byChannel = Object.fromEntries(executions.map((e) => [e.payload.channel, e.payload]));
  assert.equal(byChannel.print.strategy, "correction_notice");
  assert.ok(byChannel.print.locator, "纸版更正必须可定位");
  assert.equal(byChannel.app.strategy, "replace_with_history");
  assert.ok(["annotate", "reedit", "takedown"].includes(byChannel.shortvideo.strategy));
  for (const e of executions) {
    assert.ok(e.payload.audience_covered, `${e.payload.channel} 须说明覆盖受众`);
    assert.ok(e.payload.copies_covered, `${e.payload.channel} 须说明覆盖的传播副本`);
  }
});

test("敏感线索只在核查角色间流转", () => {
  const sensitive = lineage.filter((e) => e.aggregate_type === "source_claim" && e.payload?.kind === "线索");
  assert.ok(sensitive.length > 0);
  for (const e of sensitive) {
    assert.equal(e.payload.visibility, "review_only");
  }
});

test("更正决定记录影响评估：哪些观点成立、哪些事实须修正", () => {
  const order = lineage.find((e) => e.event_type === "CORRECTION_ORDERED");
  assert.ok(order.payload.impact_assessment.viewpoints_still_valid.length > 0);
  assert.ok(order.payload.impact_assessment.facts_to_correct.length > 0);
});
