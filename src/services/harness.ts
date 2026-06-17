import type { Agent } from "./agent";
import { ContextManager } from "./context-manager";
import type { HooksRegistry, PreToolCallContext } from "./hooks";
import type { ToolRegistry } from "./tools";

type AgentRunner = Pick<
  Agent,
  "getHistory" | "addUserRole" | "addModelRole" | "runStep"
>;

export class Harness {
  private agent: AgentRunner;
  private toolRegistry: ToolRegistry;
  private maxIterations;
  private hooksRegistry: HooksRegistry;
  private contextManager: ContextManager;

  status = "pending";

  constructor(
    agent: AgentRunner,
    toolRegistry: ToolRegistry,
    hooksRegistry: HooksRegistry,
    maxIterations = 5,
    contextManager = new ContextManager(),
  ) {
    this.agent = agent;
    this.toolRegistry = toolRegistry;
    this.maxIterations = maxIterations;
    this.hooksRegistry = hooksRegistry;
    this.contextManager = contextManager;
  }

  async executeTask() {
    let iteration = 0;
    let processing = true;
    while (processing && iteration < this.maxIterations) {
      iteration++;

      const rawHistory = this.agent.getHistory();
      const context = this.contextManager.buildContext(rawHistory);

      await this.hooksRegistry.executeHooks("pre-llm-call", {
        rawHistory,
        managedHistory: context.contents,
        context,
      });

      const response = await this.agent.runStep(
        this.toolRegistry,
        context.contents,
      );

      if (response.functionCalls) {
        this.agent.addModelRole(
          response.functionCalls.map((call) => ({ functionCall: call })),
        );

        const toolResponseParts = [];
        for (const fn of response.functionCalls) {
          const tool = this.toolRegistry.get(fn.name!);
          if (!tool) {
            console.warn(
              `LLM attempted to call unregistered tool: "${fn.name}"`,
            );
            continue;
          }

          const parseResult = tool.schema.safeParse(fn.args);
          if (!parseResult.success) {
            console.error(
              `Validation failed for tool '${tool.name}'. Errors:`,
              parseResult.error.flatten(),
            );
            continue;
          }

          let isApproved = true;
          const rejectionReasons: string[] = [];
          const contextPayload: PreToolCallContext = {
            history: this.agent.getHistory(),
            toolName: tool.name,
            args: parseResult.data as Record<string, unknown>,
            approve: () => {
              if (rejectionReasons.length > 0) {
                isApproved = false;
              }
            },
            reject: (reason) => {
              isApproved = false;
              rejectionReasons.push(reason);
            },
          };

          await this.hooksRegistry.executeHooks(
            "pre-tool-call",
            contextPayload,
          );
          if (!isApproved || rejectionReasons.length > 0) {
            toolResponseParts.push({
              functionResponse: {
                name: tool.name,
                response: {
                  status: "error",
                  error: `Tool call to ${tool.name} was rejected by guardrail hooks due to following reasons: ${rejectionReasons.join(", ")}`,
                },
              },
            });
            continue;
          }

          try {
            const result = await tool.execute(parseResult.data as any);
            toolResponseParts.push({
              functionResponse: {
                name: tool.name,
                response: result,
              },
            });

            // call post hooks
          } catch (err) {
            console.error(`Runtime error executing ${tool.name}`, err);
          }
        }

        this.agent.addUserRole(toolResponseParts);
      } else {
        // no tool calls
        console.log("Final Response: ", response.text);
        console.dir(response.usageMetadata, { depth: 5 });
        processing = false;
      }
    }

    if (iteration >= this.maxIterations) {
      console.warn("Harness hit safety iteration limit guardrail.");
    }
  }
}
