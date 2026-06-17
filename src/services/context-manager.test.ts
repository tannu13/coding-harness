import { describe, expect, test } from "bun:test";
import type { Content } from "@google/genai";
import {
  ContextManager,
  UnsupportedContextStrategyError,
  estimateContentTokens,
} from "./context-manager";

function textMessage(role: "user" | "model", text: string): Content {
  return {
    role,
    parts: [{ text }],
  };
}

describe("ContextManager", () => {
  test("none returns all raw history unchanged", () => {
    const history = [
      textMessage("user", "initial"),
      textMessage("model", "reply"),
      textMessage("user", "follow up"),
    ];

    const result = new ContextManager({ strategy: "none" }).buildContext(
      history,
    );

    expect(result.contents).toBe(history);
    expect(result.rawMessageCount).toBe(3);
    expect(result.managedMessageCount).toBe(3);
    expect(result.droppedMessageCount).toBe(0);
    expect(result.strategy).toBe("none");
  });

  test("truncate-oldest preserves the initial prompt and recent messages", () => {
    const history = [
      textMessage("user", "initial"),
      textMessage("model", "old model"),
      textMessage("user", "old user"),
      textMessage("model", "recent model"),
      textMessage("user", "recent user"),
    ];

    const result = new ContextManager({
      strategy: "truncate-oldest",
      maxRecentMessages: 2,
    }).buildContext(history);

    expect(result.contents).toEqual([
      history[0]!,
      history[3]!,
      history[4]!,
    ]);
    expect(result.rawMessageCount).toBe(5);
    expect(result.managedMessageCount).toBe(3);
    expect(result.droppedMessageCount).toBe(2);
  });

  test("truncate-oldest keeps the latest tool call and response pair", () => {
    const latestToolCall: Content = {
      role: "model",
      parts: [
        {
          functionCall: {
            name: "readFile",
            args: { path: "README.md" },
          },
        },
      ],
    };
    const latestToolResponse: Content = {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "readFile",
            response: { content: "readme" },
          },
        },
      ],
    };
    const history = [
      textMessage("user", "initial"),
      textMessage("model", "old model"),
      textMessage("user", "old user"),
      latestToolCall,
      latestToolResponse,
    ];

    const result = new ContextManager({
      strategy: "truncate-oldest",
      maxRecentMessages: 1,
    }).buildContext(history);

    expect(result.contents).toEqual([
      history[0]!,
      latestToolCall,
      latestToolResponse,
    ]);
  });

  test("produces approximate token metadata", () => {
    const history = [
      textMessage("user", "12345678"),
      {
        role: "model",
        parts: [
          {
            functionCall: {
              name: "readFile",
              args: { path: "README.md" },
            },
          },
        ],
      },
    ] satisfies Content[];

    const result = new ContextManager({ strategy: "none" }).buildContext(
      history,
    );

    expect(result.approxTokens).toBe(estimateContentTokens(history));
    expect(result.approxTokens).toBeGreaterThan(0);
  });

  test("summarize-old-history reports that it is not implemented yet", () => {
    const manager = new ContextManager({
      strategy: "summarize-old-history",
      maxRecentMessages: 8,
    });

    expect(() => manager.buildContext([textMessage("user", "initial")])).toThrow(
      UnsupportedContextStrategyError,
    );
  });
});
