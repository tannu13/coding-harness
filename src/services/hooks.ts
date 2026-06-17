import type { Content } from "@google/genai";
import type { ContextResult } from "./context-manager";

export interface PreLlmCallContext {
  rawHistory: Content[];
  managedHistory: Content[];
  context: ContextResult;
}
export interface PreToolCallContext {
  history: Content[];
  toolName: string;
  args: Record<string, unknown>;
  approve(): void;
  reject(reason: string): void;
}
export interface PostToolCallContext {
  history: Content[];
  toolName: string;
  result: Promise<Record<string, unknown>>;
}
export interface NoToolCallContext {
  history: Content[];
}

export interface HookContextMap {
  "pre-llm-call": PreLlmCallContext;
  "pre-tool-call": PreToolCallContext;
  "post-tool-call": PostToolCallContext;
  "no-tool-calls-remaining": NoToolCallContext;
}

type HookType = keyof HookContextMap;

export interface Hook<T extends HookType> {
  name: string;
  process(context: HookContextMap[T]): Promise<void> | void;
}

export class HooksRegistry {
  private hooks = new Map<HookType, Hook<any>[]>();

  register<T extends HookType>(type: T, hook: Hook<T>) {
    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }

    this.hooks.get(type)!.push(hook);
  }

  async executeHooks<T extends HookType>(type: T, context: HookContextMap[T]) {
    const hooksForType = this.hooks.get(type);
    if (!hooksForType || hooksForType.length == 0) return;

    for (const hook of hooksForType) {
      await hook.process(context);
    }
  }
}
