import { test } from "node:test";
import assert from "node:assert/strict";
import { roundOrderQty } from "../lib/order-builder/qty";

// Full table from the Phase 2 spec. If any row fails, the rounding rule
// is broken — escalate before shipping.
const TABLE: Array<[number, number | null]> = [
  [0, null],
  [1, null],
  [2, null],
  [3, null],
  [4, 5],
  [5, 5],
  [6, 5],
  [7, 10],
  [8, 10],
  [9, 10],
  [10, 10],
  [11, 10],
  [12, 15],
  [13, 15],
  [14, 15],
  [15, 15],
  [16, 15],
  [17, 20],
  [18, 20],
  [19, 20],
  [20, 20],
  [21, 20],
  [22, 25],
  [23, 25],
  [24, 25],
  [25, 25],
  [26, 25],
  [27, 30],
  [28, 30],
  [29, 30],
  [30, 30],
];

for (const [mso, expected] of TABLE) {
  test(`roundOrderQty(${mso}) === ${expected}`, () => {
    assert.equal(roundOrderQty(mso), expected);
  });
}

test("roundOrderQty rejects NaN / Infinity", () => {
  assert.equal(roundOrderQty(Number.NaN), null);
  assert.equal(roundOrderQty(Number.POSITIVE_INFINITY), null);
});
