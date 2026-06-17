import { describe, expect, test } from "bun:test";
import type { Content, Part } from "@google/genai";
import { ContextManager } from "./context-manager";
import { Harness } from "./harness";
import { HooksRegistry, type Hook, type HookContextMap } from "./hooks";
import { ToolRegistry } from "./tools";

class FakeAgent {
  receivedContents: Content[][] = [];

  constructor(private history: Content[]) {}

  getHistory() {
    return this.history;
  }

  addUserRole(parts: Part[]) {
    this.history.push({ role: "user", parts });
  }

  addModelRole(parts: Part[]) {
    this.history.push({ role: "model", parts });
  }

  async runStep(_registry: ToolRegistry, contents: Content[]) {
    this.receivedContents.push(contents);
    return {
      text: "done",
    } as any;
  }
}

function textMessage(role: "user" | "model", text: string): Content {
  return {
    role,
    parts: [{ text }],
  };
}

describe("Harness context management", () => {
  test("passes managed context to the agent instead of raw history", async () => {
    const rawHistory = [
      textMessage("user", "initial"),
      textMessage("model", "old model"),
      textMessage("user", "old user"),
      textMessage("model", "recent model"),
      textMessage("user", "recent user"),
    ];
    const agent = new FakeAgent(rawHistory);
    const harness = new Harness(
      agent,
      new ToolRegistry(),
      new HooksRegistry(),
      1,
      new ContextManager({
        strategy: "truncate-oldest",
        maxRecentMessages: 2,
      }),
    );

    await harness.executeTask();

    expect(agent.receivedContents).toHaveLength(1);
    expect(agent.receivedContents[0]).toEqual([
      rawHistory[0]!,
      rawHistory[3]!,
      rawHistory[4]!,
    ]);
  });

  test("fires pre-llm-call with raw and managed context metadata", async () => {
    const rawHistory = [
      textMessage("user", "initial"),
      textMessage("model", "old model"),
      textMessage("user", "recent user"),
    ];
    const seenContexts: HookContextMap["pre-llm-call"][] = [];
    const hook: Hook<"pre-llm-call"> = {
      name: "capture-context",
      process(context) {
        seenContexts.push(context);
      },
    };
    const hooks = new HooksRegistry();
    hooks.register("pre-llm-call", hook);

    const harness = new Harness(
      new FakeAgent(rawHistory),
      new ToolRegistry(),
      hooks,
      1,
      new ContextManager({
        strategy: "truncate-oldest",
        maxRecentMessages: 1,
      }),
    );

    await harness.executeTask();

    expect(seenContexts).toHaveLength(1);
    expect(seenContexts[0]?.rawHistory).toBe(rawHistory);
    expect(seenContexts[0]?.managedHistory).toEqual([
      rawHistory[0]!,
      rawHistory[1]!,
      rawHistory[2]!,
    ]);
    expect(seenContexts[0]?.context.strategy).toBe("truncate-oldest");
    expect(seenContexts[0]?.context.approxTokens).toBeGreaterThan(0);
    expect(seenContexts[0]?.context.rawMessageCount).toBe(3);
    expect(seenContexts[0]?.context.managedMessageCount).toBe(3);
  });
});
