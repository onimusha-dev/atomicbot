/**
 * Tests for shared configHelpers utilities.
 */
import { describe, expect, it } from "vitest";

import { getObject, getStringArray } from "./configHelpers";

// ── getObject ──────────────────────────────────────────────────────────────────

describe("getObject", () => {
  it("returns the object when given a plain object", () => {
    const obj = { key: "value" };
    expect(getObject(obj)).toBe(obj);
  });

  it("returns empty object for null", () => {
    expect(getObject(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(getObject(undefined)).toEqual({});
  });

  it("returns empty object for arrays", () => {
    expect(getObject([1, 2, 3])).toEqual({});
  });

  it("returns empty object for strings", () => {
    expect(getObject("hello")).toEqual({});
  });

  it("returns empty object for numbers", () => {
    expect(getObject(42)).toEqual({});
  });

  it("returns empty object for booleans", () => {
    expect(getObject(true)).toEqual({});
    expect(getObject(false)).toEqual({});
  });

  it("returns nested objects as-is (same reference)", () => {
    const obj = { nested: { deep: true } };
    expect(getObject(obj)).toBe(obj);
  });

  it("handles empty objects", () => {
    const obj = {};
    expect(getObject(obj)).toBe(obj);
  });
});

// ── getStringArray ─────────────────────────────────────────────────────────────

describe("getStringArray", () => {
  it("returns strings from a string array", () => {
    expect(getStringArray(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("converts non-string values to strings", () => {
    expect(getStringArray([1, 2])).toEqual(["1", "2"]);
  });

  it("filters empty and whitespace-only strings", () => {
    expect(getStringArray(["a", "", "  ", "b"])).toEqual(["a", "b"]);
  });

  it("returns empty array for non-array values", () => {
    expect(getStringArray(null)).toEqual([]);
    expect(getStringArray(undefined)).toEqual([]);
    expect(getStringArray("string")).toEqual([]);
    expect(getStringArray(42)).toEqual([]);
    expect(getStringArray({})).toEqual([]);
  });

  it("trims whitespace from values", () => {
    expect(getStringArray(["  hello  ", "  world  "])).toEqual(["hello", "world"]);
  });
});
