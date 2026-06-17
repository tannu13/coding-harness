import { describe, expect, test } from "bun:test";
import { parseContextStrategy, parsePositiveInteger } from "./agent";

describe("agent command context option parsing", () => {
  test("accepts supported context strategies", () => {
    expect(parseContextStrategy("none")).toBe("none");
    expect(parseContextStrategy("truncate-oldest")).toBe("truncate-oldest");
    expect(parseContextStrategy("summarize-old-history")).toBe(
      "summarize-old-history",
    );
  });

  test("rejects unsupported context strategies", () => {
    expect(() => parseContextStrategy("latest-only")).toThrow(
      'Invalid context strategy "latest-only"',
    );
  });

  test("parses positive integer options", () => {
    expect(parsePositiveInteger("8")).toBe(8);
  });

  test("rejects non-positive integer options", () => {
    expect(() => parsePositiveInteger("0")).toThrow(
      'Expected a positive integer, got "0".',
    );
    expect(() => parsePositiveInteger("1.5")).toThrow(
      'Expected a positive integer, got "1.5".',
    );
  });
});
