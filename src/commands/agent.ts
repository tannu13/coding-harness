import fs from "node:fs";
import { Command } from "commander";
import { readFileTool, ToolRegistry, writeFileTool } from "../services/tools";
import { Agent } from "../services/agent";
import { Harness } from "../services/harness";
import { MODEL_FILE_PATH, ModelsContentSchema } from "./models/set";
import env from "../env";

export const agentCommand = new Command("agent")
  .description("Runs the agent")
  .option("-p, --prompt <prompt>", "prompt", "")
  .action(async (options) => {
    console.log("User prompt is ..." + options.prompt);

    let modelFileContent = "{}";
    await fs.readFile(MODEL_FILE_PATH, async (err, data) => {
      if (err) {
        await fs.writeFile(MODEL_FILE_PATH, "{}", (err) => {
          console.error(err);
        });
      } else {
        modelFileContent = data.toString();
      }
      if (!modelFileContent) {
        modelFileContent = "{}";
      }
      const parsedContent = JSON.parse(modelFileContent);
      const parsed = ModelsContentSchema.safeParse(parsedContent);

      if (!parsed.success) {
        console.error(`Invalid provider file @ ${MODEL_FILE_PATH}`);
        console.error(parsed.error);
        process.exit(1);
      }

      console.log("parsed.data", parsed.data["default"]);
      let model = "gemini-2.5-flash";
      if (parsed.data["default"]) {
        model = parsed.data["default"];
      }

      let validEnterprise = "";
      for (const [enterpriseKey, models] of Object.entries(parsed.data)) {
        if (enterpriseKey === "default") continue;

        if (models.includes(model)) {
          validEnterprise = enterpriseKey;
        }
      }

      // td:: get api key for this validEnterprise, if empty throw

      const tools = new ToolRegistry();
      tools.register(readFileTool).register(writeFileTool);

      // const userPrompt =
      //   "Read './rainbow.txt' and write a summary to rainbow-summary.txt in 50 chars.";

      // td:: the api key should be the one what user gave not the one from env

      const agent = new Agent(env.GEMINI_API_KEY, options.prompt, model);

      const harness = new Harness(agent, tools);
      harness.executeTask();
    });
  });
