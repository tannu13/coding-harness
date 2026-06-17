import type { Content, Part } from "@google/genai";

export type ContextStrategy =
  | "none"
  | "truncate-oldest"
  | "summarize-old-history";

export interface ContextSummary {
  text: string;
  sourceMessageCount: number;
  approxTokens: number;
}

export interface ContextManagerConfig {
  strategy: ContextStrategy;
  maxRecentMessages: number;
  approxTokenBudget?: number;
}

export interface ContextResult {
  contents: Content[];
  rawMessageCount: number;
  managedMessageCount: number;
  droppedMessageCount: number;
  approxTokens: number;
  strategy: ContextStrategy;
  summary?: ContextSummary;
}

export class UnsupportedContextStrategyError extends Error {
  constructor(strategy: ContextStrategy) {
    super(
      `Context strategy "${strategy}" is not implemented yet. Use "none" or "truncate-oldest".`,
    );
    this.name = "UnsupportedContextStrategyError";
  }
}

export class ContextManager {
  private config: ContextManagerConfig;

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = {
      strategy: config.strategy ?? "truncate-oldest",
      maxRecentMessages: config.maxRecentMessages ?? 8,
      approxTokenBudget: config.approxTokenBudget,
    };
  }

  buildContext(rawHistory: Content[]): ContextResult {
    switch (this.config.strategy) {
      case "none":
        return this.createResult(rawHistory, rawHistory);
      case "truncate-oldest":
        return this.createResult(rawHistory, this.truncateOldest(rawHistory));
      case "summarize-old-history":
        throw new UnsupportedContextStrategyError(this.config.strategy);
      default: {
        const exhaustiveCheck: never = this.config.strategy;
        return exhaustiveCheck;
      }
    }
  }

  getConfig() {
    return { ...this.config };
  }

  private truncateOldest(rawHistory: Content[]) {
    if (rawHistory.length <= 1) return rawHistory;

    const [initialPrompt, ...olderMessages] = rawHistory;
    if (!initialPrompt) return rawHistory;

    const recentMessageCount = Math.max(2, this.config.maxRecentMessages);
    const recentMessages = olderMessages.slice(-recentMessageCount);

    return [initialPrompt, ...recentMessages];
  }

  private createResult(rawHistory: Content[], managedHistory: Content[]) {
    return {
      contents: managedHistory,
      rawMessageCount: rawHistory.length,
      managedMessageCount: managedHistory.length,
      droppedMessageCount: rawHistory.length - managedHistory.length,
      approxTokens: estimateContentTokens(managedHistory),
      strategy: this.config.strategy,
    };
  }
}

export function estimateContentTokens(contents: Content[]) {
  return contents.reduce((total, content) => {
    return total + estimateTextTokens(content.role ?? "") + estimatePartTokens(content.parts);
  }, 0);
}

function estimatePartTokens(parts: Part[] | undefined) {
  if (!parts) return 0;

  return parts.reduce((total, part) => {
    if ("text" in part && typeof part.text === "string") {
      return total + estimateTextTokens(part.text);
    }

    return total + estimateTextTokens(JSON.stringify(part));
  }, 0);
}

function estimateTextTokens(text: string) {
  return Math.ceil(text.length / 4);
}
