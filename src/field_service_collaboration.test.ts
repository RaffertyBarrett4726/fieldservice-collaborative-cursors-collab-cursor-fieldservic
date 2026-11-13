import test from "node:test";
import assert from "node:assert/strict";
import { workOrderUpdate, demoInput } from "./field_service_collaboration.ts";

test("an on-site work order carries the cursor and follow-up in one validated update", () => {
  const result = workOrderUpdate.parse(demoInput());
  assert.equal(result.dispatchStatus, "on_site");
  assert.equal(result.photoId, "photo-1042-before");
  assert.deepEqual(result.cursor, { x: 312, y: 188 });
  assert.equal(result.followUp, "Confirm replacement part before 16:00");
});

test("a malformed cursor is rejected at the request boundary", () => {
  assert.throws(() => workOrderUpdate.parse({ ...demoInput(), cursor: { x: "312", y: 188 } }));
});
