import env from "./env";
import { readFileTool, ToolRegistry, writeFileTool } from "./services/tools";
import { Agent } from "./services/agent";
import { Harness } from "./services/harness";

async function main() {
  const tools = new ToolRegistry();
  tools.register(readFileTool).register(writeFileTool);

  const userPrompt =
    "Read './rainbow.txt' and write a summary to rainbow-summary.txt in 50 chars.";

  const agent = new Agent(env.GEMINI_API_KEY, userPrompt);

  const harness = new Harness(agent, tools, 5);
  harness.executeTask();
}

main();
