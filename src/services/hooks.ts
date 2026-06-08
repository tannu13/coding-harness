import type { Content } from "@google/genai";

interface PreLlmCallContext {
  history: Content[];
}
interface PreToolCallContext {
  history: Content[];
  toolName: string;
  toolArgs: Record<string, unknown>;
  approve(): void;
  reject(reason: string): void;
}
interface PostToolCallContext {
  history: Content[];
  toolName: string;
  result: Promise<Record<string, unknown>>;
}
interface NoToolCallContext {
  history: Content[];
}

interface HookContextMap {
  "pre-llm-call": PreLlmCallContext;
  "pre-tool-call": PreToolCallContext;
  "post-tool-call": PostToolCallContext;
  "no-tool-calls-remaining": NoToolCallContext;
}

type HookType = keyof HookContextMap;

interface Hook<T extends HookType> {
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
