import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canTransitionLot, canTransitionPhase, assertLotTransition, StateError } from "../src/lib/stateMachine.js";

test("valid lot transitions are allowed", () => {
  assert.equal(canTransitionLot("QUEUED", "IN_PROGRESS"), true);
  assert.equal(canTransitionLot("IN_PROGRESS", "PAUSED"), true);
  assert.equal(canTransitionLot("COMPLETED", "READY_FOR_PICKUP"), true);
});

test("invalid lot transitions are rejected", () => {
  assert.equal(canTransitionLot("DELIVERED", "IN_PROGRESS"), false);
  assert.equal(canTransitionLot("CREATED", "COMPLETED"), false);
  assert.throws(() => assertLotTransition("DELIVERED", "QUEUED"), StateError);
});

test("phase transitions enforce the machine", () => {
  assert.equal(canTransitionPhase("READY", "RUNNING"), true);
  assert.equal(canTransitionPhase("RUNNING", "COMPLETED"), true);
  assert.equal(canTransitionPhase("COMPLETED", "RUNNING"), false);
  assert.equal(canTransitionPhase("PENDING", "RUNNING"), false);
});
