import type { Agent } from "./agent";
import type { ToolRegistry } from "./tools";

export class Harness {
  private agent: Agent;
  private toolRegistry: ToolRegistry;
  private maxIterations;

  status = "pending";

  constructor(agent: Agent, toolRegistry: ToolRegistry, maxIterations = 5) {
    this.agent = agent;
    this.toolRegistry = toolRegistry;
    this.maxIterations = maxIterations;
  }

  async executeTask() {
    let iteration = 0;
    let processing = true;
    while (processing && iteration < this.maxIterations) {
      iteration++;

      // call pre hooks
      const response = await this.agent.runStep(this.toolRegistry);

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
